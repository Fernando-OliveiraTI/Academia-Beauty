/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).assertStatus()` mantém os testes legíveis */
import { createHmac } from 'node:crypto'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { makeUser } from '#tests/helpers'
import { resetWebhookLimiter } from '#controllers/themembers_webhook_controller'
import { resetIpRateLimits } from '#services/ip_rate_limit'
import { applyIpMode, clean, geoFromHeaders, truncateIp } from '#services/checkout_session_service'
import { parseUserAgent } from '#services/user_agent'

const SECRET = 'segredo-de-teste-do-webhook-1234567890'
const sign = (body: string) => createHmac('sha256', SECRET).update(body).digest('hex')

const UA = {
  chromeWin:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  instagramIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E236 Instagram 330.0.0.12.109 (iPhone14,5; iOS 17_4; pt_BR; pt-BR)',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  edgeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  samsung:
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SD1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.108;]',
  bot: 'Googlebot/2.1 (+http://www.google.com/bot.html)',
}

const REF = 'ab_k3j9x0q2m7v5n1c8w4zt'
const REF2 = 'ab_p0o9i8u7y6t5r4e3w2qa'
const REF3 = 'ab_a1b2c3d4e5f6g7h8i9j0'

test.group('Visitas ao checkout · leitura do navegador, IP e cidade (funções puras)', () => {
  test('parseUserAgent identifica navegador, sistema, aparelho e navegador embutido de redes sociais', ({
    assert,
  }) => {
    assert.deepInclude(parseUserAgent(UA.chromeWin), {
      browser: 'Chrome',
      browserVersion: '126',
      os: 'Windows',
      device: 'desktop',
      inApp: null,
    })
    assert.deepInclude(parseUserAgent(UA.safariIphone), {
      browser: 'Safari',
      browserVersion: '17',
      os: 'iOS',
      osVersion: '17',
      device: 'mobile',
    })
    assert.deepInclude(parseUserAgent(UA.instagramIphone), {
      os: 'iOS',
      device: 'mobile',
      inApp: 'Instagram',
    })
    assert.deepInclude(parseUserAgent(UA.chromeAndroid), {
      browser: 'Chrome',
      os: 'Android',
      osVersion: '14',
      device: 'mobile',
    })
    assert.deepInclude(parseUserAgent(UA.firefoxLinux), {
      browser: 'Firefox',
      os: 'Linux',
      device: 'desktop',
    })
    assert.deepInclude(parseUserAgent(UA.edgeMac), {
      browser: 'Edge',
      os: 'macOS',
      device: 'desktop',
    })
    assert.deepInclude(parseUserAgent(UA.ipad), { os: 'iOS', device: 'tablet' })
    assert.deepInclude(parseUserAgent(UA.samsung), {
      browser: 'Samsung Internet',
      os: 'Android',
      device: 'mobile',
    })
    assert.equal(parseUserAgent(UA.facebookAndroid).inApp, 'Facebook')
    assert.equal(parseUserAgent(UA.bot).device, 'bot')
    assert.deepInclude(parseUserAgent(''), { browser: 'Desconhecido', os: 'Desconhecido' })
    assert.equal(parseUserAgent(undefined).device, 'desktop')
  })

  test('modos de IP: completo, truncado (IPv4 /24, IPv6 /48) e nenhum', ({ assert }) => {
    assert.equal(applyIpMode('203.0.113.77', 'full'), '203.0.113.77')
    assert.equal(applyIpMode('203.0.113.77', 'truncated'), '203.0.113.0')
    assert.equal(truncateIp('2001:db8:abcd:12::1'), '2001:db8:abcd::')
    assert.equal(
      truncateIp('::ffff:203.0.113.77'),
      '203.0.113.0',
      'IPv4 mapeado em IPv6 vale como IPv4'
    )
    assert.isNull(applyIpMode('203.0.113.77', 'none'))
    assert.isNull(applyIpMode(null, 'full'))
    assert.equal(applyIpMode('203.0.113.77'), '203.0.113.77', 'padrão é completo')
  })

  test('geoFromHeaders lê Cloudflare, Vercel e CloudFront, decodifica a cidade e recusa país inválido', ({
    assert,
  }) => {
    assert.deepEqual(
      geoFromHeaders({
        'cf-ipcountry': 'br',
        'cf-ipcity': 'S%C3%A3o%20Paulo',
        'cf-region': 'São Paulo',
      }),
      { country: 'BR', region: 'São Paulo', city: 'São Paulo' }
    )
    assert.deepEqual(
      geoFromHeaders({
        'x-vercel-ip-country': 'BR',
        'x-vercel-ip-country-region': 'RJ',
        'x-vercel-ip-city': 'Rio%20de%20Janeiro',
      }),
      { country: 'BR', region: 'RJ', city: 'Rio de Janeiro' }
    )
    assert.equal(
      geoFromHeaders({ 'cloudfront-viewer-country': 'PT', 'cloudfront-viewer-city': 'Lisboa' })
        .city,
      'Lisboa'
    )
    assert.deepEqual(geoFromHeaders({ 'cf-ipcountry': 'XX' }), {
      country: null,
      region: null,
      city: null,
    })
    assert.equal(geoFromHeaders({ 'cf-ipcountry': 'Brasil' }).country, null)
    assert.deepEqual(geoFromHeaders({}), { country: null, region: null, city: null })
    assert.equal(
      geoFromHeaders({ 'cf-ipcity': '%E0%A4%A' }).city,
      '%E0%A4%A',
      'texto mal codificado não quebra'
    )
  })

  test('clean remove caracteres de controle, apara e corta; vazio e não-texto viram null', ({
    assert,
  }) => {
    assert.equal(clean('  Olá\u0000\n mundo\u007f ', 20), 'Olá mundo')
    assert.equal(clean('abcdef', 3), 'abc')
    assert.isNull(clean('   ', 10))
    assert.isNull(clean(42, 10))
  })
})

test.group('Visitas ao checkout · registro pela página', (group) => {
  const saved: Record<string, string | boolean | undefined> = {}
  group.each.setup(async () => {
    await resetIpRateLimits()
    for (const key of ['CHECKOUT_SESSIONS_ENABLED', 'CHECKOUT_SESSIONS_IP_MODE'] as const)
      saved[key] = env.get(key) as never
    env.set('CHECKOUT_SESSIONS_ENABLED', true)
    env.set('CHECKOUT_SESSIONS_IP_MODE', 'full')
    return testUtils.db().withGlobalTransaction()
  })
  group.each.teardown(() => {
    env.set('CHECKOUT_SESSIONS_ENABLED', (saved.CHECKOUT_SESSIONS_ENABLED ?? true) as never)
    env.set('CHECKOUT_SESSIONS_IP_MODE', (saved.CHECKOUT_SESSIONS_IP_MODE ?? 'full') as never)
  })

  const send = (client: any, body: object, headers: Record<string, string> = {}) => {
    let req = client.post('/public/checkout-sessions').header('user-agent', UA.instagramIphone)
    for (const [k, v] of Object.entries(headers)) req = req.header(k, v)
    return req.json(body)
  }

  test('grava a visita com navegador, origem, tela e cidade; guarda só o host do referenciador e o caminho sem query', async ({
    client,
    assert,
  }) => {
    ;(
      await send(
        client,
        {
          ref: REF,
          slug: 'curso-inexistente',
          timezone: 'America/Sao_Paulo',
          language: 'pt-BR',
          viewport: { w: 390, h: 844 },
          referrer: 'https://www.instagram.com/p/abc123/?igsh=segredo',
          landing: '/cursos/morena?fbclid=abc&email=a@b.com',
          utm: {
            source: 'instagram',
            medium: 'bio',
            campaign: 'lancamento',
            content: 'story',
            term: 'corte',
          },
          clickId: true,
        },
        { 'cf-ipcountry': 'BR', 'cf-ipcity': 'S%C3%A3o%20Paulo', 'cf-region': 'SP' }
      )
    ).assertStatus(204)
    const row = await db.from('checkout_sessions').first()
    assert.equal(row.ref, REF)
    assert.deepInclude(row, {
      browser: 'Instagram',
      os: 'iOS',
      device: 'mobile',
      in_app: 'Instagram',
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      viewport_w: 390,
      viewport_h: 844,
    })
    assert.deepInclude(row, { country: 'BR', region: 'SP', city: 'São Paulo' })
    assert.equal(
      row.referrer_host,
      'instagram.com',
      'só o host: nada de caminho nem parâmetros do referenciador'
    )
    assert.equal(
      row.landing_path,
      '/cursos/morena',
      'sem query (e-mail e ids de clique não são guardados)'
    )
    assert.deepInclude(row, {
      utm_source: 'instagram',
      utm_medium: 'bio',
      utm_campaign: 'lancamento',
      utm_content: 'story',
      utm_term: 'corte',
    })
    assert.isTrue(Boolean(row.has_click_id), 'só registra que havia id de clique, não o valor')
    assert.isNotNull(row.ip)
    assert.isNull(row.course_id, 'slug que não existe não liga a curso nenhum')
    assert.equal(row.visits, 1)
  })

  test('a mesma aba abrindo de novo (mesmo código) só soma a visita; formato de código inválido não grava', async ({
    client,
    assert,
  }) => {
    ;(await send(client, { ref: REF })).assertStatus(204)
    ;(await send(client, { ref: REF })).assertStatus(204)
    ;(await send(client, { ref: REF.toUpperCase() })).assertStatus(204)
    ;(await send(client, { ref: 'ab_curto' })).assertStatus(204)
    ;(await send(client, { ref: "ab_k3j9x0q2m7v5n1c8w4z'--" })).assertStatus(204)
    ;(await send(client, {})).assertStatus(204)
    const rows = await db.from('checkout_sessions')
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].visits, 3)
  })

  test('campos fora do formato viram nulos e nada quebra (fuso, idioma, tela, UTM com lixo)', async ({
    client,
    assert,
  }) => {
    ;(
      await send(client, {
        ref: REF,
        timezone: '<script>',
        language: 'x'.repeat(30),
        viewport: { w: 999999, h: -3 },
        utm: { source: 'a\u0000b\nc'.padEnd(500, 'z') },
        referrer: 'não é url',
        landing: 'sem-barra',
      })
    ).assertStatus(204)
    const row = await db.from('checkout_sessions').first()
    assert.isNull(row.timezone)
    assert.isNull(row.language)
    assert.isNull(row.viewport_w)
    assert.isNull(row.viewport_h)
    assert.isNull(row.referrer_host)
    assert.isNull(row.landing_path)
    assert.equal(row.utm_source.length, 80)
    assert.notInclude(row.utm_source, '\u0000')
  })

  test('modo de IP truncado guarda só a rede; modo "none" não guarda IP; desligado não grava nada', async ({
    client,
    assert,
  }) => {
    env.set('CHECKOUT_SESSIONS_IP_MODE', 'truncated')
    ;(await send(client, { ref: REF })).assertStatus(204)
    env.set('CHECKOUT_SESSIONS_IP_MODE', 'none')
    ;(await send(client, { ref: REF2 })).assertStatus(204)
    const rows = await db.from('checkout_sessions').orderBy('id')
    assert.match(rows[0].ip, /\.0$|::$/)
    assert.isNull(rows[1].ip)
    env.set('CHECKOUT_SESSIONS_ENABLED', false)
    ;(await send(client, { ref: REF3 })).assertStatus(204)
    assert.lengthOf(await db.from('checkout_sessions'), 2)
  })

  test('o curso é ligado pelo slug e o registro antigo passa da retenção e é apagado', async ({
    client,
    assert,
  }) => {
    await db.table('professionals').insert({
      slug: 'p-sess',
      status: 'draft',
      revision: 1,
      data: JSON.stringify({ name: 'P' }),
      name: 'P',
      template_key: 'professional-original',
      created_at: new Date(),
    })
    const pro = await db.from('professionals').where('slug', 'p-sess').first()
    await db.table('courses').insert({
      professional_id: pro.id,
      slug: 'curso-sess',
      status: 'draft',
      revision: 1,
      data: JSON.stringify({ title: 'Curso Sess' }),
      title: 'Curso Sess',
      created_at: new Date(),
    })
    await db.table('checkout_sessions').insert({
      ref: REF3,
      created_at: DateTime.utc().minus({ days: 400 }).toSQL({ includeOffset: false }),
      last_seen_at: new Date(),
      visits: 1,
      has_click_id: false,
    })
    ;(await send(client, { ref: REF, slug: 'curso-sess' })).assertStatus(204)
    const rows = await db.from('checkout_sessions')
    assert.lengthOf(rows, 1, 'a visita de 400 dias saiu (retenção padrão de 180)')
    assert.equal(rows[0].course_slug, 'curso-sess')
    assert.isNotNull(rows[0].course_id)
  })

  test('limita registros por IP (429)', async ({ client, assert }) => {
    let last = 0
    for (let i = 0; i < 22; i++) last = (await send(client, { ref: REF })).status()
    assert.equal(last, 429)
  })
})

test.group('Visitas ao checkout · painel do administrador e ligação com o pagamento', (group) => {
  let secret: string | undefined
  let token: string | undefined
  group.each.setup(async () => {
    resetWebhookLimiter()
    await resetIpRateLimits()
    secret = env.get('THEMEMBERS_WEBHOOK_SECRET')
    token = env.get('THEMEMBERS_WEBHOOK_TOKEN')
    env.set('THEMEMBERS_WEBHOOK_SECRET', SECRET)
    env.set('THEMEMBERS_WEBHOOK_TOKEN', '')
    env.set('CHECKOUT_SESSIONS_ENABLED', true)
    env.set('CHECKOUT_SESSIONS_IP_MODE', 'full')
    return testUtils.db().withGlobalTransaction()
  })
  group.each.teardown(() => {
    env.set('THEMEMBERS_WEBHOOK_SECRET', secret ?? '')
    env.set('THEMEMBERS_WEBHOOK_TOKEN', token ?? '')
  })

  const visit = (
    client: any,
    ref: string,
    ua = UA.chromeWin,
    headers: Record<string, string> = {}
  ) => {
    let req = client.post('/public/checkout-sessions').header('user-agent', ua)
    for (const [k, v] of Object.entries(headers)) req = req.header(k, v)
    return req.json({ ref, utm: { source: 'instagram' }, viewport: { w: 400, h: 800 } })
  }
  const pay = async (
    client: any,
    ref: string | null,
    event: string,
    status: string,
    when: string,
    tx: string
  ) => {
    const body = JSON.stringify({
      payload: {
        object: 'transaction',
        event,
        created_at: when,
        data: {
          id: tx,
          status,
          transaction: { currency: 'brl', amount: 29700, total_amount: 29700 },
          payment_details: {
            payment_method: 'pix',
            pix: { qrcode_url: 'u', qrcode_data: 'd', expiration: 1 },
          },
          order: {
            id: 1,
            customer: {
              id: '1',
              name: 'Maria Souza Lima',
              email: 'maria.lima@exemplo.com.br',
              document_number: '52998224725',
            },
            main_product: { id: 4321, title: 'Curso', price: 29700 },
            order_bump: [],
            utms: ref ? [{ utm_content: ref }] : [],
          },
          subscription: null,
        },
      },
    })
    ;(
      await client
        .post('/webhooks/themembers')
        .header('x-signature', sign(body))
        .json(JSON.parse(body))
    ).assertStatus(200)
  }

  test('só administrador lê: editor e viewer 403, sem sessão 401', async ({ client }) => {
    for (const path of [
      '/admin/checkout-sessions',
      '/admin/checkout-sessions/insights',
      '/admin/checkout-sessions/1',
    ]) {
      ;(await client.get(path)).assertStatus(401)
      ;(await client.get(path).loginAs(await makeUser('editor'))).assertStatus(403)
      ;(await client.get(path).loginAs(await makeUser('viewer'))).assertStatus(403)
    }
  })

  test('cada visita mostra o pagamento ligado pelo código (último evento vale), comprador mascarado e a chamada bruta', async ({
    client,
    assert,
  }) => {
    await visit(client, REF, UA.instagramIphone, { 'cf-ipcity': 'Recife', 'cf-ipcountry': 'BR' })
    await visit(client, REF2, UA.chromeWin)
    await visit(client, REF3, UA.safariIphone)
    await pay(client, REF, 'transaction.pix_generated', 'pending', '2026-10-19 10:00:00', '1')
    await pay(client, REF, 'transaction.approved', 'approved', '2026-10-19 10:05:00', '1')
    await pay(client, REF2, 'transaction.failed', 'failed', '2026-10-19 11:00:00', '2')
    await pay(client, null, 'transaction.approved', 'approved', '2026-10-19 12:00:00', '3') // sem código: não liga a nenhuma visita

    const admin = await makeUser('admin')
    const list = await client.get('/admin/checkout-sessions').loginAs(admin)
    list.assertStatus(200)
    const body = list.body()
    assert.deepEqual(body.counts, { all: 3, paid: 1, pending: 0, refunded: 0, failed: 1, none: 1 })
    const paid = body.items.find((i: any) => i.ref === REF)
    assert.deepInclude(paid.payment, {
      state: 'paid',
      status: 'approved',
      method: 'pix',
      amountCents: 29700,
      buyerName: 'Maria L.',
      buyerEmail: 'm***@e***.com.br',
      events: 2,
    })
    assert.deepInclude(paid, {
      browser: 'Instagram',
      os: 'iOS',
      city: 'Recife',
      inApp: 'Instagram',
    })
    assert.equal(paid.utm.source, 'instagram')
    assert.equal(body.items.find((i: any) => i.ref === REF2).payment.state, 'failed')
    assert.isNull(body.items.find((i: any) => i.ref === REF3).payment, 'visitou e não pagou')
    const raw = JSON.stringify(body)
    for (const leak of ['maria.lima', '52998224725', 'Maria Souza Lima'])
      assert.notInclude(raw, leak)

    const detail = await client.get(`/admin/checkout-sessions/${paid.id}`).loginAs(admin)
    detail.assertStatus(200)
    assert.isNumber(
      detail.body().payment.deliveryId,
      'liga à chamada bruta do webhook para conferência'
    )
    ;(await client.get('/admin/checkout-sessions/999999').loginAs(admin)).assertStatus(404)
  })

  test('o detalhe da visita guarda o histórico: compra, reembolso pendente e reembolso, sem apagar a compra', async ({
    client,
    assert,
  }) => {
    await visit(client, REF)
    await pay(client, REF, 'transaction.failed', 'failed', '2026-10-19 09:00:00', '2')
    await pay(client, REF, 'transaction.pix_generated', 'pending', '2026-10-19 10:00:00', '1')
    await pay(client, REF, 'transaction.approved', 'approved', '2026-10-19 10:05:00', '1')
    await pay(
      client,
      REF,
      'transaction.pending_refund',
      'pending_refund',
      '2026-10-19 11:00:00',
      '1'
    )
    // o reembolso concluído chega sem o código da visita: entra pelo ID da transação
    await pay(client, null, 'transaction.refunded', 'refunded', '2026-10-19 11:10:00', '1')

    const admin = await makeUser('admin')
    const list = await client.get('/admin/checkout-sessions').loginAs(admin)
    const session = list.body().items.find((i: any) => i.ref === REF)
    assert.equal(
      session.payment.status,
      'refunded',
      'a lista mostra só a situação mais recente (o reembolso sem código herda o da compra)'
    )
    assert.equal(session.payment.state, 'refunded', 'reembolso não é "não aprovado"')
    assert.equal(list.body().counts.refunded, 1)
    const onlyRefunded = await client.get('/admin/checkout-sessions?state=refunded').loginAs(admin)
    assert.deepEqual(
      onlyRefunded.body().items.map((i: any) => i.ref),
      [REF]
    )

    const detail = await client.get(`/admin/checkout-sessions/${session.id}`).loginAs(admin)
    detail.assertStatus(200)
    const { history } = detail.body()
    assert.lengthOf(history, 2, 'duas transações: a recusada e a paga')
    assert.equal(history[0].transactionId, '2', 'ordenadas pela primeira etapa')
    assert.deepEqual(
      history[1].events.map((e: any) => e.status),
      ['pending', 'approved', 'pending_refund', 'refunded']
    )
    assert.equal(history[1].events[1].amountCents, 29700)
    assert.notInclude(JSON.stringify(history), 'maria.lima')
  })

  test('as contagens das abas só consideram visitas que existem (pagamento com código desconhecido não conta)', async ({
    client,
    assert,
  }) => {
    await visit(client, REF)
    await pay(client, REF, 'transaction.approved', 'approved', '2026-10-19 10:00:00', '1')
    await pay(client, REF3, 'transaction.approved', 'approved', '2026-10-19 11:00:00', '2') // código que nunca abriu a página
    const admin = await makeUser('admin')
    const body = (await client.get('/admin/checkout-sessions').loginAs(admin)).body()
    assert.deepEqual(body.counts, {
      all: 1,
      paid: 1,
      pending: 0,
      refunded: 0,
      failed: 0,
      none: 0,
    })
    assert.equal(body.total, 1)
  })

  test('filtros por situação, busca por navegador/cidade/origem/código, ordem e itens por página', async ({
    client,
    assert,
  }) => {
    await visit(client, REF, UA.instagramIphone, { 'cf-ipcity': 'Recife' })
    await visit(client, REF2, UA.chromeWin, { 'cf-ipcity': 'Curitiba' })
    await visit(client, REF3, UA.safariIphone)
    await pay(client, REF, 'transaction.approved', 'approved', '2026-10-19 10:00:00', '1')
    await pay(client, REF2, 'transaction.pix_generated', 'pending', '2026-10-19 11:00:00', '2')
    const admin = await makeUser('admin')
    const get = async (q: string) =>
      (await client.get(`/admin/checkout-sessions${q}`).loginAs(admin)).body()
    assert.deepEqual(
      (await get('?state=paid')).items.map((i: any) => i.ref),
      [REF]
    )
    assert.deepEqual(
      (await get('?state=pending')).items.map((i: any) => i.ref),
      [REF2]
    )
    assert.deepEqual(
      (await get('?state=none')).items.map((i: any) => i.ref),
      [REF3]
    )
    assert.equal((await get('?state=failed')).total, 0)
    assert.equal((await get('?q=Recife')).total, 1)
    assert.equal((await get('?q=instagram')).total, 3, 'a origem (utm) também é pesquisável')
    assert.equal((await get(`?q=${REF2}`)).items[0].ref, REF2)
    assert.equal((await get('?q=%25')).total, 0, 'curingas do LIKE valem como texto')
    const newest = await get('')
    const oldest = await get('?sort=oldest')
    assert.equal(newest.items[0].ref, oldest.items.at(-1).ref)
    assert.equal((await get('?perPage=10')).perPage, 10)
    assert.equal((await get('?perPage=7')).perPage, 20)
  })

  test('insights: totais, conversão e perfil do público (aparelho, navegador, sistema, cidade, origem)', async ({
    client,
    assert,
  }) => {
    await visit(client, REF, UA.instagramIphone, { 'cf-ipcity': 'Recife', 'cf-ipcountry': 'BR' })
    await visit(client, REF2, UA.chromeWin, { 'cf-ipcity': 'Recife', 'cf-ipcountry': 'BR' })
    await visit(client, REF3, UA.chromeAndroid)
    await pay(client, REF, 'transaction.approved', 'approved', '2026-10-19 10:00:00', '1')
    const admin = await makeUser('admin')
    const res = await client.get('/admin/checkout-sessions/insights?days=7').loginAs(admin)
    res.assertStatus(200)
    const b = res.body()
    assert.deepInclude(b, {
      days: 7,
      sessions: 3,
      paid: 1,
      withPayment: 1,
      paidCents: 29700,
      conversionPct: 33.3,
    })
    assert.deepEqual(
      b.device.find((d: any) => d.label === 'mobile'),
      { label: 'mobile', count: 2 }
    )
    assert.deepEqual(b.city[0], { label: 'Recife', count: 2 })
    assert.deepEqual(b.source[0], { label: 'instagram', count: 3 })
    assert.isTrue(b.browser.some((x: any) => x.label === 'Instagram (app)'))
    assert.lengthOf(b.byDay, 7)
    assert.lengthOf(b.hoursUtc, 24)
    assert.equal(
      (await client.get('/admin/checkout-sessions/insights?days=5').loginAs(admin)).body().days,
      30
    )
  })
})
