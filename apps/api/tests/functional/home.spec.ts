/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).body()` mantém os testes legíveis */
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { makeUser } from '#tests/helpers'

type Client = import('@japa/api-client').ApiClient
type User = Awaited<ReturnType<typeof makeUser>>

const section = (id: string, type: string, content: object) => ({
  id,
  type,
  schemaVersion: 1,
  visibility: { enabled: true },
  settings: {},
  content,
})

const hero = (title = 'Aprenda e cresça') =>
  section('hero', 'home.hero', {
    kicker: 'Academia Beauty / Educação',
    titleLead: title,
    titleOutline: 'com os melhores.',
    copy: [{ text: 'Falta pouco para transformar a sua carreira.' }],
    cta: { label: 'Quero aprender', href: '#cursos-home' },
    miniProof: 'conteúdo • técnica • evolução',
    image: { src: '/site/home/elenco-hero.png', alt: 'Profissionais' },
  })

const cta = (title = 'Faça seu talento virar carreira.') =>
  section('cta', 'home.cta', {
    outlineWord: 'CARREIRA',
    eyebrow: '05 / Seu próximo movimento',
    title,
    text: 'Escolha um curso.',
    cta: { label: 'Quero aprender', href: '#cursos-home' },
  })

const homeDoc = (...sections: object[]) => ({
  schemaVersion: 1,
  template: { key: 'home-original', version: 1 },
  sections: sections.length ? sections : [hero(), cta()],
})

function api(client: Client, user: User) {
  const call = (method: 'post' | 'put' | 'delete', path: string, body?: object) => {
    const req = client[method](path).withCsrfToken().loginAs(user)
    return body ? req.json(body) : req
  }
  return {
    get: (path: string) => client.get(path).loginAs(user),
    post: (path: string, body?: object) => call('post', path, body),
    put: (path: string, body?: object) => call('put', path, body),
    delete: (path: string, body?: object) => call('delete', path, body),
  }
}

let seq = 0
const slug = (p: string) => `${p}-${Date.now()}-${++seq}`

test.group('Home · documento e publicação', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('permissões: sem sessão 401; viewer lê, não escreve nem publica; editor faz tudo', async ({
    client,
    assert,
  }) => {
    const viewer = await makeUser('viewer')
    const editor = await makeUser('editor')
    ;(await client.get('/admin/home/document')).assertStatus(401)
    ;(await client.get('/admin/home').loginAs(viewer)).assertStatus(200)
    ;(await client.get('/admin/home/document').loginAs(viewer)).assertStatus(200)
    const v = api(client, viewer)
    ;(await v.put('/admin/home/document', { document: homeDoc(), revision: 0 })).assertStatus(403)
    ;(await v.delete('/admin/home/document', { revision: 0 })).assertStatus(403)
    ;(await v.post('/admin/home/publish')).assertStatus(403)
    // Sem CSRF mesmo logado: recusado.
    ;(
      await client
        .put('/admin/home/document')
        .loginAs(editor)
        .json({ document: homeDoc(), revision: 0 })
    ).assertStatus(403)
    const e = api(client, editor)
    ;(await e.put('/admin/home/document', { document: homeDoc(), revision: 0 })).assertStatus(200)
    assert.equal((await e.get('/admin/home')).body().documentRevision, 1)
  })

  test('estado inicial: sem documento nem versão; a Home pública cai no template', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const state = (await api(client, editor).get('/admin/home/document')).body()
    assert.isNull(state.document)
    assert.equal(state.documentRevision, 0)
    assert.equal(state.templateKey, 'home-original')
    const pub = (await client.get('/public/home')).body()
    assert.isNull(pub.version)
    assert.isNull(pub.document)
    assert.isArray(pub.professionals)
    assert.isArray(pub.courses)
  })

  test('salvar valida o documento (422), exige a revisão (409) e não toca o site', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const e = api(client, editor)
    const saved = await e.put('/admin/home/document', { document: homeDoc(), revision: 0 })
    saved.assertStatus(200)
    assert.equal(saved.body().documentRevision, 1)
    ;(
      await e.put('/admin/home/document', { document: homeDoc(hero('Outro')), revision: 0 })
    ).assertStatus(409)
    ;(
      await e.put('/admin/home/document', { document: homeDoc(hero('Outro')), revision: 1 })
    ).assertStatus(200)

    // Sem a seção obrigatória (hero), seção repetida, seção de outro template, HTML e URL perigosa.
    const bad = async (doc: unknown) =>
      (await e.put('/admin/home/document', { document: doc, revision: 2 })).status()
    assert.equal(await bad(homeDoc(cta())), 422)
    assert.equal(await bad(homeDoc(hero(), { ...cta(), id: 'cta2' }, cta())), 422)
    assert.equal(await bad(homeDoc(hero(), section('x', 'professional.bio', {}))), 422)
    assert.equal(await bad(homeDoc(hero('<script>x</script>'))), 422)
    assert.equal(
      await bad({ ...homeDoc(), template: { key: 'professional-original', version: 1 } }),
      422
    )
    assert.equal(
      await bad(
        homeDoc({
          ...hero(),
          content: { ...hero().content, cta: { label: 'x', href: 'javascript:alert(1)' } },
        })
      ),
      422
    )
    assert.equal((await client.get('/public/home')).body().version, null)
  })

  test('publicar grava snapshot imutável; o rascunho seguinte não altera o público', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const e = api(client, editor)
    ;(
      await e.put('/admin/home/document', { document: homeDoc(hero('Primeira')), revision: 0 })
    ).assertStatus(200)
    assert.isTrue((await e.get('/admin/home')).body().hasUnpublishedChanges)
    ;(await e.post('/admin/home/publish')).assertStatus(200)
    let pub = (await client.get('/public/home')).body()
    assert.equal(pub.version, 1)
    assert.equal(pub.document.sections[0].content.titleLead, 'Primeira')
    assert.isFalse((await e.get('/admin/home')).body().hasUnpublishedChanges)

    ;(
      await e.put('/admin/home/document', { document: homeDoc(hero('Segunda')), revision: 1 })
    ).assertStatus(200)
    pub = (await client.get('/public/home')).body()
    assert.equal(pub.document.sections[0].content.titleLead, 'Primeira')
    assert.isTrue((await e.get('/admin/home')).body().hasUnpublishedChanges)

    ;(await e.post('/admin/home/publish')).assertStatus(200)
    assert.equal((await client.get('/public/home')).body().version, 2)
    const versions = (await e.get('/admin/home/document/versions')).body().items
    assert.deepEqual(
      versions.map((v: { version: number }) => v.version),
      [2, 1]
    )
    assert.isTrue(versions[0].current)
    // O snapshot 1 continua com o texto original.
    const v1 = await db.from('home_versions').where('version', 1).first()
    const parsed = typeof v1.document === 'string' ? JSON.parse(v1.document) : v1.document
    assert.equal(parsed.sections[0].content.titleLead, 'Primeira')
    assert.isOk(await db.from('audit_logs').where('action', 'home.publish').first())
  })

  test('restaurar versão e voltar ao padrão (DELETE) respeitam a revisão', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const e = api(client, editor)
    ;(
      await e.put('/admin/home/document', { document: homeDoc(hero('Primeira')), revision: 0 })
    ).assertStatus(200)
    ;(await e.post('/admin/home/publish')).assertStatus(200)
    ;(
      await e.put('/admin/home/document', { document: homeDoc(hero('Rascunho')), revision: 1 })
    ).assertStatus(200)

    ;(await e.post('/admin/home/document/versions/1/restore', { revision: 0 })).assertStatus(409)
    ;(await e.post('/admin/home/document/versions/9/restore', { revision: 2 })).assertStatus(404)
    ;(await e.post('/admin/home/document/versions/1/restore', { revision: 2 })).assertStatus(200)
    const restored = (await e.get('/admin/home/document')).body()
    assert.equal(restored.document.sections[0].content.titleLead, 'Primeira')

    ;(await e.delete('/admin/home/document', { revision: 0 })).assertStatus(409)
    ;(await e.delete('/admin/home/document', { revision: restored.documentRevision })).assertStatus(
      200
    )
    assert.isNull((await e.get('/admin/home/document')).body().document)
    // Publicar sem documento: a Home pública volta ao template (documento nulo no snapshot).
    ;(await e.post('/admin/home/publish')).assertStatus(200)
    assert.isNull((await client.get('/public/home')).body().document)
  })

  test('vitrine de cursos: só publicado, marcado para a vitrine e de profissional publicado', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const profSlug = slug('home-prof')
    const prof = await a.post('/admin/professionals', {
      slug: profSlug,
      data: {
        name: 'Ana Vitrine',
        specialty: 'Hair',
        tagline: 'Técnica.',
        experienceYears: 10,
        instagramHandle: '@ana',
        instagramFollowers: '10 mil',
        instagramUrl: 'https://instagram.com/ana',
        portraitSrc: '/site/profissional/lukas_perfil.png',
        cardPhotoSrc: '/site/home/lukas-campos.png',
        bio: ['Trajetória.'],
        works: [],
      },
    })
    prof.assertStatus(201)
    const professionalId = prof.body().id as number
    ;(await a.post(`/admin/professionals/${professionalId}/publish`)).assertStatus(200)

    const title = `Curso Vitrine ${seq}`
    const course = await a.post('/admin/courses', {
      professionalId,
      slug: slug('home-curso'),
      data: {
        title,
        lead: 'Resumo.',
        modality: 'online',
        level: 'profissional',
        workloadHours: 8,
        audience: 'Todos',
        coverSrc: '/site/curso/produto-morena-iluminada.svg',
        coverAlt: 'Capa',
        benefits: [{ title: 'Mais', text: 'Texto.' }],
        modules: [{ title: 'Módulo', text: 'Texto.', bullets: ['A'] }],
        deliverables: [{ title: 'Aulas', text: 'Texto.' }],
        faq: [],
        testimonials: [],
        guaranteeDays: null,
      },
    })
    course.assertStatus(201)
    const courseId = course.body().id as number
    ;(
      await a.put(`/admin/courses/${courseId}/commercial`, {
        listCents: 25000,
        discountPct: 0,
        maxInstallments: 6,
        checkoutUrl: 'https://pay.example.com/c/x',
        environment: 'production',
        active: true,
        revision: 0,
      })
    ).assertStatus(200)
    const home = async () =>
      (
        (await client.get('/public/home')).body().courses as {
          title: string
          person: string
          featured: boolean
          modality: string
        }[]
      ).filter((c) => c.title === title)

    assert.lengthOf(await home(), 0) // rascunho não aparece
    ;(await a.post(`/admin/courses/${courseId}/publish`)).assertStatus(200)
    // Curso publicado entra na vitrine por padrão; desmarcar tira da Home.
    assert.lengthOf(await home(), 1)
    ;(
      await a.put(`/admin/courses/${courseId}/showcase`, {
        showcaseVisible: false,
        showcaseOrder: 1,
        featured: false,
      })
    ).assertStatus(200)
    assert.lengthOf(await home(), 0)
    ;(
      await a.put(`/admin/courses/${courseId}/showcase`, {
        showcaseVisible: true,
        showcaseOrder: 1,
        featured: true,
      })
    ).assertStatus(200)
    const [card] = await home()
    assert.equal(card?.person, 'Ana Vitrine')
    assert.isTrue(card?.featured)
    assert.equal(card?.modality, 'online')

    ;(await a.post(`/admin/professionals/${professionalId}/unpublish`)).assertStatus(200)
    assert.lengthOf(await home(), 0) // profissional despublicado tira o curso da Home
  })

  test('mídia da biblioteca no documento da Home conta como uso', async ({ client, assert }) => {
    const editor = await makeUser('editor')
    const e = api(client, editor)
    const id = 'f'.repeat(32)
    await db.table('media_assets').insert({
      id,
      kind: 'image',
      original_name: 'x.png',
      mime: 'image/png',
      size: 10,
      width: 10,
      height: 10,
      sha256: '0'.repeat(64),
      storage_key: `ff/${id}/original.png`,
      created_by: editor.id,
      created_at: new Date(),
    })
    const doc = homeDoc(
      { ...hero(), content: { ...hero().content, image: { src: `/media/${id}`, alt: 'Foto' } } },
      cta()
    )
    ;(await e.put('/admin/home/document', { document: doc, revision: 0 })).assertStatus(200)
    const detail = (await client.get(`/admin/media/${id}`).loginAs(editor)).body()
    assert.isTrue(detail.asset.inUse)
    assert.equal(detail.usages[0].type, 'home')
    const blocked = await client.delete(`/admin/media/${id}`).withCsrfToken().loginAs(editor)
    blocked.assertStatus(409)
  })
})
