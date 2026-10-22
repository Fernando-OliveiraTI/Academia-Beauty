/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).body()` mantém os testes legíveis */
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { makeUser } from '#tests/helpers'

type Client = import('@japa/api-client').ApiClient
type User = Awaited<ReturnType<typeof makeUser>>

const professionalData = (name = 'Ana Souza') => ({
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

const courseData = () => ({
  title: 'Morena Iluminada',
  lead: 'A metodologia de corte para valorizar a cor.',
  modality: 'online',
  level: 'profissional',
  workloadHours: 8,
  audience: 'Cabeleireiros e coloristas',
  coverSrc: '/site/curso/produto-morena-iluminada.svg',
  coverAlt: 'Capa do curso',
  benefits: [{ title: 'Mais brilho', text: 'Cortes que realçam a cor.' }],
  modules: [{ title: 'Corte e cor', text: 'Leitura da coloração.', bullets: ['Diagnóstico'] }],
  deliverables: [{ title: 'Aulas', text: 'Método completo.' }],
  faq: [],
  testimonials: [],
  guaranteeDays: null,
})

const commercial = {
  listCents: 25000,
  discountPct: 30,
  maxInstallments: 6,
  checkoutUrl: 'https://pay.example.com/c/abc',
  environment: 'production',
  active: true,
  revision: 0,
}

let seq = 0
const slug = (p: string) => `${p}-${Date.now()}-${++seq}`

function api(client: Client, user: User) {
  const call = (method: 'post' | 'put', path: string, body?: object) => {
    const req = client[method](path).withCsrfToken().loginAs(user)
    return body ? req.json(body) : req
  }
  return {
    post: (path: string, body?: object) => call('post', path, body),
    put: (path: string, body?: object) => call('put', path, body),
  }
}

async function createProfessional(a: ReturnType<typeof api>, s: string) {
  const created = await a.post('/admin/professionals', { slug: s, data: professionalData() })
  created.assertStatus(201)
  return created.body().id as number
}

async function createCourse(a: ReturnType<typeof api>, professionalId: number, s: string) {
  const created = await a.post('/admin/courses', { professionalId, slug: s, data: courseData() })
  created.assertStatus(201)
  const id = created.body().id as number
  ;(await a.put(`/admin/courses/${id}/commercial`, commercial)).assertStatus(200)
  return id
}

test.group('Sitemap público', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('é público e traz só publicados, com data de atualização válida', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const publishedPro = slug('pro-pub')
    const draftPro = slug('pro-rasc')
    const publishedCourse = slug('curso-pub')
    const draftCourse = slug('curso-rasc')
    const courseOfDraftPro = slug('curso-prof-rasc')

    const proId = await createProfessional(a, publishedPro)
    ;(await a.post(`/admin/professionals/${proId}/publish`)).assertStatus(200)
    const draftProId = await createProfessional(a, draftPro)
    const courseId = await createCourse(a, proId, publishedCourse)
    ;(await a.post(`/admin/courses/${courseId}/publish`)).assertStatus(200)
    await createCourse(a, proId, draftCourse)
    await createCourse(a, draftProId, courseOfDraftPro)

    const res = await client.get('/public/sitemap')
    res.assertStatus(200)
    const body = res.body() as {
      professionals: { slug: string; lastmod: string }[]
      courses: { slug: string; lastmod: string }[]
    }
    assert.deepEqual(
      body.professionals.map((p) => p.slug),
      [publishedPro]
    )
    assert.deepEqual(
      body.courses.map((c) => c.slug),
      [publishedCourse]
    )
    for (const entry of [...body.professionals, ...body.courses]) {
      assert.isFalse(Number.isNaN(Date.parse(entry.lastmod)))
    }
  })

  test('sem nada publicado devolve listas vazias', async ({ client, assert }) => {
    const res = await client.get('/public/sitemap')
    res.assertStatus(200)
    assert.deepEqual(res.body(), { professionals: [], courses: [] })
  })
})
