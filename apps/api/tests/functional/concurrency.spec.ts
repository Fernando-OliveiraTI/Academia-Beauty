import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { makeUser } from '#tests/helpers'

type Client = import('@japa/api-client').ApiClient
type User = Awaited<ReturnType<typeof makeUser>>

/**
 * Concorrência real: sem a transação global dos outros specs, cada requisição usa a própria conexão
 * e os travos (`forUpdate`), a revisão otimista e os índices únicos são exercitados de verdade.
 * O banco de teste é limpo ao final de cada teste.
 */
const professionalData = () => ({
  name: 'Ana Souza',
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
    sub: 'Técnica.',
    meta: [],
    portrait: { src: '/site/profissional/lukas_perfil.png', alt: 'Ana' },
    hud: { label: 'Expert / Hair', accent: '10', value: 'anos' },
  })
const doc = (sub: string) => ({
  schemaVersion: 1,
  template: { key: 'professional-original', version: 1 },
  sections: [{ ...hero(), content: { ...hero().content, sub } }],
})

const api = (client: Client, user: User) => ({
  post: (path: string, body?: object) => {
    const req = client.post(path).withCsrfToken().loginAs(user)
    return body ? req.json(body) : req
  },
  put: (path: string, body: object) => client.put(path).withCsrfToken().loginAs(user).json(body),
})

let seq = 0
const slug = () => `conc-${Date.now()}-${++seq}`

test.group('Concorrência real', (group) => {
  group.each.teardown(() => testUtils.db().truncate())

  test('dois salvamentos de documento com a mesma revisão: exatamente um vence, o outro recebe 409', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const created = await a.post('/admin/professionals', { slug: slug(), data: professionalData() })
    created.assertStatus(201)
    const id = created.body().id as number

    const [r1, r2] = await Promise.all([
      a.put(`/admin/professionals/${id}/document`, { document: doc('versão A'), revision: 0 }),
      a.put(`/admin/professionals/${id}/document`, { document: doc('versão B'), revision: 0 }),
    ])
    assert.sameMembers([r1.status(), r2.status()], [200, 409])
    const row = await db.from('professionals').where('id', id).first()
    assert.equal(row.document_revision, 1)
  })

  test('publicações simultâneas geram versões 1 e 2, sem duplicata nem erro', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const created = await a.post('/admin/professionals', { slug: slug(), data: professionalData() })
    const id = created.body().id as number
    const results = await Promise.all([
      a.post(`/admin/professionals/${id}/publish`),
      a.post(`/admin/professionals/${id}/publish`),
    ])
    assert.deepEqual(
      results.map((r) => r.status()),
      [200, 200]
    )
    const versions = await db
      .from('professional_versions')
      .where('professional_id', id)
      .orderBy('version')
    assert.deepEqual(
      versions.map((v) => v.version),
      [1, 2]
    )
  })

  test('dois cadastros com o mesmo slug ao mesmo tempo: um 201 e um 409 (nunca 500)', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const s = slug()
    const results = await Promise.all([
      a.post('/admin/professionals', { slug: s, data: professionalData() }),
      a.post('/admin/professionals', { slug: s, data: professionalData() }),
    ])
    assert.sameMembers(
      results.map((r) => r.status()),
      [201, 409]
    )
  })

  test('salvar o cadastro e salvar o documento em paralelo não se anulam (revisões independentes)', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const created = await a.post('/admin/professionals', { slug: slug(), data: professionalData() })
    const id = created.body().id as number
    const [saveData, saveDoc] = await Promise.all([
      a.put(`/admin/professionals/${id}`, {
        data: { ...professionalData(), tagline: 'Novo' },
        revision: 1,
      }),
      a.put(`/admin/professionals/${id}/document`, { document: doc('paralelo'), revision: 0 }),
    ])
    assert.equal(saveData.status(), 200)
    assert.equal(saveDoc.status(), 200)
    const row = await db.from('professionals').where('id', id).first()
    assert.equal(row.revision, 2)
    assert.equal(row.document_revision, 1)
  })
})
