/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).body()` mantém os testes legíveis */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import sharp from 'sharp'
import env from '#start/env'
import { makeUser } from '#tests/helpers'
import { LocalMediaStorage } from '#services/media/storage'

type Client = import('@japa/api-client').ApiClient
type User = Awaited<ReturnType<typeof makeUser>>

let dir = ''
const png = (width = 1200, height = 800) =>
  sharp({ create: { width, height, channels: 3, background: '#c33' } })
    .png()
    .toBuffer()

/** Envia um arquivo pelo endpoint real (multipart, CSRF e sessão). */
async function send(client: Client, user: User, name: string, data: Buffer | string) {
  const file = join(dir, name)
  await writeFile(file, data)
  return client.post('/admin/media').withCsrfToken().loginAs(user).file('file', file)
}

/** GET real (fetch) para inspecionar bytes: o cliente do Japa só expõe corpo JSON/texto. */
async function raw(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`http://${env.get('HOST')}:${env.get('PORT')}${path}`, { headers })
  const body = Buffer.from(await res.arrayBuffer())
  return { status: res.status, header: (k: string) => res.headers.get(k), body }
}

// MP4 mínimo: caixa `ftyp` com a marca isom (suficiente para a assinatura do arquivo).
const mp4 = () =>
  Buffer.concat([
    Buffer.from('0000001866747970 69736f6d 00000200 69736f6d 6d703431'.replace(/ /g, ''), 'hex'),
    Buffer.alloc(400, 1),
  ])

// Contêiner QuickTime (`ftyp qt  `), como o vídeo do site e gravações de celular.
const quicktime = () =>
  Buffer.concat([
    Buffer.from('0000001466747970717420200000000071742020', 'hex'),
    Buffer.alloc(300, 2),
  ])

test.group('Mídia · biblioteca', (group) => {
  group.setup(async () => {
    dir = await mkdtemp(join(tmpdir(), 'media-test-'))
  })
  group.teardown(async () => {
    await rm(dir, { recursive: true, force: true })
    await rm(app.makePath('tmp/media-test'), { recursive: true, force: true })
  })
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('permissões: sem sessão 401; viewer 403; sem CSRF 403; editor envia', async ({ client }) => {
    const viewer = await makeUser('viewer')
    const editor = await makeUser('editor')
    ;(await client.get('/admin/media')).assertStatus(401)
    ;(await client.get('/admin/media').loginAs(viewer)).assertStatus(403)
    ;(await send(client, viewer, 'a.png', await png())).assertStatus(403)
    const noCsrf = await client
      .post('/admin/media')
      .loginAs(editor)
      .file(
        'file',
        await (async () => {
          const f = join(dir, 'csrf.png')
          await writeFile(f, await png(40, 40))
          return f
        })()
      )
    noCsrf.assertStatus(403)
    ;(await send(client, editor, 'ok.png', await png(40, 40))).assertStatus(201)
  })

  test('imagem: grava original, derivados webp/avif e responde com o caminho público', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const res = await send(client, editor, 'foto grande.png', await png(2400, 1600))
    res.assertStatus(201)
    const body = res.body()
    assert.match(body.id, /^[0-9a-f]{32}$/)
    assert.equal(body.path, `/media/${body.id}`)
    assert.equal(body.kind, 'image')
    assert.equal(body.mime, 'image/png')
    assert.equal(body.width, 2400)
    assert.equal(body.height, 1600)
    assert.equal(body.name, 'foto grande.png')
    assert.isFalse(body.inUse)
    const variants = await db.from('media_variants').where('asset_id', body.id).orderBy('width')
    // 320, 640, 960, 1440 e o topo de 2048, em dois formatos; nunca maior que a original nem o teto.
    assert.deepEqual([...new Set(variants.map((v) => v.width))], [320, 640, 960, 1440, 2048])
    assert.deepEqual([...new Set(variants.map((v) => v.format))].sort(), ['avif', 'webp'])
    const audit = await db.from('audit_logs').where('action', 'media.upload').first()
    assert.isOk(audit)
    assert.notInclude(JSON.stringify(audit), 'foto grande')
  })

  test('imagem pequena não gera derivado maior que ela', async ({ client, assert }) => {
    const editor = await makeUser('editor')
    const res = await send(client, editor, 'p.png', await png(500, 300))
    res.assertStatus(201)
    const variants = await db.from('media_variants').where('asset_id', res.body().id)
    assert.deepEqual(
      [...new Set(variants.map((v) => v.width))].sort((a, b) => a - b),
      [320, 500]
    )
  })

  test('recusa arquivo disfarçado, SVG, corrompido, vazio e grande demais', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const fake = await send(client, editor, 'falso.png', '<html><script>alert(1)</script></html>')
    fake.assertStatus(422)
    assert.equal(fake.body().code, 'unsupported_type')
    const svg = await send(
      client,
      editor,
      'x.svg',
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    )
    svg.assertStatus(422)
    assert.equal(svg.body().code, 'unsupported_type')
    const real = await png(100, 100)
    const broken = await send(
      client,
      editor,
      'quebrada.png',
      Buffer.concat([real.subarray(0, 60), Buffer.alloc(40, 7)])
    )
    broken.assertStatus(422)
    assert.include(['invalid_image', 'unsupported_type'], broken.body().code)
    ;(await send(client, editor, 'vazio.png', Buffer.alloc(0))).assertStatus(422)
    const huge = await send(
      client,
      editor,
      'enorme.png',
      Buffer.concat([real.subarray(0, 8), Buffer.alloc(16 * 1024 * 1024)])
    )
    assert.include([413, 422], huge.status())
    assert.equal(
      await db
        .from('media_assets')
        .count('* as n')
        .first()
        .then((r) => Number(r?.n)),
      0
    )
  })

  test('nome do arquivo não vira caminho nem marcação', async ({ client, assert }) => {
    const editor = await makeUser('editor')
    const f = join(dir, 'n.png')
    await writeFile(f, await png(60, 60))
    const res = await client
      .post('/admin/media')
      .withCsrfToken()
      .loginAs(editor)
      .file('file', f, { filename: '../../etc/passwd.png' })
    res.assertStatus(201)
    assert.equal(res.body().name, 'passwd.png')
  })

  test('entrega pública: formato por Accept, largura por ?w=, cache imutável e 304', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const { id } = (await send(client, editor, 'e.png', await png(2000, 1000))).body()

    const webp = await raw(`/media/${id}`, { accept: 'image/webp,*/*' })
    assert.equal(webp.status, 200)
    assert.equal(webp.header('content-type'), 'image/webp')
    assert.equal(webp.header('x-content-type-options'), 'nosniff')
    assert.include(webp.header('cache-control')!, 'immutable')
    assert.equal((await sharp(webp.body).metadata()).width, 2000)

    const avif = await raw(`/media/${id}?w=300`, { accept: 'image/avif,image/webp,*/*' })
    assert.equal(avif.header('content-type'), 'image/avif')
    assert.equal((await sharp(avif.body).metadata()).width, 320)

    const mid = await raw(`/media/${id}?w=700`, { accept: 'image/webp' })
    assert.equal((await sharp(mid.body).metadata()).width, 960)
    // `?w=` absurdo cai no maior derivado, nunca no original.
    const big = await raw(`/media/${id}?w=999999`, { accept: 'image/webp' })
    assert.equal((await sharp(big.body).metadata()).width, 2000)

    const cached = await raw(`/media/${id}`, {
      'accept': 'image/webp',
      'if-none-match': webp.header('etag')!,
    })
    assert.equal(cached.status, 304)
  })

  test('id inexistente ou malformado: 404', async ({ client }) => {
    ;(await client.get(`/media/${'0'.repeat(32)}`)).assertStatus(404)
    ;(await client.get('/media/../../etc/passwd')).assertStatus(404)
    ;(await client.get('/media/abc')).assertStatus(404)
  })

  test('vídeo: aceita MP4, serve com Range e recusa Range inválido', async ({ client, assert }) => {
    const editor = await makeUser('editor')
    const res = await send(client, editor, 'v.mp4', mp4())
    res.assertStatus(201)
    assert.equal(res.body().kind, 'video')
    assert.equal(res.body().mime, 'video/mp4')
    const { id } = res.body()
    const full = await raw(`/media/${id}`)
    assert.equal(full.status, 200)
    assert.equal(full.header('content-type'), 'video/mp4')
    assert.equal(full.header('accept-ranges'), 'bytes')
    assert.equal(full.body.length, mp4().length)
    const part = await raw(`/media/${id}`, { range: 'bytes=0-9' })
    assert.equal(part.status, 206)
    assert.match(part.header('content-range')!, /^bytes 0-9\//)
    assert.equal(part.body.length, 10)
    assert.equal((await raw(`/media/${id}`, { range: 'bytes=-5' })).body.length, 5)
    assert.equal((await raw(`/media/${id}`, { range: 'bytes=99999-' })).status, 416)
    assert.equal((await raw(`/media/${id}`, { range: 'lixo' })).status, 416)
  })

  test('vídeo QuickTime (.mov de celular) entra como MP4', async ({ client, assert }) => {
    const editor = await makeUser('editor')
    const res = await send(client, editor, 'celular.mov', quicktime())
    res.assertStatus(201)
    assert.equal(res.body().mime, 'video/mp4')
    assert.equal((await raw(`/media/${res.body().id}`)).header('content-type'), 'video/mp4')
  })

  test('listagem, detalhe e exclusão; arquivo em uso não pode ser excluído', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const a = (await send(client, editor, 'a.png', await png(80, 80))).body()
    const b = (await send(client, editor, 'b.png', await png(90, 90))).body()
    const list = await client.get('/admin/media?kind=image').loginAs(editor)
    list.assertStatus(200)
    assert.isAtLeast(list.body().total, 2)
    assert.equal(list.body().items[0].kind, 'image')
    ;(await client.get('/admin/media?kind=foto').loginAs(editor)).assertStatus(422)

    // Usa `a` como foto de um profissional: passa a bloquear a exclusão.
    const created = await client
      .post('/admin/professionals')
      .withCsrfToken()
      .loginAs(editor)
      .json({
        slug: `midia-${Date.now()}`,
        data: {
          name: 'Com Mídia',
          specialty: 'Hair',
          tagline: '',
          experienceYears: null,
          instagramHandle: '',
          instagramFollowers: '',
          instagramUrl: '',
          portraitSrc: a.path,
          cardPhotoSrc: '',
          bio: [],
          works: [],
          videoSrc: '',
          metaDescription: '',
        },
      })
    created.assertStatus(201)
    const detail = await client.get(`/admin/media/${a.id}`).loginAs(editor)
    assert.equal(detail.body().usages[0].type, 'professional')
    assert.isTrue(detail.body().asset.inUse)
    const blocked = await client.delete(`/admin/media/${a.id}`).withCsrfToken().loginAs(editor)
    blocked.assertStatus(409)
    assert.equal(blocked.body().code, 'in_use')

    const gone = await client.delete(`/admin/media/${b.id}`).withCsrfToken().loginAs(editor)
    gone.assertStatus(204)
    ;(await client.get(`/media/${b.id}`)).assertStatus(404)
    assert.equal(
      await db
        .from('media_variants')
        .where('asset_id', b.id)
        .count('* as n')
        .first()
        .then((r) => Number(r?.n)),
      0
    )
    ;(await client.delete(`/admin/media/${b.id}`).withCsrfToken().loginAs(editor)).assertStatus(404)
    const viewer = await makeUser('viewer')
    ;(await client.delete(`/admin/media/${a.id}`).withCsrfToken().loginAs(viewer)).assertStatus(403)
  })

  test('mídia da biblioteca é aceita nos dados do cadastro e documentos; caminho solto não', async ({
    client,
  }) => {
    const editor = await makeUser('editor')
    const base = {
      name: 'Valida Mídia',
      specialty: 'Hair',
      tagline: '',
      experienceYears: null,
      instagramHandle: '',
      instagramFollowers: '',
      instagramUrl: '',
      cardPhotoSrc: '',
      bio: [],
      works: [],
      videoSrc: '',
      metaDescription: '',
    }
    const post = (portraitSrc: string) =>
      client
        .post('/admin/professionals')
        .withCsrfToken()
        .loginAs(editor)
        .json({
          slug: `m-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          data: { ...base, portraitSrc },
        })
    ;(await post(`/media/${'a'.repeat(32)}`)).assertStatus(201)
    ;(await post('/site/profissional/lukas_perfil.png')).assertStatus(201)
    ;(await post('/admin/professionals')).assertStatus(422)
    ;(await post('//evil.com/a.png')).assertStatus(422)
    ;(await post('https://cdn.nao-configurado.com/a.png')).assertStatus(422)
  })
})

test.group('Mídia · armazenamento local', () => {
  test('recusa chaves que saem da raiz ou fora do padrão', async ({ assert }) => {
    const root = await mkdtemp(join(tmpdir(), 'media-root-'))
    try {
      const storage = new LocalMediaStorage(root)
      for (const key of ['../x', 'a/../../x', '/etc/passwd', 'A/B', 'a//b', 'a b', '']) {
        await assert.rejects(() => storage.put(key, Buffer.from('x')), /inválida/)
      }
      await storage.put('ab/abc/1.webp', Buffer.from('x'))
      assert.equal(await storage.size('ab/abc/1.webp'), 1)
      await assert.rejects(() => storage.put('ab/abc/1.webp', Buffer.from('y')))
      await storage.delete('ab/abc/1.webp')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
