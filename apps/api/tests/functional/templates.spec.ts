/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).body()` mantém os testes legíveis */
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { makeUser } from '#tests/helpers'

type Client = import('@japa/api-client').ApiClient
type User = Awaited<ReturnType<typeof makeUser>>

const data = (name = 'Ana Souza') => ({
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
  works: [],
})

const section = (id: string, type: string, content: object) => ({
  id,
  type,
  schemaVersion: 1,
  visibility: { enabled: true },
  settings: {},
  content,
})

const hero = () =>
  section('hero', 'professional.hero', {
    eyebrow: 'Profissional / Academia Beauty',
    nameFirst: 'Ana',
    nameAccent: 'Souza.',
    sub: 'Técnica e carreira.',
    meta: [],
    portrait: { src: '/site/profissional/lukas_perfil.png', alt: 'Ana Souza' },
    hud: { label: 'Expert / Hair', accent: '10', value: 'anos' },
  })

const stats = () =>
  section('stats', 'professional.stats', {
    sectionIndex: '01 / NÚMEROS',
    title: 'Números de Ana.',
    items: [{ value: '10', label: 'anos de experiência' }],
  })

const cta = () =>
  section('cta', 'professional.cta', {
    sectionIndex: '05 / PRÓXIMO PASSO',
    title: 'Aprenda com Ana.',
    text: 'Conheça os cursos.',
    cta: { label: 'Ver cursos', href: '#cursos' },
  })

const doc = (templateKey: string, ...sections: object[]) => ({
  schemaVersion: 1,
  template: { key: templateKey, version: 1 },
  sections: sections.length ? sections : [hero(), stats(), cta()],
})

function api(client: Client, user: User) {
  const call = (method: 'post' | 'put', path: string, body?: object) => {
    const req = client[method](path).withCsrfToken().loginAs(user)
    return body ? req.json(body) : req
  }
  return {
    get: (path: string) => client.get(path).loginAs(user),
    post: (path: string, body?: object) => call('post', path, body),
    put: (path: string, body?: object) => call('put', path, body),
  }
}

let seq = 0
const slug = () => `modelo-${Date.now()}-${++seq}`

test.group('Modelos de página do profissional', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('criar com modelo; padrão Original; chave desconhecida é recusada', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const plain = await a.post('/admin/professionals', { slug: slug(), data: data() })
    plain.assertStatus(201)
    assert.equal(plain.body().templateKey, 'professional-original')
    const premium = await a.post('/admin/professionals', {
      slug: slug(),
      data: data(),
      templateKey: 'professional-premium',
    })
    premium.assertStatus(201)
    assert.equal(premium.body().templateKey, 'professional-premium')
    assert.equal(
      (await a.get(`/admin/professionals/${premium.body().id}`)).body().templateKey,
      'professional-premium'
    )
    ;(
      await a.post('/admin/professionals', {
        slug: slug(),
        data: data(),
        templateKey: 'curso-original',
      })
    ).assertStatus(422)
    ;(
      await a.post('/admin/professionals', {
        slug: slug(),
        data: data(),
        templateKey: 'professional-nao-existe',
      })
    ).assertStatus(422)
  })

  test('trocar de modelo no rascunho vale até personalizar no editor; depois exige restaurar', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const created = (await a.post('/admin/professionals', { slug: slug(), data: data() })).body()
    const id = created.id as number
    const changed = await a.put(`/admin/professionals/${id}`, {
      data: data(),
      revision: created.revision,
      templateKey: 'professional-authority',
    })
    changed.assertStatus(200)
    assert.equal(changed.body().templateKey, 'professional-authority')

    ;(
      await a.put(`/admin/professionals/${id}/document`, {
        document: doc('professional-authority'),
        revision: 0,
      })
    ).assertStatus(200)
    const locked = await a.put(`/admin/professionals/${id}`, {
      data: data(),
      revision: changed.body().revision,
      templateKey: 'professional-video',
    })
    locked.assertStatus(422)
    assert.equal(locked.body().code, 'template_locked')
    // Reenviar o mesmo modelo não é troca.
    ;(
      await a.put(`/admin/professionals/${id}`, {
        data: data(),
        revision: changed.body().revision,
        templateKey: 'professional-authority',
      })
    ).assertStatus(200)

    const state = (await a.get(`/admin/professionals/${id}/document`)).body()
    ;(
      await client
        .delete(`/admin/professionals/${id}/document`)
        .withCsrfToken()
        .loginAs(await makeUser('editor'))
        .json({ revision: state.documentRevision })
    ).assertStatus(200)
    const fresh = (await a.get(`/admin/professionals/${id}`)).body()
    ;(
      await a.put(`/admin/professionals/${id}`, {
        data: data(),
        revision: fresh.revision,
        templateKey: 'professional-video',
      })
    ).assertStatus(200)
  })

  test('o documento precisa ser do modelo do profissional; seções novas validam', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const id = (
      await a.post('/admin/professionals', {
        slug: slug(),
        data: data(),
        templateKey: 'professional-premium',
      })
    ).body().id as number
    const state = (await a.get(`/admin/professionals/${id}/document`)).body()
    assert.equal(state.templateKey, 'professional-premium')

    const wrong = await a.put(`/admin/professionals/${id}/document`, {
      document: doc('professional-original'),
      revision: 0,
    })
    wrong.assertStatus(422)
    assert.include(JSON.stringify(wrong.body()), 'professional-premium')
    ;(
      await a.put(`/admin/professionals/${id}/document`, {
        document: doc('course-original'),
        revision: 0,
      })
    ).assertStatus(422)
    ;(
      await a.put(`/admin/professionals/${id}/document`, {
        document: doc('professional-premium'),
        revision: 0,
      })
    ).assertStatus(200)

    // Conteúdo inválido nas seções novas: marcação, item demais, link perigoso e lista vazia.
    const bad = async (...sections: object[]) =>
      (
        await a.put(`/admin/professionals/${id}/document`, {
          document: doc('professional-premium', hero(), ...sections),
          revision: 1,
        })
      ).status()
    assert.equal(await bad({ ...stats(), content: { ...stats().content, title: '<b>x</b>' } }), 422)
    assert.equal(await bad({ ...stats(), content: { ...stats().content, items: [] } }), 422)
    assert.equal(
      await bad({
        ...stats(),
        content: {
          ...stats().content,
          items: Array.from({ length: 5 }, () => ({ value: '1', label: 'x' })),
        },
      }),
      422
    )
    assert.equal(
      await bad({
        ...cta(),
        content: { ...cta().content, cta: { label: 'x', href: 'javascript:alert(1)' } },
      }),
      422
    )
    assert.equal(await bad(stats(), { ...stats(), id: 'stats2' }), 422) // seção repetida
  })

  test('publicar grava o modelo no snapshot e a leitura pública o devolve', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const s = slug()
    const id = (
      await a.post('/admin/professionals', {
        slug: s,
        data: data(),
        templateKey: 'professional-conversion',
      })
    ).body().id as number
    ;(await a.post(`/admin/professionals/${id}/publish`)).assertStatus(200)
    const pub = (await client.get(`/public/professionals/${s}`)).body()
    assert.equal(pub.templateKey, 'professional-conversion')
    const v = await db.from('professional_versions').where('professional_id', id).first()
    assert.equal(v.template_key, 'professional-conversion')
  })

  test('restaurar uma versão devolve também o modelo dela', async ({ client, assert }) => {
    const a = api(client, await makeUser('editor'))
    const created = (await a.post('/admin/professionals', { slug: slug(), data: data() })).body()
    const id = created.id as number
    ;(await a.post(`/admin/professionals/${id}/publish`)).assertStatus(200) // versão 1: Original
    const afterPublish = (await a.get(`/admin/professionals/${id}`)).body()
    ;(
      await a.put(`/admin/professionals/${id}`, {
        data: data(),
        revision: afterPublish.revision,
        templateKey: 'professional-immersive',
      })
    ).assertStatus(200)
    ;(await a.post(`/admin/professionals/${id}/publish`)).assertStatus(200) // versão 2: Imersivo
    assert.equal(
      (await a.get(`/admin/professionals/${id}`)).body().templateKey,
      'professional-immersive'
    )

    const state = (await a.get(`/admin/professionals/${id}/document`)).body()
    const current = (await a.get(`/admin/professionals/${id}`)).body()
    ;(
      await a.post(`/admin/professionals/${id}/document/versions/1/restore`, {
        revision: state.documentRevision,
        dataRevision: current.revision,
      })
    ).assertStatus(200)
    assert.equal(
      (await a.get(`/admin/professionals/${id}`)).body().templateKey,
      'professional-original'
    )
  })
})
