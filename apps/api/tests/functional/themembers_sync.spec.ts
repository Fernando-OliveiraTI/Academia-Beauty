/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).assertStatus()` mantém os testes legíveis */
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { makeUser } from '#tests/helpers'
import {
  buildPreview,
  coverFor,
  fetchProducts,
  default as ThemembersSyncService,
  valueToCents,
  type MembersProduct,
} from '#services/themembers_sync_service'

const product = (over: Partial<MembersProduct> = {}): MembersProduct => ({
  id: 'p1',
  title: 'Curso A',
  value: '500.00',
  status: 'active',
  ...over,
})
const row = (over = {}) => ({
  id: 1,
  slug: 'a',
  title: 'Curso A',
  listCents: 50000,
  externalId: 'p1',
  ...over,
})

test.group('Sincronização The Members · resumo', () => {
  test('valueToCents converte sem float e rejeita formatos inesperados', ({ assert }) => {
    assert.equal(valueToCents('500.00'), 50000)
    assert.equal(valueToCents('29.9'), 2990)
    assert.equal(valueToCents('0.07'), 7)
    assert.equal(valueToCents('1234'), 123400)
    assert.isNull(valueToCents('abc'))
    assert.isNull(valueToCents('-5.00'))
    assert.isNull(valueToCents(null))
  })

  test('detecta nome e valor diferentes, curso em dia, ID inexistente e produtos sem vínculo', ({
    assert,
  }) => {
    const preview = buildPreview(
      [
        row(),
        row({ id: 2, externalId: 'p2', title: 'Antigo', listCents: 29700 }),
        row({ id: 3, externalId: 'zzz' }),
        row({ id: 4, externalId: 'p4', listCents: null }),
      ],
      [
        product(),
        product({ id: 'p2', title: 'Novo nome', value: '350.50' }),
        product({ id: 'p4', title: 'Curso A' }),
        product({ id: 'p9', title: 'Sem curso' }),
      ],
      [
        { courseId: 7, slug: 'x', title: 'X', coverSrc: null, hasOffer: true },
        { courseId: 8, slug: 'y', title: 'Y', coverSrc: null, hasOffer: false },
      ]
    )
    const [ok, changed, missing, noOffer] = preview.items
    assert.equal(ok.state, 'up_to_date')
    assert.equal(changed.state, 'changes')
    assert.deepEqual(
      changed.changes.map((c) => [c.field, c.current, c.incoming]),
      [
        ['title', 'Antigo', 'Novo nome'],
        ['price', 'R$ 297,00', 'R$ 350,50'],
      ]
    )
    assert.equal(missing.state, 'not_found')
    assert.equal(noOffer.changes[0].current, null)
    assert.deepEqual(preview.unlinkedProducts, [{ id: 'p9', title: 'Sem curso', coverSrc: null }])
    assert.equal(preview.withoutLink, 2)
  })

  test('coverFor acha o curso pelo nome, cai na foto do profissional e ignora o resto', ({
    assert,
  }) => {
    const catalog = [
      {
        title: 'Loira Iluminada',
        professionalName: 'Cleber Venâncio',
        coverSrc: '/c.jpg',
        photoSrc: '/p.jpg',
      },
      { title: 'Outro', professionalName: 'Miro Rodrigues', coverSrc: null, photoSrc: '/miro.jpg' },
    ]
    assert.equal(coverFor('Cleber Venâncio - Loira Iluminada', catalog), '/c.jpg')
    assert.equal(coverFor('Loira iluminada', catalog), '/c.jpg')
    assert.equal(coverFor('Miro Rodrigues - Classic Bob', catalog), '/miro.jpg')
    assert.isNull(coverFor('Luzes', catalog))
    assert.isNull(coverFor('', catalog))
  })

  test('fetchProducts segue o cursor e trata erro HTTP como 502', async ({ assert }) => {
    const seen: string[] = []
    const pages: Record<string, unknown> = {
      '': {
        data: [{ id: 'a', title: 'A', value: '1.00', status: 'active' }],
        meta: { next_cursor: 'c2' },
      },
      'c2': {
        data: [{ id: 'b', title: 'B', value: '2.00', status: 'active' }],
        meta: { next_cursor: null },
      },
    }
    const fake = (async (url: URL, init: RequestInit) => {
      seen.push(String((init.headers as Record<string, string>).Authorization))
      return new Response(JSON.stringify(pages[url.searchParams.get('cursor') ?? '']), {
        status: 200,
      })
    }) as unknown as typeof fetch
    // sem token configurado o serviço recusa antes de qualquer chamada
    const { default: env } = await import('#start/env')
    const previous = env.get('TOKEN_THE_MEMBERS')
    env.set('TOKEN_THE_MEMBERS', 'tok')
    try {
      assert.deepEqual(
        (await fetchProducts(fake)).map((p) => p.id),
        ['a', 'b']
      )
      assert.deepEqual(seen, ['Bearer tok', 'Bearer tok'])
      const failing = (async () => new Response('x', { status: 401 })) as unknown as typeof fetch
      await assert.rejects(() => fetchProducts(failing), /respondeu 401/)
    } finally {
      env.set('TOKEN_THE_MEMBERS', previous)
    }
  })
})

test.group('Sincronização The Members · rota', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('exige sessão e commerce.manage; sem token configurado responde 503', async ({
    client,
    assert,
  }) => {
    ;(await client.get('/admin/courses/themembers/preview')).assertStatus(401)
    const viewer = await makeUser('viewer')
    ;(await client.get('/admin/courses/themembers/preview').loginAs(viewer)).assertStatus(403)
    const admin = await makeUser('admin')
    const { default: env } = await import('#start/env')
    const previous = env.get('TOKEN_THE_MEMBERS')
    env.set('TOKEN_THE_MEMBERS', '')
    try {
      // sem curso vinculado não há o que consultar: resposta vazia, sem chamar a The Members
      const empty = await client.get('/admin/courses/themembers/preview').loginAs(admin)
      empty.assertStatus(200)
      assert.deepEqual(empty.body().items, [])
      await db.table('professionals').insert({
        slug: 'p',
        status: 'draft',
        revision: 1,
        data: '{}',
        name: 'P',
        template_key: 'original',
        created_at: new Date(),
      })
      const [pid] = await db.from('professionals').select('id').where('slug', 'p')
      const [cid] = await db.table('courses').insert({
        professional_id: pid.id,
        slug: 'c',
        status: 'draft',
        revision: 1,
        title: 'C',
        data: JSON.stringify({ title: 'C' }),
        created_at: new Date(),
      })
      await db.table('commercial_configs').insert({
        course_id: cid,
        revision: 1,
        list_cents: 100,
        external_course_id: 'x',
        created_at: new Date(),
      })
      const res = await client.get('/admin/courses/themembers/preview').loginAs(admin)
      res.assertStatus(503)
      assert.equal(res.body().code, 'themembers_not_configured')
    } finally {
      env.set('TOKEN_THE_MEMBERS', previous)
    }
  })
})

test.group('Sincronização The Members · salvar ID', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function makeCourse(slug: string, withOffer: boolean) {
    const [pro] = await db.from('professionals').select('id').limit(1)
    let professionalId = pro?.id as number | undefined
    if (!professionalId) {
      ;[professionalId] = await db.table('professionals').insert({
        slug: `p-${slug}`,
        status: 'draft',
        revision: 1,
        data: '{}',
        name: 'P',
        template_key: 'original',
        created_at: new Date(),
      })
    }
    const [id] = await db.table('courses').insert({
      professional_id: professionalId,
      slug,
      status: 'draft',
      revision: 1,
      title: slug,
      data: JSON.stringify({ title: slug }),
      created_at: new Date(),
    })
    if (withOffer) {
      await db
        .table('commercial_configs')
        .insert({ course_id: id, revision: 1, list_cents: 100, created_at: new Date() })
    }
    return id as number
  }

  test('grava só o ID, bloqueia duplicado, curso sem oferta e quem não tem permissão', async ({
    client,
    assert,
  }) => {
    const a = await makeCourse('curso-a', true)
    const b = await makeCourse('curso-b', true)
    const noOffer = await makeCourse('curso-c', false)
    const put = (id: number, body: object, user: Awaited<ReturnType<typeof makeUser>>) =>
      client.put(`/admin/courses/${id}/themembers-id`).withCsrfToken().loginAs(user).json(body)

    const viewer = await makeUser('viewer')
    ;(await put(a, { externalCourseId: 'abc-1' }, viewer)).assertStatus(403)
    const admin = await makeUser('admin')
    ;(await put(a, { externalCourseId: ' ' }, admin)).assertStatus(422)
    ;(await put(a, { externalCourseId: 'tem espaço' }, admin)).assertStatus(422)

    const ok = await put(a, { externalCourseId: ' abc-1 ' }, admin)
    ok.assertStatus(200)
    assert.equal(ok.body().externalCourseId, 'abc-1')
    const saved = await db.from('commercial_configs').where('course_id', a).first()
    assert.equal(saved.external_course_id, 'abc-1')
    assert.equal(saved.revision, 2)
    assert.equal(saved.list_cents, 100) // preço intacto

    const dup = await put(b, { externalCourseId: 'abc-1' }, admin)
    dup.assertStatus(409)
    assert.equal(dup.body().code, 'external_id_taken')
    const none = await put(noOffer, { externalCourseId: 'zzz' }, admin)
    none.assertStatus(422)
    assert.equal(none.body().code, 'offer_required')
    ;(await put(999999, { externalCourseId: 'zzz' }, admin)).assertStatus(404)

    // remover vínculo: só viewer barrado; limpa o ID, mantém preço e é repetível
    const del = (id: number, user: Awaited<ReturnType<typeof makeUser>>) =>
      client.delete(`/admin/courses/${id}/themembers-id`).withCsrfToken().loginAs(user)
    ;(await del(a, viewer)).assertStatus(403)
    ;(await del(a, admin)).assertStatus(200)
    const cleared = await db.from('commercial_configs').where('course_id', a).first()
    assert.equal(cleared.external_course_id, '')
    assert.equal(cleared.list_cents, 100)
    assert.equal(cleared.revision, 3)
    ;(await del(a, admin)).assertStatus(200) // já sem vínculo: sem erro e sem nova revisão
    assert.equal((await db.from('commercial_configs').where('course_id', a).first()).revision, 3)
    ;(await del(999999, admin)).assertStatus(404)
    ;(await put(b, { externalCourseId: 'abc-1' }, admin)).assertStatus(200) // o ID liberado pode ser reusado
  })
})

test.group('Sincronização The Members · aplicar', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('grava nome e valor só nos vinculados, respeita limites e não toca no resto', async ({
    assert,
  }) => {
    const admin = await makeUser('admin')
    const [proId] = await db.table('professionals').insert({
      slug: 'pa',
      status: 'draft',
      revision: 1,
      data: '{}',
      name: 'P',
      template_key: 'original',
      created_at: new Date(),
    })
    const course = async (
      slug: string,
      title: string,
      cents: number,
      ext: string,
      status = 'draft'
    ) => {
      const [id] = await db.table('courses').insert({
        professional_id: proId,
        slug,
        status,
        revision: 1,
        title,
        data: JSON.stringify({ title, lead: 'x' }),
        created_at: new Date(),
      })
      await db.table('commercial_configs').insert({
        course_id: id,
        revision: 1,
        list_cents: cents,
        discount_pct: 30,
        external_course_id: ext,
        created_at: new Date(),
      })
      return id as number
    }
    const changed = await course('c1', 'Antigo', 25000, 'm1')
    const same = await course('c2', 'Igual', 50000, 'm2')
    const badPrice = await course('c3', 'Barato', 20000, 'm3')
    const archived = await course('c4', 'Arq', 100, 'm4', 'archived')
    const unlinked = await course('c5', 'Solto', 100, '')

    const page = {
      data: [
        { id: 'm1', title: 'Novo - Nome', value: '500.00', status: 'active' },
        { id: 'm2', title: 'Igual', value: '500.00', status: 'active' },
        { id: 'm3', title: 'Barato Novo', value: '0.50', status: 'active' },
        { id: 'm4', title: 'Qualquer', value: '900.00', status: 'active' },
      ],
      meta: { next_cursor: null },
    }
    const fake = (async () =>
      new Response(JSON.stringify(page), { status: 200 })) as unknown as typeof fetch
    const { default: env } = await import('#start/env')
    const previous = env.get('TOKEN_THE_MEMBERS')
    env.set('TOKEN_THE_MEMBERS', 'tok')
    try {
      const results = await new ThemembersSyncService().apply(admin.id, fake)
      const by = (id: number) => results.find((r) => r.courseId === id)
      assert.deepEqual(by(changed)?.applied, ['title', 'price'])
      assert.deepEqual(by(same)?.applied, [])
      assert.deepEqual(by(badPrice)?.applied, ['title'])
      assert.match(String(by(badPrice)?.skipped), /valor fora do permitido/)
      assert.equal(by(archived)?.skipped, 'Curso arquivado')
      assert.isUndefined(by(unlinked))

      const c1 = await db.from('courses').where('id', changed).first()
      assert.equal(c1.title, 'Novo - Nome')
      assert.equal(c1.data.title, 'Novo - Nome')
      assert.equal(c1.data.lead, 'x') // resto do conteúdo intacto
      assert.equal(c1.revision, 2)
      const o1 = await db.from('commercial_configs').where('course_id', changed).first()
      assert.equal(o1.list_cents, 50000)
      assert.equal(o1.discount_pct, 30)
      assert.equal(o1.revision, 2)
      const o3 = await db.from('commercial_configs').where('course_id', badPrice).first()
      assert.equal(o3.list_cents, 20000)
      const a = await db.from('courses').where('id', archived).first()
      assert.equal(a.title, 'Arq')
      // segunda execução: nada mais a gravar (o curso com valor inválido continua só pulando o preço)
      const again = await new ThemembersSyncService().apply(admin.id, fake)
      assert.isTrue(again.every((r) => r.applied.length === 0))
    } finally {
      env.set('TOKEN_THE_MEMBERS', previous)
    }
  })

  test('courseIds aplica só os cursos escolhidos; lista vazia não grava nada', async ({
    assert,
  }) => {
    const admin = await makeUser('admin')
    const [proId] = await db.table('professionals').insert({
      slug: 'pb',
      status: 'draft',
      revision: 1,
      data: '{}',
      name: 'P',
      template_key: 'original',
      created_at: new Date(),
    })
    const course = async (slug: string, ext: string) => {
      const [id] = await db.table('courses').insert({
        professional_id: proId,
        slug,
        status: 'draft',
        revision: 1,
        title: 'Antigo',
        data: JSON.stringify({ title: 'Antigo', lead: 'x' }),
        created_at: new Date(),
      })
      await db.table('commercial_configs').insert({
        course_id: id,
        revision: 1,
        list_cents: 25000,
        discount_pct: 0,
        external_course_id: ext,
        created_at: new Date(),
      })
      return id as number
    }
    const picked = await course('s1', 'n1')
    const left = await course('s2', 'n2')
    const page = {
      data: [
        { id: 'n1', title: 'Novo 1', value: '500.00', status: 'active' },
        { id: 'n2', title: 'Novo 2', value: '500.00', status: 'active' },
      ],
      meta: { next_cursor: null },
    }
    const fake = (async () =>
      new Response(JSON.stringify(page), { status: 200 })) as unknown as typeof fetch
    const { default: env } = await import('#start/env')
    const previous = env.get('TOKEN_THE_MEMBERS')
    env.set('TOKEN_THE_MEMBERS', 'tok')
    try {
      assert.deepEqual(await new ThemembersSyncService().apply(admin.id, fake, []), [])
      assert.equal((await db.from('courses').where('id', picked).first()).title, 'Antigo')
      const results = await new ThemembersSyncService().apply(admin.id, fake, [picked])
      assert.deepEqual(
        results.map((r) => r.courseId),
        [picked]
      )
      assert.equal((await db.from('courses').where('id', picked).first()).title, 'Novo 1')
      assert.equal((await db.from('courses').where('id', left).first()).title, 'Antigo')
    } finally {
      env.set('TOKEN_THE_MEMBERS', previous)
    }
  })

  test('courseIds inválido é recusado (422)', async ({ client }) => {
    const admin = await makeUser('admin')
    const res = await client
      .post('/admin/courses/themembers/sync')
      .json({ courseIds: ['x'] })
      .withCsrfToken()
      .loginAs(admin)
    res.assertStatus(422)
  })

  test('a rota exige commerce.manage', async ({ client }) => {
    ;(await client.post('/admin/courses/themembers/sync').withCsrfToken()).assertStatus(401)
    const viewer = await makeUser('viewer')
    ;(
      await client.post('/admin/courses/themembers/sync').withCsrfToken().loginAs(viewer)
    ).assertStatus(403)
  })
})
