/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).status` mantém os testes legíveis */
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import env from '#start/env'
import { makeUser } from '#tests/helpers'

type Client = import('@japa/api-client').ApiClient
type User = Awaited<ReturnType<typeof makeUser>>

const professionalData = (name: string) => ({
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

const courseData = (title: string) => ({ title, lead: 'Descrição do curso rascunho.' })

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

/** Profissional e curso em rascunho (com oferta inativa e sem checkout), ambos na vitrine. */
async function draftPair(client: Client) {
  const admin = await makeUser('admin')
  const a = api(client, admin)
  const proSlug = slug('prof')
  const pro = await a.post('/admin/professionals', {
    slug: proSlug,
    data: professionalData('Pessoa Rascunho'),
  })
  pro.assertStatus(201)
  const proId = pro.body().id as number
  ;(
    await a.put(`/admin/professionals/${proId}/showcase`, {
      homeVisible: true,
      homeOrder: 1,
      featured: false,
    })
  ).assertStatus(200)
  const courseSlug = slug('curso')
  const course = await a.post('/admin/courses', {
    professionalId: proId,
    slug: courseSlug,
    data: courseData('Curso Rascunho'),
  })
  course.assertStatus(201)
  const courseId = course.body().id as number
  ;(
    await a.put(`/admin/courses/${courseId}/commercial`, {
      listCents: 25000,
      discountPct: 30,
      maxInstallments: 6,
      checkoutUrl: '',
      environment: 'sandbox',
      active: false,
      revision: 0,
    })
  ).assertStatus(200)
  ;(
    await a.put(`/admin/courses/${courseId}/showcase`, {
      showcaseVisible: true,
      showcaseOrder: 1,
      featured: false,
    })
  ).assertStatus(200)
  return { proSlug, courseSlug }
}

test.group('Leitura pública · PUBLIC_SHOW_DRAFTS', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    env.set('PUBLIC_SHOW_DRAFTS', false)
    env.set('NODE_ENV', 'test')
  })

  test('desligada (padrão): rascunhos não aparecem', async ({ client }) => {
    env.set('PUBLIC_SHOW_DRAFTS', false)
    const { proSlug, courseSlug } = await draftPair(client)
    ;(await client.get(`/public/professionals/${proSlug}`)).assertStatus(404)
    ;(await client.get(`/public/courses/${courseSlug}`)).assertStatus(404)
    const showcase = await client.get('/public/professionals')
    showcase.assertStatus(200)
  })

  test('ligada fora de produção: rascunho aparece no perfil, na vitrine e na página do curso', async ({
    client,
    assert,
  }) => {
    env.set('PUBLIC_SHOW_DRAFTS', true)
    const { proSlug, courseSlug } = await draftPair(client)

    const profile = await client.get(`/public/professionals/${proSlug}`)
    profile.assertStatus(200)
    assert.deepEqual(
      profile.body().courses.map((c: { slug: string }) => c.slug),
      [courseSlug]
    )
    assert.equal(profile.body().courses[0].discountPct, 30)

    const showcase = await client.get('/public/professionals')
    assert.include(
      showcase.body().items.map((p: { slug: string }) => p.slug),
      proSlug
    )

    const course = await client.get(`/public/courses/${courseSlug}`)
    course.assertStatus(200)
    assert.equal(course.body().data.title, 'Curso Rascunho')
    assert.isNull(course.body().checkout.url)
    assert.equal(course.body().professional.slug, proSlug)
  })

  test('em produção a variável é ignorada: só publicados', async ({ client }) => {
    env.set('PUBLIC_SHOW_DRAFTS', true)
    const { proSlug, courseSlug } = await draftPair(client)
    env.set('NODE_ENV', 'production')
    ;(await client.get(`/public/professionals/${proSlug}`)).assertStatus(404)
    ;(await client.get(`/public/courses/${courseSlug}`)).assertStatus(404)
  })
})
