/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).body()` mantém os testes legíveis */
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
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
  works: [],
})

const courseData = (title = 'Morena Iluminada') => ({
  title,
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

const commercial = (over: Record<string, unknown> = {}) => ({
  listCents: 25000,
  discountPct: 30,
  maxInstallments: 6,
  checkoutUrl: 'https://pay.example.com/c/abc',
  environment: 'production',
  active: true,
  revision: 0,
  ...over,
})

let seq = 0
const slug = (p = 'curso') => `${p}-${Date.now()}-${++seq}`

/** Chamadas autenticadas com CSRF, no estilo dos testes de profissionais. */
function api(client: Client, user: User) {
  const call = (method: 'post' | 'put' | 'delete', path: string, body?: object) => {
    const req = client[method](path).withCsrfToken().loginAs(user)
    return body ? req.json(body) : req
  }
  return {
    get: (path: string) => client.get(path).loginAs(user),
    post: (path: string, body?: object) => call('post', path, body),
    put: (path: string, body?: object) => call('put', path, body),
    delete: (path: string) => call('delete', path),
  }
}

async function publishedProfessional(a: ReturnType<typeof api>) {
  const s = slug('prof')
  const created = await a.post('/admin/professionals', { slug: s, data: professionalData() })
  created.assertStatus(201)
  const id = created.body().id as number
  ;(await a.post(`/admin/professionals/${id}/publish`)).assertStatus(200)
  return { id, slug: s }
}

async function readyCourse(a: ReturnType<typeof api>, professionalId: number, s = slug()) {
  const created = await a.post('/admin/courses', { professionalId, slug: s, data: courseData() })
  created.assertStatus(201)
  const id = created.body().id as number
  ;(await a.put(`/admin/courses/${id}/commercial`, commercial())).assertStatus(200)
  return { id, slug: s }
}

test.group('Cursos · permissões', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('sem sessão 401; viewer lê mas não escreve, publica nem mexe na oferta', async ({
    client,
  }) => {
    const viewer = await makeUser('viewer')
    ;(await client.get('/admin/courses')).assertStatus(401)
    ;(await client.get('/admin/courses').loginAs(viewer)).assertStatus(200)
    const v = api(client, viewer)
    ;(
      await v.post('/admin/courses', { professionalId: 1, slug: slug(), data: courseData() })
    ).assertStatus(403)
    ;(await v.post('/admin/courses/1/publish')).assertStatus(403)
    ;(await v.put('/admin/courses/1/commercial', commercial())).assertStatus(403)
  })

  test('editor escreve e publica, mas não altera preço nem link de checkout (commerce.manage)', async ({
    client,
    assert,
  }) => {
    const editor = await makeUser('editor')
    const admin = await makeUser('admin')
    const e = api(client, editor)
    const professional = await publishedProfessional(e)
    const created = await e.post('/admin/courses', {
      professionalId: professional.id,
      slug: slug(),
      data: courseData(),
    })
    created.assertStatus(201)
    const id = created.body().id as number
    ;(await e.put(`/admin/courses/${id}/commercial`, commercial())).assertStatus(403)
    ;(await api(client, admin).put(`/admin/courses/${id}/commercial`, commercial())).assertStatus(
      200
    )
    // Com a oferta configurada pelo administrador, o editor publica.
    const published = await e.post(`/admin/courses/${id}/publish`)
    published.assertStatus(200)
    assert.equal(published.body().status, 'published')
  })

  test('escrita exige token CSRF', async ({ client }) => {
    const editor = await makeUser('editor')
    ;(
      await client
        .post('/admin/courses')
        .loginAs(editor)
        .json({ professionalId: 1, slug: slug(), data: courseData() })
    ).assertStatus(403)
  })
})

test.group('Cursos · cadastro e oferta', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('cria rascunho vinculado ao profissional, audita e rejeita slug duplicado e profissional inexistente', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const s = slug()
    const created = await a.post('/admin/courses', {
      professionalId: professional.id,
      slug: s,
      data: courseData(),
    })
    created.assertStatus(201)
    assert.equal(created.body().status, 'draft')
    assert.equal(created.body().professionalName, 'Ana Souza')
    assert.isNull(created.body().commercial)
    assert.isOk(await db.from('audit_logs').where('action', 'course.create').first())

    const dup = await a.post('/admin/courses', {
      professionalId: professional.id,
      slug: s,
      data: courseData('Outro'),
    })
    dup.assertStatus(409)
    assert.equal(dup.body().code, 'slug_taken')
    ;(
      await a.post('/admin/courses', { professionalId: 999999, slug: slug(), data: courseData() })
    ).assertStatus(404)
  })

  test('valida entrada: slug reservado, marcação e preço fora do limite (422)', async ({
    client,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    ;(
      await a.post('/admin/courses', {
        professionalId: professional.id,
        slug: 'admin',
        data: courseData(),
      })
    ).assertStatus(422)
    ;(
      await a.post('/admin/courses', {
        professionalId: professional.id,
        slug: slug(),
        data: { ...courseData(), title: '<script>x</script>' },
      })
    ).assertStatus(422)
    const { id } = await readyCourse(a, professional.id)
    for (const bad of [
      { listCents: 0 },
      { listCents: 1.5 },
      { discountPct: 95 },
      { maxInstallments: 13 },
      { listCents: -5 },
    ]) {
      ;(
        await a.put(`/admin/courses/${id}/commercial`, commercial({ ...bad, revision: 1 }))
      ).assertStatus(422)
    }
  })

  test('link de checkout: só https de domínio autorizado (Modo A)', async ({ client, assert }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const created = await a.post('/admin/courses', {
      professionalId: professional.id,
      slug: slug(),
      data: courseData(),
    })
    const id = created.body().id as number
    for (const url of [
      'http://pay.example.com/c',
      'https://evil.example.org/c',
      'https://pay.example.com.evil.org/c',
      'javascript:alert(1)',
      'https://user:pw@pay.example.com/c',
      'https://127.0.0.1/c',
    ]) {
      const res = await a.put(`/admin/courses/${id}/commercial`, commercial({ checkoutUrl: url }))
      res.assertStatus(422)
      assert.equal(res.body().code, 'checkout_url_invalid', url)
    }
    // Ativar sem link também é recusado.
    const noUrl = await a.put(
      `/admin/courses/${id}/commercial`,
      commercial({ checkoutUrl: '', active: true })
    )
    noUrl.assertStatus(422)
    // Sem link e inativa é um rascunho de oferta válido.
    ;(
      await a.put(`/admin/courses/${id}/commercial`, commercial({ checkoutUrl: '', active: false }))
    ).assertStatus(200)
  })

  test('oferta usa concorrência otimista e a auditoria não grava o link completo', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const { id } = await readyCourse(a, professional.id)
    const stale = await a.put(`/admin/courses/${id}/commercial`, commercial({ revision: 0 }))
    stale.assertStatus(409)
    assert.equal(stale.body().code, 'revision_conflict')
    const ok = await a.put(
      `/admin/courses/${id}/commercial`,
      commercial({
        revision: 1,
        listCents: 30000,
        checkoutUrl: 'https://pay.example.com/c/segredo-123',
      })
    )
    ok.assertStatus(200)
    assert.equal(ok.body().commercial.revision, 2)
    const logs = await db.from('audit_logs').where('action', 'course.commercial.update')
    assert.lengthOf(logs, 2)
    for (const log of logs) assert.notInclude(JSON.stringify(log.metadata), 'segredo-123')
    assert.include(JSON.stringify(logs[1]!.metadata), 'pay.example.com')
  })

  test('edição concorrente do conteúdo → 409; slug trava depois de publicar', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const { id } = await readyCourse(a, professional.id)
    ;(
      await a.put(`/admin/courses/${id}`, { data: courseData('Novo título'), revision: 1 })
    ).assertStatus(200)
    const conflict = await a.put(`/admin/courses/${id}`, { data: courseData('Outro'), revision: 1 })
    conflict.assertStatus(409)
    assert.equal(conflict.body().code, 'revision_conflict')
    ;(await a.post(`/admin/courses/${id}/publish`)).assertStatus(200)
    const locked = await a.put(`/admin/courses/${id}`, {
      slug: slug(),
      data: courseData(),
      revision: 2,
    })
    locked.assertStatus(422)
    assert.equal(locked.body().code, 'slug_locked')
  })
})

test.group('Cursos · publicação', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('publicar exige conteúdo, oferta e profissional publicado', async ({ client, assert }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const p = await a.post('/admin/professionals', { slug: slug('prof'), data: professionalData() })
    const draftProfessionalId = p.body().id as number
    const created = await a.post('/admin/courses', {
      professionalId: draftProfessionalId,
      slug: slug(),
      data: { title: 'Curso vazio' },
    })
    created.assertStatus(201)
    const id = created.body().id as number
    const res = await a.post(`/admin/courses/${id}/publish`)
    res.assertStatus(422)
    // O profissional não está publicado: a regra é a primeira a barrar.
    assert.equal(res.body().code, 'professional_not_published')

    ;(await a.post(`/admin/professionals/${draftProfessionalId}/publish`)).assertStatus(200)
    const incomplete = await a.post(`/admin/courses/${id}/publish`)
    incomplete.assertStatus(422)
    assert.equal(incomplete.body().code, 'not_ready')
    const fields = incomplete.body().errors.map((e: { field: string }) => e.field)
    assert.includeMembers(fields, [
      'lead',
      'coverSrc',
      'benefits',
      'modules',
      'deliverables',
      'commercial',
    ])
    // O rascunho de resposta também lista as pendências.
    const detail = await a.get(`/admin/courses/${id}`)
    assert.isAbove(detail.body().readiness.length, 0)
  })

  test('snapshot imutável: preço e conteúdo só mudam na página depois de republicar', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const { id, slug: s } = await readyCourse(a, professional.id)
    const published = await a.post(`/admin/courses/${id}/publish`)
    published.assertStatus(200)
    assert.equal(published.body().publishedVersion, 1)

    const first = await client.get(`/public/courses/${s}`)
    first.assertStatus(200)
    assert.deepInclude(first.body().offer, {
      listCents: 25000,
      discountPct: 30,
      discountCents: 7500,
      totalCents: 17500,
    })
    assert.equal(first.body().checkout.url, 'https://pay.example.com/c/abc')
    assert.equal(first.body().professional.slug, professional.slug)

    // Alterar rascunho e preço não vaza para o público.
    ;(
      await a.put(`/admin/courses/${id}`, { data: courseData('Título novo'), revision: 1 })
    ).assertStatus(200)
    ;(
      await a.put(
        `/admin/courses/${id}/commercial`,
        commercial({ revision: 1, listCents: 99900, discountPct: 0 })
      )
    ).assertStatus(200)
    const stillOld = await client.get(`/public/courses/${s}`)
    assert.equal(stillOld.body().data.title, 'Morena Iluminada')
    assert.equal(stillOld.body().offer.totalCents, 17500)
    const admin1 = await a.get(`/admin/courses/${id}`)
    assert.isTrue(admin1.body().hasUnpublishedChanges)

    ;(await a.post(`/admin/courses/${id}/publish`)).assertStatus(200)
    const fresh = await client.get(`/public/courses/${s}`)
    assert.equal(fresh.body().data.title, 'Título novo')
    assert.equal(fresh.body().offer.totalCents, 99900)
    assert.equal(fresh.body().version, 2)
    const versions = await db.from('course_versions').where('course_id', id)
    assert.lengthOf(versions, 2)
  })

  test('só alterar a oferta já marca "alterações não publicadas"', async ({ client, assert }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const { id } = await readyCourse(a, professional.id)
    ;(await a.post(`/admin/courses/${id}/publish`)).assertStatus(200)
    assert.isFalse((await a.get(`/admin/courses/${id}`)).body().hasUnpublishedChanges)
    ;(
      await a.put(`/admin/courses/${id}/commercial`, commercial({ revision: 1, discountPct: 10 }))
    ).assertStatus(200)
    assert.isTrue((await a.get(`/admin/courses/${id}`)).body().hasUnpublishedChanges)
  })

  test('público: rascunho, despublicado e arquivado dão 404; slug inválido também', async ({
    client,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const { id, slug: s } = await readyCourse(a, professional.id)
    ;(await client.get(`/public/courses/${s}`)).assertStatus(404)
    ;(await a.post(`/admin/courses/${id}/publish`)).assertStatus(200)
    ;(await client.get(`/public/courses/${s}`)).assertStatus(200)
    ;(await a.post(`/admin/courses/${id}/unpublish`)).assertStatus(200)
    ;(await client.get(`/public/courses/${s}`)).assertStatus(404)
    ;(await a.post(`/admin/courses/${id}/publish`)).assertStatus(200)
    ;(await a.post(`/admin/courses/${id}/archive`)).assertStatus(200)
    ;(await client.get(`/public/courses/${s}`)).assertStatus(404)
    ;(await client.get('/public/courses/A_B')).assertStatus(404)
    ;(await a.post(`/admin/courses/${id}/restore`)).assertStatus(200)
  })

  test('só o backend define o preço: a resposta pública traz a oferta e nunca aceita valores de fora', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const { id, slug: s } = await readyCourse(a, professional.id)
    ;(await a.post(`/admin/courses/${id}/publish`)).assertStatus(200)
    const res = await client.get(`/public/courses/${s}?price=1&amount=1&listCents=1`)
    res.assertStatus(200)
    assert.equal(res.body().offer.listCents, 25000)
    const keys = Object.keys(res.body())
    assert.notInclude(keys, 'commercial')
  })

  test('oferta inativa publicada some do checkout (url nula): a página mostra a compra indisponível', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const { id, slug: s } = await readyCourse(a, professional.id)
    ;(await a.post(`/admin/courses/${id}/publish`)).assertStatus(200)
    // Simula a lista de domínios mudar depois da publicação: o snapshot guarda um host que deixou de valer.
    await db
      .from('course_versions')
      .where('course_id', id)
      .update({
        commercial: JSON.stringify({
          listCents: 25000,
          discountPct: 30,
          maxInstallments: 6,
          checkoutUrl: 'https://antigo.removido.org/c',
          environment: 'production',
          active: true,
        }),
      })
    const res = await client.get(`/public/courses/${s}`)
    res.assertStatus(200)
    assert.isNull(res.body().checkout.url)
  })
})

test.group('Cursos · vitrine no profissional e cascata', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('curso publicado aparece na página do profissional, na ordem e respeitando a vitrine', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const empty = await client.get(`/public/professionals/${professional.slug}`)
    assert.deepEqual(empty.body().courses, [])

    const one = await readyCourse(a, professional.id, slug('um'))
    const two = await readyCourse(a, professional.id, slug('dois'))
    const hidden = await readyCourse(a, professional.id, slug('oculto'))
    const draft = await readyCourse(a, professional.id, slug('rasc'))
    for (const c of [one, two, hidden])
      (await a.post(`/admin/courses/${c.id}/publish`)).assertStatus(200)
    ;(
      await a.put(`/admin/courses/${one.id}/showcase`, {
        showcaseVisible: true,
        showcaseOrder: 5,
        featured: false,
      })
    ).assertStatus(200)
    ;(
      await a.put(`/admin/courses/${two.id}/showcase`, {
        showcaseVisible: true,
        showcaseOrder: 1,
        featured: false,
      })
    ).assertStatus(200)
    ;(
      await a.put(`/admin/courses/${hidden.id}/showcase`, {
        showcaseVisible: false,
        showcaseOrder: 0,
        featured: false,
      })
    ).assertStatus(200)

    const res = await client.get(`/public/professionals/${professional.slug}`)
    assert.deepEqual(
      res.body().courses.map((c: { slug: string }) => c.slug),
      [two.slug, one.slug]
    )
    assert.deepEqual(Object.keys(res.body().courses[0]).sort(), [
      'coverAlt',
      'coverSrc',
      'discountPct',
      'slug',
      'title',
    ])
    assert.notInclude(JSON.stringify(res.body().courses), draft.slug)
  })

  test('profissional despublicado tira os cursos do ar; republicar traz de volta', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const c = await readyCourse(a, professional.id)
    ;(await a.post(`/admin/courses/${c.id}/publish`)).assertStatus(200)
    ;(await client.get(`/public/courses/${c.slug}`)).assertStatus(200)
    ;(await a.post(`/admin/professionals/${professional.id}/unpublish`)).assertStatus(200)
    ;(await client.get(`/public/courses/${c.slug}`)).assertStatus(404)
    // O curso segue "publicado" internamente, mas não pode ser (re)publicado sem o profissional.
    ;(await a.post(`/admin/courses/${c.id}/publish`)).assertStatus(422)
    ;(await a.post(`/admin/professionals/${professional.id}/publish`)).assertStatus(200)
    const back = await client.get(`/public/courses/${c.slug}`)
    back.assertStatus(200)
    assert.equal(back.body().professional.slug, professional.slug)
  })

  test('arquivar o profissional também tira o curso do ar', async ({ client }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const professional = await publishedProfessional(a)
    const c = await readyCourse(a, professional.id)
    ;(await a.post(`/admin/courses/${c.id}/publish`)).assertStatus(200)
    ;(await a.post(`/admin/professionals/${professional.id}/archive`)).assertStatus(200)
    ;(await client.get(`/public/courses/${c.slug}`)).assertStatus(404)
  })

  test('lista filtra por profissional, situação e busca com % literal', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const p1 = await publishedProfessional(a)
    const p2 = await publishedProfessional(a)
    const c1 = await readyCourse(a, p1.id, slug('alfa'))
    await readyCourse(a, p2.id, slug('beta'))
    ;(await a.post(`/admin/courses/${c1.id}/archive`)).assertStatus(200)
    const byProfessional = await a.get(`/admin/courses?professionalId=${p1.id}`)
    assert.lengthOf(byProfessional.body().items, 0) // arquivado não aparece por padrão
    const archived = await a.get(`/admin/courses?professionalId=${p1.id}&status=archived`)
    assert.lengthOf(archived.body().items, 1)
    assert.isBoolean(archived.body().items[0].showcaseVisible)
    const percent = await a.get('/admin/courses?q=%25')
    assert.lengthOf(percent.body().items, 0)
  })

  test('a busca da lista também acha pelo nome do profissional', async ({ client, assert }) => {
    const admin = await makeUser('admin')
    const a = api(client, admin)
    const created = await a.post('/admin/professionals', {
      slug: slug('nome'),
      data: professionalData('Zeferino Quaresma'),
    })
    created.assertStatus(201)
    const proId = created.body().id as number
    await readyCourse(a, proId, slug('curso-z'))
    const other = await publishedProfessional(a)
    await readyCourse(a, other.id, slug('curso-outro'))

    const found = await a.get('/admin/courses?q=Quaresma')
    assert.lengthOf(found.body().items, 1)
    assert.equal(found.body().items[0].professionalId, proId)
    assert.lengthOf((await a.get('/admin/courses?q=ninguem-assim')).body().items, 0)
  })
})

test.group('Cursos · pausar vendas e hosts do checkout', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('desativar a oferta vale na página pública sem republicar; reativar volta; o preço é o do snapshot', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('admin'))
    const professional = await publishedProfessional(a)
    const { id, slug: s } = await readyCourse(a, professional.id)
    ;(await a.post(`/admin/courses/${id}/publish`)).assertStatus(200)
    const live = await client.get(`/public/courses/${s}`)
    assert.equal(live.body().checkout.url, 'https://pay.example.com/c/abc')

    // revision 1 = a oferta criada em readyCourse
    ;(
      await a.put(
        `/admin/courses/${id}/commercial`,
        commercial({ active: false, revision: 1, listCents: 99900 })
      )
    ).assertStatus(200)
    const paused = (await client.get(`/public/courses/${s}`)).body()
    assert.isNull(paused.checkout.url)
    assert.equal(paused.offer.listCents, 25000) // preço do snapshot, não o rascunho novo

    ;(
      await a.put(
        `/admin/courses/${id}/commercial`,
        commercial({ active: true, revision: 2, listCents: 25000 })
      )
    ).assertStatus(200)
    assert.equal(
      (await client.get(`/public/courses/${s}`)).body().checkout.url,
      'https://pay.example.com/c/abc'
    )
  })

  test('provedor The Members: a página pública vira embed; voltar para a Academia vale na hora; padrão é Academia', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('admin'))
    const professional = await publishedProfessional(a)
    const { id, slug: s } = await readyCourse(a, professional.id)
    ;(await a.post(`/admin/courses/${id}/publish`)).assertStatus(200)
    const before = (await client.get(`/public/courses/${s}`)).body()
    assert.equal(before.checkout.mode, 'redirect')

    const saved = await a.put(
      `/admin/courses/${id}/commercial`,
      commercial({ provider: 'themembers', revision: 1 })
    )
    saved.assertStatus(200)
    assert.equal(saved.body().commercial.provider, 'themembers')
    // O snapshot publicado é imutável: o modo só muda ao republicar.
    assert.equal((await client.get(`/public/courses/${s}`)).body().checkout.mode, 'redirect')
    ;(await a.post(`/admin/courses/${id}/publish`)).assertStatus(200)
    const embed = (await client.get(`/public/courses/${s}`)).body()
    assert.equal(embed.checkout.mode, 'embed')
    assert.equal(embed.checkout.url, 'https://pay.example.com/c/abc')

    // ID do curso na The Members: guardado na oferta, sem caracteres estranhos, e a cópia não o herda.
    const withId = await a.put(
      `/admin/courses/${id}/commercial`,
      commercial({ provider: 'themembers', externalCourseId: 'crs_123', revision: 2 })
    )
    withId.assertStatus(200)
    assert.equal(withId.body().commercial.externalCourseId, 'crs_123')
    ;(
      await a.put(
        `/admin/courses/${id}/commercial`,
        commercial({ provider: 'themembers', externalCourseId: '<x>', revision: 3 })
      )
    ).assertStatus(422)
    const copy = await a.post(`/admin/courses/${id}/duplicate`)
    copy.assertStatus(201)
    assert.equal(copy.body().commercial.externalCourseId, '')

    // O iframe também só aceita domínio autorizado.
    const bad = await a.put(
      `/admin/courses/${id}/commercial`,
      commercial({ provider: 'themembers', checkoutUrl: 'https://evil.example.org/c', revision: 3 })
    )
    bad.assertStatus(422)
    assert.equal(bad.body().code, 'checkout_url_invalid')

    const invalid = await a.put(
      `/admin/courses/${id}/commercial`,
      commercial({ provider: 'outro', revision: 3 })
    )
    invalid.assertStatus(422)
  })

  test('a lista de domínios vale para o host exato: subdomínio do host listado é recusado', async ({
    client,
  }) => {
    const a = api(client, await makeUser('admin'))
    const professional = await publishedProfessional(a)
    const { id } = await readyCourse(a, professional.id)
    const sub = await a.put(
      `/admin/courses/${id}/commercial`,
      commercial({ checkoutUrl: 'https://outro-vendedor.pay.example.com/c', revision: 1 })
    )
    sub.assertStatus(422)
  })
})

test.group('Duplicar profissional e curso', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('duplicar profissional: rascunho novo com dados copiados, nome "(cópia)" e slug livre', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('admin'))
    const professional = await publishedProfessional(a)
    const first = await a.post(`/admin/professionals/${professional.id}/duplicate`)
    first.assertStatus(201)
    assert.equal(first.body().status, 'draft')
    assert.notEqual(first.body().id, professional.id)
    assert.equal(first.body().data.name, 'Ana Souza (cópia)')
    assert.equal(first.body().data.bio[0], 'Trajetória de dez anos.')
    assert.match(first.body().slug, /-copia$/)
    const second = await a.post(`/admin/professionals/${professional.id}/duplicate`)
    second.assertStatus(201)
    assert.match(second.body().slug, /-copia-2$/)
    // O original segue publicado e intacto.
    const original = await a.get(`/admin/professionals/${professional.id}`)
    assert.equal(original.body().status, 'published')
    assert.equal(original.body().data.name, 'Ana Souza')
  })

  test('duplicar curso: mesmo profissional, sem publicação, e a oferta só vai para quem tem commerce.manage', async ({
    client,
    assert,
  }) => {
    const admin = api(client, await makeUser('admin'))
    const editor = api(client, await makeUser('editor'))
    const professional = await publishedProfessional(admin)
    const { id } = await readyCourse(admin, professional.id)
    ;(await admin.post(`/admin/courses/${id}/publish`)).assertStatus(200)

    const byAdmin = await admin.post(`/admin/courses/${id}/duplicate`)
    byAdmin.assertStatus(201)
    assert.equal(byAdmin.body().status, 'draft')
    assert.equal(byAdmin.body().professionalId, professional.id)
    assert.equal(byAdmin.body().data.title, 'Morena Iluminada (cópia)')
    assert.equal(byAdmin.body().commercial.listCents, 25000)
    assert.equal(byAdmin.body().commercial.checkoutUrl, '')
    assert.isFalse(byAdmin.body().commercial.active)

    const byEditor = await editor.post(`/admin/courses/${id}/duplicate`)
    byEditor.assertStatus(201)
    assert.isNull(byEditor.body().commercial)
  })

  test('viewer não duplica e id inexistente dá 404', async ({ client }) => {
    const viewer = api(client, await makeUser('viewer'))
    ;(await viewer.post('/admin/courses/1/duplicate')).assertStatus(403)
    ;(await viewer.post('/admin/professionals/1/duplicate')).assertStatus(403)
    const admin = api(client, await makeUser('admin'))
    ;(await admin.post('/admin/courses/999999/duplicate')).assertStatus(404)
    ;(await admin.post('/admin/professionals/999999/duplicate')).assertStatus(404)
  })
})

test.group('Despublicar e apagar', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('apagar exige permissão, recusa publicado e profissional com curso; despublicar libera', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('admin'))
    const professional = await publishedProfessional(a)
    const course = await readyCourse(a, professional.id)
    ;(await a.post(`/admin/courses/${course.id}/publish`)).assertStatus(200)

    ;(
      await api(client, await makeUser('viewer')).delete(`/admin/courses/${course.id}`)
    ).assertStatus(403)
    // No ar: precisa despublicar primeiro.
    const blocked = await a.delete(`/admin/courses/${course.id}`)
    blocked.assertStatus(422)
    assert.equal(blocked.body().code, 'published')
    ;(await a.post(`/admin/courses/${course.id}/unpublish`)).assertStatus(200)
    ;(await client.get(`/public/courses/${course.slug}`)).assertStatus(404)

    // Profissional com curso não é apagado, mesmo despublicado.
    ;(await a.post(`/admin/professionals/${professional.id}/unpublish`)).assertStatus(200)
    const hasCourses = await a.delete(`/admin/professionals/${professional.id}`)
    hasCourses.assertStatus(409)
    assert.equal(hasCourses.body().code, 'has_courses')

    // Curso apagado de vez (com oferta e versões); depois o profissional também.
    ;(await a.delete(`/admin/courses/${course.id}`)).assertStatus(204)
    ;(await a.get(`/admin/courses/${course.id}`)).assertStatus(404)
    assert.equal((await db.from('course_versions').where('course_id', course.id)).length, 0)
    assert.equal((await db.from('commercial_configs').where('course_id', course.id)).length, 0)
    ;(await a.delete(`/admin/professionals/${professional.id}`)).assertStatus(204)
    ;(await a.get(`/admin/professionals/${professional.id}`)).assertStatus(404)
    assert.equal(
      (await db.from('professional_versions').where('professional_id', professional.id)).length,
      0
    )
    ;(await a.delete('/admin/courses/999999')).assertStatus(404)
  })

  test('apagar registra auditoria com o identificador do item', async ({ client, assert }) => {
    const a = api(client, await makeUser('admin'))
    const created = await a.post('/admin/professionals', {
      slug: slug('prof'),
      data: professionalData(),
    })
    created.assertStatus(201)
    ;(await a.delete(`/admin/professionals/${created.body().id}`)).assertStatus(204)
    const log = await db.from('audit_logs').where('action', 'professional.delete').first()
    assert.equal(String(log?.resource_id), String(created.body().id))
  })

  test('a lista ordena por nome, aceita busca e devolve contagens por situação', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('admin'))
    for (const name of ['Bia Lima', 'Ana Souza']) {
      ;(
        await a.post('/admin/professionals', { slug: slug('ord'), data: professionalData(name) })
      ).assertStatus(201)
    }
    const published = await publishedProfessional(a)
    const sorted = await a.get('/admin/professionals?sort=name')
    const names = sorted.body().items.map((p: { data: { name: string } }) => p.data.name)
    assert.deepEqual(
      names,
      [...names].sort((x: string, y: string) => x.localeCompare(y))
    )
    assert.deepInclude(sorted.body().meta.counts, { published: 1, draft: 2, archived: 0 })
    // A contagem ignora o filtro de situação, mas respeita a busca.
    const searched = await a.get('/admin/professionals?q=Bia&status=published')
    assert.equal(searched.body().items.length, 0)
    assert.equal(searched.body().meta.counts.draft, 1)
    ;(await a.post(`/admin/professionals/${published.id}/archive`)).assertStatus(200)
    assert.equal((await a.get('/admin/professionals')).body().meta.counts.archived, 1)
  })
})
