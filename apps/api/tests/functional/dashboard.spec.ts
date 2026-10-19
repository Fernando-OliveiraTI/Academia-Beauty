/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).assertStatus()` mantém os testes legíveis */
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { makeUser } from '#tests/helpers'
import { resetTrackingLimiter } from '#services/tracking_service'

const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
const PHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'

async function insertPublishedProfessional(slug: string) {
  await db.table('professionals').insert({
    slug,
    status: 'published',
    revision: 1,
    data: JSON.stringify({ name: 'Ana Souza' }),
    name: 'Ana Souza',
    template_key: 'original',
    created_at: new Date(),
  })
}

test.group('Dashboard · coleta e indicadores', (group) => {
  group.each.setup(async () => {
    resetTrackingLimiter()
    return testUtils.db().withGlobalTransaction()
  })

  test('a coleta é pública, ignora bots, slugs inexistentes e tipos inválidos', async ({
    client,
    assert,
  }) => {
    await insertPublishedProfessional('ana-souza')
    const post = (body: object, ua = DESKTOP) =>
      client.post('/public/track').header('user-agent', ua).json(body)

    ;(await post({ kind: 'view', type: 'home' })).assertStatus(204)
    ;(await post({ kind: 'view', type: 'professional', slug: 'ana-souza' }, PHONE)).assertStatus(
      204
    )
    ;(await post({ kind: 'view', type: 'professional', slug: 'nao-existe' })).assertStatus(204)
    ;(await post({ kind: 'view', type: 'home' }, 'Googlebot/2.1')).assertStatus(204)
    ;(await post({ kind: 'hack', type: 'home' })).assertStatus(204)
    ;(await post({ kind: 'view', type: 'course', slug: '../etc' })).assertStatus(204)

    const rows = await db.from('page_events').select('resource_type', 'device', 'visitor_hash')
    assert.lengthOf(rows, 2)
    assert.deepEqual(rows.map((r) => r.device).sort(), ['desktop', 'mobile'])
    // O IP nunca é gravado: só o resumo diário.
    assert.isTrue(rows.every((r) => String(r.visitor_hash).length === 20))
  })

  test('o dashboard exige sessão e devolve totais, série completa e comparação com o período anterior', async ({
    client,
    assert,
  }) => {
    ;(await client.get('/admin/dashboard')).assertStatus(401)
    const viewer = await makeUser('viewer')
    await insertPublishedProfessional('ana-souza')
    const now = new Date()
    const old = new Date(now.getTime() - 10 * 86_400_000)
    const row = (kind: string, visitor: string, when = now) => ({
      kind,
      resource_type: 'professional',
      resource_slug: 'ana-souza',
      visitor_hash: visitor,
      device: 'desktop',
      referrer_host: null,
      created_at: when,
    })
    await db
      .table('page_events')
      .multiInsert([
        row('view', 'a'),
        row('view', 'a'),
        row('view', 'b'),
        row('cta', 'a'),
        row('checkout', 'a'),
        row('view', 'c', old),
      ])

    const res = await client.get('/admin/dashboard?days=7').loginAs(viewer)
    res.assertStatus(200)
    const body = res.body()
    assert.equal(body.range.days, 7)
    assert.lengthOf(body.series, 7)
    assert.deepInclude(body.totals.current, { views: 3, visitors: 2, cta: 1, checkout: 1 })
    assert.equal(body.totals.previous.views, 1)
    // O funil considera só páginas de curso (os eventos acima são de profissional).
    assert.deepEqual(body.funnel, { views: 0, cta: 0, checkout: 0 })
    assert.equal(body.topProfessionals[0].name, 'Ana Souza')
    assert.equal(body.topProfessionals[0].views, 3)
    assert.property(body.topProfessionals[0], 'photo')
    assert.equal(body.catalog.professionals.published, 1)
    assert.equal(body.catalog.publishedPages, 1)
    // Valor inválido de período cai no padrão de 30 dias.
    const fallback = await client.get('/admin/dashboard?days=5').loginAs(viewer)
    assert.equal(fallback.body().range.days, 30)
  })
})
