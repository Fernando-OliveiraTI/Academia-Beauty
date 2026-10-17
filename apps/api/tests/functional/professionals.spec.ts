/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).body()` mantém os testes legíveis */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { makeUser } from '#tests/helpers'
import RevalidationService from '#services/revalidation_service'

const complete = (name = 'Ana Souza') => ({
  name,
  specialty: 'Hair',
  tagline: 'Técnica e carreira.',
  experienceYears: 10,
  instagramHandle: '@ana',
  instagramFollowers: '10 mil',
  instagramUrl: 'https://instagram.com/ana',
  portraitSrc: '/site/profissional/lukas_perfil.png',
  cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: ['Trajetória de dez anos.'],
  works: [
    {
      imageSrc: '/site/profissional/trabLukas01.png',
      alt: 'Trabalho',
      title: 'Morena',
      tags: ['mechas'],
    },
  ],
})

let seq = 0
const slug = () => `profissional-${Date.now()}-${++seq}`

test.group('Profissionais · permissões', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('sem sessão: 401; viewer lê mas não escreve nem publica', async ({ client }) => {
    const viewer = await makeUser('viewer')
    ;(await client.get('/admin/professionals')).assertStatus(401)
    ;(await client.get('/admin/professionals').loginAs(viewer)).assertStatus(200)
    ;(
      await client
        .post('/admin/professionals')
        .withCsrfToken()
        .loginAs(viewer)
        .json({ slug: slug(), data: complete() })
    ).assertStatus(403)
    ;(
      await client.post('/admin/professionals/1/publish').withCsrfToken().loginAs(viewer)
    ).assertStatus(403)
  })

  test('escrita exige token CSRF', async ({ client }) => {
    const editor = await makeUser('editor')
    const res = await client
      .post('/admin/professionals')
      .loginAs(editor)
      .json({ slug: slug(), data: complete() })
    res.assertStatus(403)
  })
})

test.group('Profissionais · cadastro', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('cria rascunho, audita e rejeita slug duplicado', async ({ client, assert }) => {
    const editor = await makeUser('editor')
    const s = slug()
    const created = await client
      .post('/admin/professionals')
      .withCsrfToken()
      .loginAs(editor)
      .json({ slug: s, data: complete() })
    created.assertStatus(201)
    assert.equal(created.body().status, 'draft')
    assert.equal(created.body().revision, 1)
    assert.deepEqual(created.body().readiness, [])
    // Tipos do contrato: booleanos de verdade (não 0/1 do MySQL) mesmo após reler do banco.
    const reread = await client.get(`/admin/professionals/${created.body().id}`).loginAs(editor)
    assert.isBoolean(reread.body().homeVisible)
    assert.isBoolean(reread.body().featured)
    const audit = await db.from('audit_logs').where('action', 'professional.create').first()
    assert.isOk(audit)

    const dup = await client
      .post('/admin/professionals')
      .withCsrfToken()
      .loginAs(editor)
      .json({ slug: s, data: complete('Outra Pessoa') })
    dup.assertStatus(409)
    assert.equal(dup.body().code, 'slug_taken')
  })

  test('aceita o payload mínimo do assistente (campos opcionais vazios como "")', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const res = await client
      .post('/admin/professionals')
      .withCsrfToken()
      .loginAs(editor)
      .json({
        slug: slug(),
        data: {
          name: 'Mínimo Válido',
          specialty: 'Barber',
          tagline: '',
          experienceYears: null,
          instagramHandle: '',
          instagramFollowers: '',
          instagramUrl: '',
          portraitSrc: '',
          cardPhotoSrc: '',
          bio: [],
          works: [],
          videoSrc: '',
          metaDescription: '',
        },
      })
    res.assertStatus(201)
    assert.isAbove(res.body().readiness.length, 0)
  })

  test('valida entrada: slug reservado, marcação e URL perigosa (422)', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const post = (body: unknown) =>
      client
        .post('/admin/professionals')
        .withCsrfToken()
        .loginAs(editor)
        .json(body as object)

    ;(await post({ slug: 'admin', data: complete() })).assertStatus(422)
    ;(
      await post({ slug: slug(), data: { ...complete(), name: '<script>x</script>' } })
    ).assertStatus(422)
    const bad = await post({
      slug: slug(),
      data: { ...complete(), portraitSrc: 'javascript:alert(1)' },
    })
    bad.assertStatus(422)
    assert.include(
      bad.body().errors.map((e: { field: string }) => e.field),
      'data.portraitSrc'
    )
  })

  test('atualização usa concorrência otimista e bloqueia slug após publicar', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const s = slug()
    const created = await client
      .post('/admin/professionals')
      .withCsrfToken()
      .loginAs(editor)
      .json({ slug: s, data: complete() })
    const { id } = created.body()
    const put = (body: object) =>
      client.put(`/admin/professionals/${id}`).withCsrfToken().loginAs(editor).json(body)

    const ok = await put({ data: complete('Ana Souza Lima'), revision: 1 })
    ok.assertStatus(200)
    assert.equal(ok.body().revision, 2)
    assert.equal(ok.body().data.name, 'Ana Souza Lima')

    const stale = await put({ data: complete('Outro'), revision: 1 })
    stale.assertStatus(409)
    assert.equal(stale.body().code, 'revision_conflict')

    ;(await put({ slug: `${s}-novo`, data: complete(), revision: 2 })).assertStatus(200)
    ;(
      await client.post(`/admin/professionals/${id}/publish`).withCsrfToken().loginAs(editor)
    ).assertStatus(200)
    const locked = await put({ slug: `${s}-outro`, data: complete(), revision: 3 })
    locked.assertStatus(422)
    assert.equal(locked.body().code, 'slug_locked')
  })

  test('lista com filtro e arquivados fora por padrão', async ({ client, assert }) => {
    const editor = await makeUser('editor')
    const a = await client
      .post('/admin/professionals')
      .withCsrfToken()
      .loginAs(editor)
      .json({ slug: slug(), data: complete('Zeferina Unica') })
    const b = await client
      .post('/admin/professionals')
      .withCsrfToken()
      .loginAs(editor)
      .json({ slug: slug(), data: complete('Bernardo Arquivado') })
    await client.post(`/admin/professionals/${b.body().id}/archive`).withCsrfToken().loginAs(editor)

    const list = await client.get('/admin/professionals?q=Zeferina').loginAs(editor)
    assert.deepEqual(
      list.body().items.map((i: { id: number }) => i.id),
      [a.body().id]
    )
    const all = await client.get('/admin/professionals').loginAs(editor)
    assert.notInclude(
      all.body().items.map((i: { id: number }) => i.id),
      b.body().id
    )
    const archived = await client.get('/admin/professionals?status=archived').loginAs(editor)
    assert.include(
      archived.body().items.map((i: { id: number }) => i.id),
      b.body().id
    )
    ;(await client.get('/admin/professionals?q=%25')).assertStatus(401)
    const wild = await client.get('/admin/professionals?q=%25').loginAs(editor)
    assert.equal(wild.body().items.length, 0) // % é literal, não curinga
  })
})

test.group('Profissionais · publicação e vitrine', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function createDraft(client: any, editor: any, data = complete(), s = slug()) {
    const res = await client
      .post('/admin/professionals')
      .withCsrfToken()
      .loginAs(editor)
      .json({ slug: s, data })
    return { id: res.body().id as number, slug: s }
  }

  test('não publica cadastro incompleto e informa o que falta', async ({ client, assert }) => {
    const editor = await makeUser('editor')
    const { id } = await createDraft(client, editor, {
      name: 'Sem Dados',
      specialty: 'Hair',
    } as never)
    const res = await client
      .post(`/admin/professionals/${id}/publish`)
      .withCsrfToken()
      .loginAs(editor)
    res.assertStatus(422)
    assert.equal(res.body().code, 'not_ready')
    assert.include(
      res.body().errors.map((e: { field: string }) => e.field),
      'portraitSrc'
    )
  })

  test('rascunho não aparece no público; publicado aparece; edição não vaza até republicar', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const { id, slug: s } = await createDraft(client, editor)
    ;(await client.get(`/public/professionals/${s}`)).assertStatus(404)

    const pub = await client
      .post(`/admin/professionals/${id}/publish`)
      .withCsrfToken()
      .loginAs(editor)
    pub.assertStatus(200)
    assert.equal(pub.body().status, 'published')
    assert.equal(pub.body().publishedVersion, 1)
    assert.isFalse(pub.body().hasUnpublishedChanges)
    const first = await client.get(`/public/professionals/${s}`)
    first.assertStatus(200)
    assert.equal(first.body().data.name, 'Ana Souza')

    const edited = await client
      .put(`/admin/professionals/${id}`)
      .withCsrfToken()
      .loginAs(editor)
      .json({ data: complete('Ana Editada'), revision: pub.body().revision })
    assert.isTrue(edited.body().hasUnpublishedChanges)
    assert.equal((await client.get(`/public/professionals/${s}`)).body().data.name, 'Ana Souza')

    const again = await client
      .post(`/admin/professionals/${id}/publish`)
      .withCsrfToken()
      .loginAs(editor)
    assert.equal(again.body().publishedVersion, 2)
    assert.equal((await client.get(`/public/professionals/${s}`)).body().data.name, 'Ana Editada')
    const versions = await db
      .from('professional_versions')
      .where('professional_id', id)
      .orderBy('version')
    assert.lengthOf(versions, 2) // histórico preservado
    assert.include(
      await db
        .from('audit_logs')
        .where('action', 'professional.publish')
        .select('action')
        .then((r) => r.map((x) => x.action)),
      'professional.publish'
    )
  })

  test('despublicar e arquivar tiram do público; restaurar volta a rascunho', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const { id, slug: s } = await createDraft(client, editor)
    await client.post(`/admin/professionals/${id}/publish`).withCsrfToken().loginAs(editor)
    ;(await client.get(`/public/professionals/${s}`)).assertStatus(200)

    const un = await client
      .post(`/admin/professionals/${id}/unpublish`)
      .withCsrfToken()
      .loginAs(editor)
    assert.equal(un.body().status, 'draft')
    ;(await client.get(`/public/professionals/${s}`)).assertStatus(404)

    await client.post(`/admin/professionals/${id}/publish`).withCsrfToken().loginAs(editor)
    const ar = await client
      .post(`/admin/professionals/${id}/archive`)
      .withCsrfToken()
      .loginAs(editor)
    assert.equal(ar.body().status, 'archived')
    ;(await client.get(`/public/professionals/${s}`)).assertStatus(404)
    ;(
      await client.post(`/admin/professionals/${id}/publish`).withCsrfToken().loginAs(editor)
    ).assertStatus(422)

    const re = await client
      .post(`/admin/professionals/${id}/restore`)
      .withCsrfToken()
      .loginAs(editor)
    assert.equal(re.body().status, 'draft')
    ;(
      await client.post(`/admin/professionals/${id}/unpublish`).withCsrfToken().loginAs(editor)
    ).assertStatus(422)
  })

  test('vitrine da Home: só publicados com home_visible, ordenados', async ({ client, assert }) => {
    const editor = await makeUser('editor')
    const mk = async (name: string) => {
      const d = await createDraft(client, editor, complete(name))
      await client.post(`/admin/professionals/${d.id}/publish`).withCsrfToken().loginAs(editor)
      return d
    }
    const showcase = (id: number, homeVisible: boolean, homeOrder: number) =>
      client
        .put(`/admin/professionals/${id}/showcase`)
        .withCsrfToken()
        .loginAs(editor)
        .json({ homeVisible, homeOrder, featured: false })

    const b = await mk('Bia Segunda')
    const a = await mk('Ada Primeira')
    const hidden = await mk('Caio Oculto')
    const draft = await createDraft(client, editor, complete('Dora Rascunho'))

    ;(await showcase(b.id, true, 20)).assertStatus(200)
    ;(await showcase(a.id, true, 10)).assertStatus(200)
    ;(await showcase(hidden.id, false, 5)).assertStatus(200)
    ;(await showcase(draft.id, true, 1)).assertStatus(200) // marcado, mas não publicado

    const names = (await client.get('/public/professionals'))
      .body()
      .items.map((i: { name: string }) => i.name)
    assert.deepEqual(names, ['Ada Primeira', 'Bia Segunda'])
    const item = (await client.get('/public/professionals')).body().items[0]
    assert.deepEqual(Object.keys(item).sort(), ['cardPhotoSrc', 'name', 'slug'])

    await client.post(`/admin/professionals/${a.id}/unpublish`).withCsrfToken().loginAs(editor)
    const after = (await client.get('/public/professionals'))
      .body()
      .items.map((i: { name: string }) => i.name)
    assert.deepEqual(after, ['Bia Segunda'])
  })

  test('endpoint público não expõe campos internos e rejeita slug malformado', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const { id, slug: s } = await createDraft(client, editor)
    await client.post(`/admin/professionals/${id}/publish`).withCsrfToken().loginAs(editor)
    const body = (await client.get(`/public/professionals/${s}`)).body()
    for (const hidden of ['id', 'revision', 'createdBy', 'updatedBy', 'status'])
      assert.notProperty(body, hidden)
    ;(await client.get('/public/professionals/..%2Fetc')).assertStatus(404)
    ;(await client.get("/public/professionals/x'%20or%201=1")).assertStatus(404)
  })
})

test.group('Revalidação do site', () => {
  test('envia tags e segredo; falha do site não lança', async ({ assert }) => {
    const received: { secret?: string; body?: string }[] = []
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        received.push({ secret: req.headers['x-revalidate-secret'] as string, body })
        res.statusCode = 200
        res.end('{}')
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as AddressInfo).port
    const originalGet = env.get.bind(env)
    ;(env as any).get = (key: string, ...rest: unknown[]) =>
      key === 'REVALIDATE_URL'
        ? `http://127.0.0.1:${port}/r`
        : key === 'REVALIDATE_SECRET'
          ? 'segredo-de-teste-com-mais-de-24'
          : (originalGet as any)(key, ...rest)
    try {
      await RevalidationService.revalidate(['professionals', 'professional:ana'])
      assert.equal(received[0]?.secret, 'segredo-de-teste-com-mais-de-24')
      assert.deepEqual(JSON.parse(received[0]!.body!), {
        tags: ['professionals', 'professional:ana'],
      })

      await new Promise((resolve) => server.close(resolve))
      await RevalidationService.revalidate(['professionals']) // servidor fora do ar: não lança
    } finally {
      ;(env as any).get = originalGet
    }
  })
})
