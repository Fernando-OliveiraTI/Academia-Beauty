/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).body()` mantém os testes legíveis */
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { makeUser } from '#tests/helpers'
import { resetIpRateLimits } from '#services/ip_rate_limit'

const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'

let seq = 0

async function professional(name: string) {
  seq += 1
  const slug = `pro-${seq}-${Date.now()}`
  const [id] = await db.table('professionals').insert({
    slug,
    status: 'published',
    revision: 1,
    data: JSON.stringify({ name, specialty: 'Hair', cardPhotoSrc: '/site/a.png' }),
    name,
    template_key: 'professional-original',
    created_at: new Date(),
  })
  return { id: Number(id), slug }
}

async function course(professionalId: number, title: string) {
  seq += 1
  const slug = `curso-${seq}-${Date.now()}`
  const [id] = await db.table('courses').insert({
    professional_id: professionalId,
    slug,
    status: 'published',
    revision: 1,
    data: JSON.stringify({ title, coverSrc: '/site/c.png' }),
    title,
    created_at: new Date(),
  })
  return { id: Number(id), slug }
}

/** Evento de página com data controlada (UTC). */
async function event(slug: string, kind: string, at: string, extra: Record<string, unknown> = {}) {
  await db.table('page_events').insert({
    kind,
    resource_type: 'course',
    resource_slug: slug,
    visitor_hash: (extra.visitor as string) ?? 'v1',
    device: (extra.device as string) ?? 'desktop',
    referrer_host: (extra.referrer as string | null) ?? null,
    duration_ms: (extra.ms as number) ?? null,
    created_at: new Date(at),
  })
}

async function payment(courseId: number, tx: string, status: string, cents: number, at: string) {
  seq += 1
  await db.table('payment_events').insert({
    event_key: `k-${seq}-${Date.now()}`,
    provider: 'themembers',
    event: `order.${status}`,
    kind: 'transaction',
    status,
    external_transaction_id: tx,
    course_id: courseId,
    amount_cents: cents,
    signature_scheme: 'test',
    payload: JSON.stringify({}),
    occurred_at: new Date(at),
    received_at: new Date(at),
  })
}

const q = (params: Record<string, string | number>) =>
  new URLSearchParams(
    Object.entries(params).map(([k, v]): [string, string] => [k, String(v)])
  ).toString()

test.group('Insights · tempo na página', (group) => {
  group.each.setup(async () => {
    await resetIpRateLimits()
    return testUtils.db().withGlobalTransaction()
  })

  test('evento `time` grava a duração com teto; abaixo de 1 s ou sem número é ignorado', async ({
    client,
    assert,
  }) => {
    const pro = await professional('Ana Souza')
    const c = await course(pro.id, 'Morena')
    const post = (body: object) =>
      client.post('/public/track').header('user-agent', DESKTOP).json(body)
    ;(await post({ kind: 'time', type: 'course', slug: c.slug, durationMs: 42_000 })).assertStatus(
      204
    )
    ;(
      await post({ kind: 'time', type: 'course', slug: c.slug, durationMs: 5 * 3_600_000 })
    ).assertStatus(204)
    ;(await post({ kind: 'time', type: 'course', slug: c.slug, durationMs: 300 })).assertStatus(204)
    ;(await post({ kind: 'time', type: 'course', slug: c.slug, durationMs: 'muito' })).assertStatus(
      204
    )
    const rows = await db
      .from('page_events')
      .where('kind', 'time')
      .orderBy('id')
      .select('duration_ms')
    assert.deepEqual(
      rows.map((r) => r.duration_ms),
      [42_000, 30 * 60 * 1000]
    )
  })
})

test.group('Insights · consulta e escopo', (group) => {
  group.each.setup(async () => {
    await resetIpRateLimits()
    return testUtils.db().withGlobalTransaction()
  })

  test('admin vê funil, tempo, vendas e reembolsos por curso; série diária no fuso de Brasília', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const ana = await professional('Ana Souza')
    const bia = await professional('Bia Lima')
    const morena = await course(ana.id, 'Morena')
    const loiro = await course(bia.id, 'Loiro')
    // 02/11 01:00 UTC = 01/11 22:00 em Brasília: conta no dia 01.
    await event(morena.slug, 'view', '2026-11-02T01:00:00Z', { visitor: 'a' })
    await event(morena.slug, 'view', '2026-11-02T15:00:00Z', {
      visitor: 'b',
      device: 'mobile',
      referrer: 'l.instagram.com',
    })
    await event(morena.slug, 'cta', '2026-11-02T15:01:00Z')
    await event(morena.slug, 'checkout', '2026-11-02T15:02:00Z')
    await event(morena.slug, 'time', '2026-11-02T15:03:00Z', { ms: 60_000 })
    await event(loiro.slug, 'view', '2026-11-03T12:00:00Z')
    await event(morena.slug, 'view', '2026-12-10T12:00:00Z') // fora do período
    await payment(morena.id, 'T1', 'approved', 19_900, '2026-11-02T16:00:00Z')
    await payment(morena.id, 'T2', 'approved', 19_900, '2026-11-03T16:00:00Z')
    await payment(morena.id, 'T2', 'refunded', 19_900, '2026-11-04T16:00:00Z')

    const res = await client
      .get(`/admin/insights?${q({ from: '2026-11-01', to: '2026-11-30' })}`)
      .loginAs(admin)
    res.assertStatus(200)
    const body = res.body()
    assert.equal(body.range.days, 30)
    assert.equal(body.totals.views, 3)
    assert.equal(body.totals.sales, 2, 'compra aprovada continua compra depois do reembolso')
    assert.equal(body.totals.revenueCents, 39_800)
    assert.equal(body.totals.refunds, 1)
    assert.equal(body.totals.refundedCents, 19_900)
    const m = body.courses.find((c: { id: number }) => c.id === morena.id)
    assert.include(m, {
      views: 2,
      visitors: 2,
      cta: 1,
      checkout: 1,
      timeMs: 60_000,
      sales: 2,
      professionalName: 'Ana Souza',
    })
    assert.equal(body.series.find((d: { date: string }) => d.date === '2026-11-01').views, 1)
    assert.equal(body.series.find((d: { date: string }) => d.date === '2026-11-02').sales, 1)
    assert.deepEqual(body.origins.map((o: { origin: string }) => o.origin).sort(), [
      'direto',
      'instagram',
    ])
    assert.equal(body.options.professionals.length >= 2, true)
    assert.isFalse(body.scope.restricted)

    // Curso arquivado sem atividade no período não entra na tabela.
    const old = await course(ana.id, 'Antigo')
    await db.from('courses').where('id', old.id).update({ status: 'archived' })
    const again = (
      await client
        .get(`/admin/insights?${q({ from: '2026-11-01', to: '2026-11-30' })}`)
        .loginAs(admin)
    ).body()
    assert.notInclude(
      again.courses.map((c: { id: number }) => c.id),
      old.id
    )
  })

  test('filtros de profissional, curso, aparelho e origem', async ({ client, assert }) => {
    const admin = await makeUser('admin')
    const ana = await professional('Ana Souza')
    const bia = await professional('Bia Lima')
    const morena = await course(ana.id, 'Morena')
    const loiro = await course(bia.id, 'Loiro')
    await event(morena.slug, 'view', '2026-11-02T15:00:00Z', {
      device: 'mobile',
      referrer: 'instagram.com',
    })
    await event(morena.slug, 'view', '2026-11-02T15:00:00Z', { device: 'desktop' })
    await event(loiro.slug, 'view', '2026-11-02T15:00:00Z')
    const get = async (extra: Record<string, string | number>) =>
      (
        await client
          .get(`/admin/insights?${q({ from: '2026-11-01', to: '2026-11-30', ...extra })}`)
          .loginAs(admin)
      ).body()

    assert.equal((await get({ professionalId: ana.id })).totals.views, 2)
    assert.equal((await get({ courseId: loiro.id })).totals.views, 1)
    assert.equal((await get({ device: 'mobile' })).totals.views, 1)
    const insta = await get({ origin: 'instagram' })
    assert.equal(insta.totals.views, 1)
    assert.isTrue(insta.salesIgnoreAudience)
  })

  test('login de profissional só vê os próprios cursos, mesmo pedindo outro profissional ou curso', async ({
    client,
    assert,
  }) => {
    const ana = await professional('Ana Souza')
    const bia = await professional('Bia Lima')
    const morena = await course(ana.id, 'Morena')
    const loiro = await course(bia.id, 'Loiro')
    await event(morena.slug, 'view', '2026-11-02T15:00:00Z')
    await event(loiro.slug, 'view', '2026-11-02T15:00:00Z')
    await event(loiro.slug, 'view', '2026-11-02T15:00:00Z')
    const user = await makeUser('professional')
    user.professionalId = ana.id
    await user.save()
    const base = { from: '2026-11-01', to: '2026-11-30' }

    const own = (await client.get(`/admin/insights?${q(base)}`).loginAs(user)).body()
    assert.isTrue(own.scope.restricted)
    assert.equal(own.scope.professionalId, ana.id)
    assert.deepEqual(
      own.courses.map((c: { id: number }) => c.id),
      [morena.id]
    )
    assert.deepEqual(
      own.options.professionals.map((p: { id: number }) => p.id),
      [ana.id]
    )

    const other = (
      await client.get(`/admin/insights?${q({ ...base, professionalId: bia.id })}`).loginAs(user)
    ).body()
    assert.equal(other.totals.views, 1, 'o filtro de outro profissional é ignorado')
    ;(
      await client.get(`/admin/insights?${q({ ...base, courseId: loiro.id })}`).loginAs(user)
    ).assertStatus(404)

    // O resto do painel continua fechado para esse login.
    ;(await client.get('/admin/dashboard').loginAs(user)).assertStatus(403)
    ;(await client.get('/admin/professionals').loginAs(user)).assertStatus(403)
    ;(await client.get('/admin/courses').loginAs(user)).assertStatus(403)
  })

  test('permissões: sem sessão 401; editor e visualizador 403; profissional sem vínculo 403; datas inválidas 422', async ({
    client,
  }) => {
    const base = q({ from: '2026-11-01', to: '2026-11-30' })
    ;(await client.get(`/admin/insights?${base}`)).assertStatus(401)
    ;(await client.get(`/admin/insights?${base}`).loginAs(await makeUser('editor'))).assertStatus(
      403
    )
    ;(await client.get(`/admin/insights?${base}`).loginAs(await makeUser('viewer'))).assertStatus(
      403
    )
    ;(
      await client.get(`/admin/insights?${base}`).loginAs(await makeUser('professional'))
    ).assertStatus(403)
    const admin = await makeUser('admin')
    ;(
      await client
        .get(`/admin/insights?${q({ from: '2026-11-30', to: '2026-11-01' })}`)
        .loginAs(admin)
    ).assertStatus(422)
    ;(
      await client
        .get(`/admin/insights?${q({ from: '2025-01-01', to: '2026-11-30' })}`)
        .loginAs(admin)
    ).assertStatus(422)
    ;(
      await client.get(`/admin/insights?${q({ from: 'ontem', to: '2026-11-30' })}`).loginAs(admin)
    ).assertStatus(422)
  })
})

test.group('Insights · login de profissional na gestão de usuários', (group) => {
  group.each.setup(async () => {
    await resetIpRateLimits()
    return testUtils.db().withGlobalTransaction()
  })

  test('criar login de profissional exige o profissional; trocar o vínculo encerra as sessões', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const ana = await professional('Ana Souza')
    const bia = await professional('Bia Lima')
    const send = (method: 'post' | 'put', path: string, body: object) =>
      client[method](path).withCsrfToken().loginAs(admin).json(body)

    const missing = await send('post', '/admin/users', {
      email: `p${Date.now()}@teste.local`,
      fullName: 'Ana Souza',
      role: 'professional',
    })
    missing.assertStatus(422)
    assert.equal(missing.body().code, 'professional_required')

    const created = await send('post', '/admin/users', {
      email: `p${Date.now()}@teste.local`,
      fullName: 'Ana Souza',
      role: 'professional',
      professionalId: ana.id,
    })
    created.assertStatus(201)
    assert.equal(created.body().user.professionalId, ana.id)
    const id = created.body().user.id

    const before = (await db.from('users').where('id', id).first()).session_epoch
    const moved = await send('put', `/admin/users/${id}`, { professionalId: bia.id })
    moved.assertStatus(200)
    assert.equal(moved.body().professionalId, bia.id)
    assert.equal((await db.from('users').where('id', id).first()).session_epoch, before + 1)

    // Mudar para outro papel desfaz o vínculo.
    const editor = await send('put', `/admin/users/${id}`, { role: 'editor' })
    editor.assertStatus(200)
    assert.isNull(editor.body().professionalId)
  })
})
