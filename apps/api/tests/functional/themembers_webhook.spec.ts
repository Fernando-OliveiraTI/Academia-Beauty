/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).assertStatus()` mantém os testes legíveis */
import { createHmac } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { makeUser } from '#tests/helpers'
import { resetWebhookLimiter } from '#controllers/themembers_webhook_controller'
import { resetCheckoutStatusLimiter } from '#controllers/public_checkout_status_controller'
import ThemembersWebhookService, {
  findRef,
  maskEmail,
  maskName,
  parseBody,
  redact,
  summarize,
  verifySignature,
} from '#services/themembers_webhook_service'

const SECRET = 'segredo-de-teste-do-webhook-1234567890'
const sign = (body: string, secret = SECRET) =>
  createHmac('sha256', secret).update(body).digest('hex')

/** Venda única (envelope `company` + `payload`), no formato da documentação. */
const sale = (
  over: { event?: string; txId?: string; productId?: number; status?: string } = {}
) => ({
  company: {
    id: 'c1',
    name: 'Empresa Teste',
    email: 'empresa@teste.com',
    phone: '11999990000',
    document_type: 'cnpj',
    document_number: '12345678000199',
    owner: {
      id: 'o1',
      name: 'Dono',
      email: 'dono@teste.com',
      phone: null,
      document_type: 'cpf',
      document_number: '12345678901',
    },
  },
  payload: {
    object: 'transaction',
    event: over.event ?? 'transaction.approved',
    created_at: '2026-10-19 14:30:00',
    data: {
      id: over.txId ?? '7405530052968814123',
      paid_at: '2026-10-19T14:30:00Z',
      status: over.status ?? 'approved',
      transaction: {
        currency: 'brl',
        amount: 10260,
        buyer_fees: 0,
        total_amount: 10260,
        cupom: null,
      },
      payment_details: {
        payment_method: 'credit_card',
        credit_card: { instalments: 3, brand: 'mastercard', last_digit: 4242 },
        pix: null,
        boleto: null,
      },
      comissions: [],
      order: {
        id: '7405530048429536111',
        customer: {
          id: 'u1',
          name: 'Maria Souza Lima',
          email: 'maria.lima@exemplo.com.br',
          phone_country: '55',
          phone: '11988887777',
          document_type: 'cpf',
          document_number: '52998224725',
        },
        main_product: { id: over.productId ?? 4321, title: 'Produto 1', price: 10000 },
        order_bump: [],
        utms: [],
      },
      subscription: null,
    },
  },
})

test.group('The Members · assinatura e leitura do corpo (funções puras)', () => {
  test('verifySignature aceita só o HMAC correto, em hex ou base64, e recusa o resto', ({
    assert,
  }) => {
    const raw = JSON.stringify(sale())
    assert.equal(verifySignature(raw, sign(raw), SECRET), 'raw+hex')
    assert.equal(verifySignature(raw, `sha256=${sign(raw)}`, SECRET), 'raw+hex')
    assert.equal(verifySignature(raw, sign(raw).toUpperCase(), SECRET), 'raw+hex')
    const b64 = createHmac('sha256', SECRET).update(raw).digest('base64')
    assert.equal(verifySignature(raw, b64, SECRET), 'raw+base64')
    assert.isNull(verifySignature(raw, sign(raw, 'outro-segredo'), SECRET))
    assert.isNull(verifySignature(raw, sign(raw + ' '), SECRET))
    assert.isNull(verifySignature(raw, undefined, SECRET))
    assert.isNull(verifySignature(raw, '', SECRET))
    assert.isNull(verifySignature(raw, sign(raw), ''))
    assert.isNull(verifySignature('não é json', sign('não é json'), SECRET))
  })

  test('variantes documentadas: JSON normalizado e URL + corpo', ({ assert }) => {
    const pretty = JSON.stringify(sale(), null, 2)
    const compact = JSON.stringify(JSON.parse(pretty))
    assert.equal(verifySignature(pretty, sign(compact), SECRET), 'json+hex')
    const url = 'https://site.exemplo.com/api/webhooks/themembers'
    assert.equal(verifySignature(compact, sign(`${url}:${compact}`), SECRET, url), 'url+raw+hex')
    // A variante com URL só vale quando a URL está configurada.
    assert.isNull(verifySignature(compact, sign(`${url}:${compact}`), SECRET))
  })

  test('IDs acima de 2^53 chegam como texto exato (sem perder precisão)', ({ assert }) => {
    const parsed = parseBody(
      '{"payload":{"data":{"id":7405530052968814123,"order":{"id":7405530048429536111},"valor":1}}}'
    ) as any
    assert.strictEqual(parsed.payload.data.id, '7405530052968814123')
    assert.strictEqual(parsed.payload.data.order.id, '7405530048429536111')
    assert.strictEqual(parsed.payload.data.valor, 1)
    assert.isNull(parseBody('{'))
  })

  test('máscaras: e-mail e nome nunca saem inteiros; redact tira documento, telefone, QR Code e empresa', ({
    assert,
  }) => {
    assert.equal(maskEmail('maria.lima@exemplo.com.br'), 'm***@e***.com.br')
    assert.equal(maskName('Maria Souza Lima'), 'Maria L.')
    assert.equal(maskName('Cher'), 'Cher')
    const clean = JSON.stringify(redact(sale()))
    for (const secret of [
      '52998224725',
      '11988887777',
      '12345678000199',
      'maria.lima@exemplo.com.br',
      'Maria Souza Lima',
      'empresa@teste.com',
      'Empresa Teste',
    ]) {
      assert.notInclude(clean, secret)
    }
    assert.include(clean, 'm***@e***.com.br')
    assert.include(clean, 'Maria L.')
    assert.include(clean, 'mastercard')
    const pix = JSON.stringify(
      redact({
        pix: { qrcode_data: '000201...', qrcode_url: 'https://q', expiration: 1 },
        boleto: { barcode_data: '123', barcode_url: 'u', expiration: 'x' },
      })
    )
    assert.notInclude(pix, '000201')
    assert.notInclude(pix, 'barcode_data')
  })

  test('summarize trata venda única, assinatura (campos na raiz) e eventos de pedido/acesso', ({
    assert,
  }) => {
    const s = summarize(sale())!
    assert.deepInclude(s, {
      event: 'transaction.approved',
      kind: 'transaction',
      status: 'approved',
      externalProductId: '4321',
      paymentMethod: 'credit_card',
      amountCents: 10260,
      currency: 'BRL',
      instalments: 3,
      cardBrand: 'mastercard',
      buyerName: 'Maria L.',
      buyerEmail: 'm***@e***.com.br',
    })
    assert.equal(s.occurredAt.toUTC().toISO(), '2026-10-19T14:30:00.000Z')

    const subscription = summarize({
      object: 'transaction',
      event: 'transaction.refunded',
      created_at: '2026-10-19T10:00:00Z',
      data: {
        id: '7405759151497423001',
        status: 'refunded',
        transaction: { currency: 'brl', amount: 12333, buyer_fees: 0, total_amount: 12333 },
        payment_details: {
          payment_method: 'pix',
          credit_card: null,
          pix: { qrcode_url: 'u', qrcode_data: 'd', expiration: 1 },
          boleto: null,
        },
        subscription: {
          code: 'SB1',
          periodicity: 'monthly',
          product: { id: 777, title: 'Plano', price: 12333 },
          subscriber: { id: 's1', name: 'Joao Silva', email: 'joao@x.com' },
        },
      },
    })!
    assert.deepInclude(subscription, {
      status: 'refunded',
      externalProductId: '777',
      buyerName: 'Joao S.',
      paymentMethod: 'pix',
      amountCents: 12333,
    })

    const order = summarize({
      payload: {
        object: 'order',
        event: 'order.completed',
        created_at: '2026-10-19 15:00:00',
        data: {
          customer: { id: '1', name: 'Ana B', email: 'a@b.com' },
          main_product: { id: 4321, title: 'P', price: 1 },
          order_bump: [],
          transactions: [
            {
              payment_method: 'pix',
              instalments: 1,
              currency: 'BRL',
              value: 5000,
              status: 'approved',
            },
          ],
          utms: [],
        },
      },
    })!
    assert.deepInclude(order, {
      kind: 'order',
      status: 'completed',
      externalProductId: '4321',
      amountCents: 5000,
      externalTransactionId: null,
    })
    assert.equal(summarize({ payload: { event: 'release.access', data: {} } })!.status, 'granted')
    assert.isNull(summarize({ payload: { event: 'EVIL <script>', data: {} } }))
    assert.isNull(summarize('texto'))
    assert.isNull(summarize({ foo: 1 }))
  })
})

test.group('The Members · receptor do webhook', (group) => {
  let previous: string | undefined
  group.each.setup(async () => {
    resetWebhookLimiter()
    previous = env.get('THEMEMBERS_WEBHOOK_SECRET')
    env.set('THEMEMBERS_WEBHOOK_SECRET', SECRET)
    return testUtils.db().withGlobalTransaction()
  })
  group.each.teardown(() => {
    env.set('THEMEMBERS_WEBHOOK_SECRET', previous ?? '')
  })

  const signed = (client: any, body: object, secret = SECRET) =>
    client
      .post('/webhooks/themembers')
      .header('x-signature', sign(JSON.stringify(body), secret))
      .json(body)

  test('grava o evento tratado e mascarado; assinatura errada ou ausente é 403 e nada é gravado', async ({
    client,
    assert,
  }) => {
    const ok = await signed(client, sale())
    ok.assertStatus(200)
    assert.deepEqual(ok.body(), { received: true, duplicate: false })
    const row = await db.from('payment_events').first()
    assert.equal(row.event, 'transaction.approved')
    assert.equal(row.status, 'approved')
    assert.equal(row.external_product_id, '4321')
    assert.equal(row.external_transaction_id, '7405530052968814123')
    assert.equal(row.amount_cents, 10260)
    assert.equal(row.buyer_name, 'Maria L.')
    assert.equal(row.signature_scheme, 'raw+hex')
    assert.notInclude(JSON.stringify(row), '52998224725')
    assert.notInclude(JSON.stringify(row), 'maria.lima@exemplo.com.br')

    ;(await signed(client, sale({ txId: '1' }), 'segredo-errado')).assertStatus(403)
    ;(await client.post('/webhooks/themembers').json(sale({ txId: '2' }))).assertStatus(403)
    assert.lengthOf(await db.from('payment_events'), 1)
  })

  test('retentativa do mesmo corpo é 200 e não duplica (idempotência)', async ({
    client,
    assert,
  }) => {
    const body = sale()
    ;(await signed(client, body)).assertStatus(200)
    const again = await signed(client, body)
    again.assertStatus(200)
    assert.deepEqual(again.body(), { received: true, duplicate: true })
    assert.lengthOf(await db.from('payment_events'), 1)
  })

  test('sem segredo configurado nada é aceito (503), mesmo com assinatura "válida"', async ({
    client,
    assert,
  }) => {
    env.set('THEMEMBERS_WEBHOOK_SECRET', '')
    const res = await client
      .post('/webhooks/themembers')
      .header('x-signature', sign(JSON.stringify(sale()), ''))
      .json(sale())
    res.assertStatus(503)
    assert.equal(res.body().code, 'webhook_not_configured')
    assert.lengthOf(await db.from('payment_events'), 0)
  })

  test('corpo vazio ou evento desconhecido: 400, sem gravar', async ({ client, assert }) => {
    const unknown = { payload: { object: 'x', event: 'coisa.estranha!', data: {} } }
    const res = await signed(client, unknown)
    res.assertStatus(400)
    assert.equal(res.body().code, 'invalid_payload')
    assert.lengthOf(await db.from('payment_events'), 0)
  })

  test('o CSRF não bloqueia o webhook (servidor→servidor) e a rota não exige sessão', async ({
    client,
  }) => {
    ;(await signed(client, sale({ txId: '99' }))).assertStatus(200)
  })

  test('limita enchente por IP (429) sem gravar o excedente', async ({ client, assert }) => {
    let last = 0
    for (let i = 0; i < 302; i++) {
      const res = await client.post('/webhooks/themembers').json({ i })
      last = res.status()
    }
    assert.equal(last, 429)
    assert.lengthOf(await db.from('payment_events'), 0)
  })
})

test.group('The Members · pagamentos no curso (painel)', (group) => {
  let previous: string | undefined
  group.each.setup(async () => {
    resetWebhookLimiter()
    previous = env.get('THEMEMBERS_WEBHOOK_SECRET')
    env.set('THEMEMBERS_WEBHOOK_SECRET', SECRET)
    return testUtils.db().withGlobalTransaction()
  })
  group.each.teardown(() => {
    env.set('THEMEMBERS_WEBHOOK_SECRET', previous ?? '')
  })

  const api = (client: any, user: any) => ({
    get: (path: string) => client.get(path).loginAs(user),
    post: (path: string, body?: object) =>
      body
        ? client.post(path).withCsrfToken().loginAs(user).json(body)
        : client.post(path).withCsrfToken().loginAs(user),
    put: (path: string, body: object) => client.put(path).withCsrfToken().loginAs(user).json(body),
  })
  const signed = (client: any, body: object) =>
    client
      .post('/webhooks/themembers')
      .header('x-signature', sign(JSON.stringify(body)))
      .json(body)

  async function courseWithProduct(a: ReturnType<typeof api>, productId: string) {
    const pro = await a.post('/admin/professionals', {
      slug: `pro-${productId}-${Date.now()}`,
      data: {
        name: 'Ana Souza',
        specialty: 'Hair',
        tagline: 'T.',
        experienceYears: 1,
        instagramHandle: '@a',
        instagramFollowers: '1',
        instagramUrl: 'https://instagram.com/a',
        portraitSrc: '/site/profissional/lukas_perfil.png',
        cardPhotoSrc: '/site/home/lukas-campos.png',
        bio: ['B.'],
        works: [],
      },
    })
    const course = await a.post('/admin/courses', {
      professionalId: pro.body().id,
      slug: `curso-${productId}-${Date.now()}`,
      data: {
        title: 'Curso',
        lead: 'L.',
        modality: 'online',
        level: 'profissional',
        workloadHours: 1,
        audience: 'A',
        coverSrc: '/site/curso/produto-morena-iluminada.svg',
        coverAlt: 'c',
        benefits: [{ title: 'b', text: 't' }],
        modules: [{ title: 'm', text: 't', bullets: [] }],
        deliverables: [{ title: 'd', text: 't' }],
        faq: [],
        testimonials: [],
        guaranteeDays: null,
      },
    })
    const id = course.body().id as number
    ;(
      await a.put(`/admin/courses/${id}/commercial`, {
        listCents: 25000,
        discountPct: 0,
        maxInstallments: 6,
        checkoutUrl: 'https://pay.example.com/c/x',
        environment: 'production',
        active: true,
        revision: 0,
        provider: 'themembers',
        externalCourseId: productId,
      })
    ).assertStatus(200)
    return id
  }

  test('o evento é ligado ao curso pelo ID do produto; o resumo usa o último evento de cada transação', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('admin'))
    const courseId = await courseWithProduct(a, '4321')
    // Transação A: iniciada, aprovada e depois reembolsada (vale o último). Transação B: aprovada. Transação C: recusada. D: pix gerado.
    const events = [
      sale({ txId: '1001', event: 'transaction.payment_cc_initiated' }),
      sale({ txId: '1001', event: 'transaction.approved' }),
      sale({ txId: '1001', event: 'transaction.refunded', status: 'refunded' }),
      sale({ txId: '1002' }),
      sale({ txId: '1003', event: 'transaction.failed', status: 'failed' }),
      sale({ txId: '1004', event: 'transaction.pix_generated', status: 'pending' }),
    ]
    // Datas crescentes para a ordem dos eventos da mesma transação ser inequívoca.
    events.forEach((e, i) => {
      e.payload.created_at = `2026-10-19 14:3${i}:00`
    })
    for (const e of events) (await signed(client, e)).assertStatus(200)
    ;(await signed(client, sale({ txId: '2001', productId: 999 }))).assertStatus(200) // outro produto, sem curso

    const res = await a.get(`/admin/courses/${courseId}/payments`)
    res.assertStatus(200)
    const body = res.body()
    assert.equal(body.webhookConfigured, true)
    assert.equal(body.webhookPath, '/webhooks/themembers')
    assert.equal(body.externalCourseId, '4321')
    assert.deepEqual(body.summary, {
      transactions: 4,
      approved: 1,
      approvedCents: 10260,
      refunded: 1,
      failed: 1,
      pending: 1,
    })
    assert.lengthOf(body.items, 6)
    assert.equal(body.items[0].event, 'transaction.pix_generated') // mais recente primeiro
    assert.equal(body.unmatchedTransactions, 1)
    assert.notInclude(JSON.stringify(body), 'maria.lima')
    assert.notInclude(JSON.stringify(body), '52998224725')
  })

  test('permissão: exige commerce.manage; curso inexistente é 404; sem sessão 401', async ({
    client,
  }) => {
    const admin = api(client, await makeUser('admin'))
    const courseId = await courseWithProduct(admin, '555')
    ;(await client.get(`/admin/courses/${courseId}/payments`)).assertStatus(401)
    ;(
      await api(client, await makeUser('viewer')).get(`/admin/courses/${courseId}/payments`)
    ).assertStatus(403)
    ;(
      await api(client, await makeUser('editor')).get(`/admin/courses/${courseId}/payments`)
    ).assertStatus(403)
    ;(await admin.get('/admin/courses/999999/payments')).assertStatus(404)
  })

  test('curso sem vínculo/sem eventos: resposta vazia e coerente', async ({ client, assert }) => {
    const a = api(client, await makeUser('admin'))
    const courseId = await courseWithProduct(a, '777')
    const res = await a.get(`/admin/courses/${courseId}/payments`)
    res.assertStatus(200)
    assert.deepEqual(res.body().summary, {
      transactions: 0,
      approved: 0,
      approvedCents: 0,
      refunded: 0,
      failed: 0,
      pending: 0,
    })
    assert.deepEqual(res.body().items, [])
  })
})

const REF = 'ab_k3j9x0q2m7v5n1c8w4zt'
const REF2 = 'ab_p0o9i8u7y6t5r4e3w2qa'

test.group('The Members · código da visita (ref) no webhook', () => {
  test('findRef acha o código em qualquer formato de utms e ignora o que não tem o formato exato', ({
    assert,
  }) => {
    assert.equal(findRef(JSON.stringify({ utms: [{ utm_content: REF }] })), REF)
    assert.equal(findRef(JSON.stringify({ utms: [{ key: 'utm_content', value: REF }] })), REF)
    assert.equal(findRef(JSON.stringify({ utms: `utm_source=academia&utm_content=${REF}` })), REF)
    assert.equal(
      findRef(JSON.stringify({ data: { order: { utms: { utm_term: REF.toUpperCase() } } } })),
      REF
    )
    assert.isNull(findRef(JSON.stringify({ utms: [] })))
    assert.isNull(findRef(JSON.stringify({ utms: [{ utm_content: 'ab_curto' }] })))
    assert.isNull(
      findRef(JSON.stringify({ utms: [{ utm_content: `${REF}extra` }] })),
      'mais longo que o formato não vale'
    )
    assert.isNull(findRef(JSON.stringify({ utms: [{ utm_content: 'cd_k3j9x0q2m7v5n1c8w4zt' }] })))
  })
})

test.group('The Members · confirmação para o comprador (/public/checkout-status)', (group) => {
  let previous: string | undefined
  group.each.setup(async () => {
    resetWebhookLimiter()
    resetCheckoutStatusLimiter()
    previous = env.get('THEMEMBERS_WEBHOOK_SECRET')
    env.set('THEMEMBERS_WEBHOOK_SECRET', SECRET)
    return testUtils.db().withGlobalTransaction()
  })
  group.each.teardown(() => {
    env.set('THEMEMBERS_WEBHOOK_SECRET', previous ?? '')
  })

  const hook = (client: any, body: object) =>
    client
      .post('/webhooks/themembers')
      .header('x-signature', sign(JSON.stringify(body)))
      .json(body)
  const withRef = (
    ref: string | null,
    over: Parameters<typeof sale>[0],
    when: string,
    method = 'credit_card'
  ) => {
    const body = sale(over) as any
    body.payload.created_at = when
    body.payload.data.payment_details.payment_method = method
    body.payload.data.order.utms = ref ? [{ utm_source: 'academia', utm_content: ref }] : []
    return body
  }
  const status = async (client: any, ref: string) =>
    (await client.get(`/public/checkout-status?ref=${ref}`)).body()

  test('sem pagamento a resposta é "none"; formato inválido é 400; nunca vem cache', async ({
    client,
    assert,
  }) => {
    assert.deepEqual(await status(client, REF), { status: 'none', method: null })
    ;(await client.get('/public/checkout-status')).assertStatus(400)
    ;(await client.get('/public/checkout-status?ref=abc')).assertStatus(400)
    ;(await client.get("/public/checkout-status?ref=ab_k3j9x0q2m7v5n1c8w4z'--")).assertStatus(400)
    const res = await client.get(`/public/checkout-status?ref=${REF}`)
    assert.equal(res.header('cache-control'), 'no-store')
  })

  test('pix gerado → aguardando; aprovado → aprovado; só a visita certa enxerga o próprio resultado', async ({
    client,
    assert,
  }) => {
    ;(
      await hook(
        client,
        withRef(
          REF,
          { txId: '11', event: 'transaction.pix_generated', status: 'pending' },
          '2026-10-19 10:00:00',
          'pix'
        )
      )
    ).assertStatus(200)
    assert.deepEqual(await status(client, REF), { status: 'waiting', method: 'pix' })
    ;(
      await hook(
        client,
        withRef(REF, { txId: '11', event: 'transaction.approved' }, '2026-10-19 10:05:00', 'pix')
      )
    ).assertStatus(200)
    assert.deepEqual(await status(client, REF), { status: 'approved', method: null })
    assert.deepEqual(await status(client, REF2), { status: 'none', method: null })
  })

  test('recusado e depois aprovado (nova tentativa) vale aprovado; aprovado e depois reembolsado vale reembolsado', async ({
    client,
    assert,
  }) => {
    ;(
      await hook(
        client,
        withRef(
          REF,
          { txId: '21', event: 'transaction.failed', status: 'failed' },
          '2026-10-19 10:00:00'
        )
      )
    ).assertStatus(200)
    assert.equal((await status(client, REF)).status, 'failed')
    ;(
      await hook(
        client,
        withRef(REF, { txId: '22', event: 'transaction.approved' }, '2026-10-19 10:10:00')
      )
    ).assertStatus(200)
    assert.equal((await status(client, REF)).status, 'approved')
    ;(
      await hook(
        client,
        withRef(
          REF,
          { txId: '22', event: 'transaction.refunded', status: 'refunded' },
          '2026-10-19 11:00:00'
        )
      )
    ).assertStatus(200)
    assert.equal((await status(client, REF)).status, 'refunded')
  })

  test('cartão iniciado → processando; evento sem código não aparece para ninguém', async ({
    client,
    assert,
  }) => {
    ;(
      await hook(
        client,
        withRef(
          REF,
          { txId: '31', event: 'transaction.payment_cc_initiated', status: 'processing' },
          '2026-10-19 10:00:00'
        )
      )
    ).assertStatus(200)
    assert.equal((await status(client, REF)).status, 'processing')
    ;(await hook(client, withRef(null, { txId: '32' }, '2026-10-19 10:01:00'))).assertStatus(200)
    assert.deepEqual(await status(client, REF2), { status: 'none', method: null })
  })

  test('a resposta pública traz só situação e forma de pagamento (sem valor, nome, e-mail ou documento)', async ({
    client,
    assert,
  }) => {
    ;(await hook(client, withRef(REF, { txId: '41' }, '2026-10-19 10:00:00'))).assertStatus(200)
    const body = await status(client, REF)
    assert.deepEqual(Object.keys(body).sort(), ['method', 'status'])
    const raw = JSON.stringify(body)
    for (const leak of ['Maria', '52998224725', 'maria.lima', '10260', 'visa'])
      assert.notInclude(raw, leak)
  })

  test('limita consultas por IP (429)', async ({ client, assert }) => {
    let last = 0
    for (let i = 0; i < 62; i++)
      last = (await client.get(`/public/checkout-status?ref=${REF}`)).status()
    assert.equal(last, 429)
  })
})

/** Exemplo real do webhook enviado pela The Members (IDs de 19 dígitos, `utms` vazio, `last_digit` numérico). */
const REAL_SAMPLE = `{
  "company": { "id": "7268299385367167832", "name": "company", "email": "company.test@email.com", "phone": "+55 11999999999", "document_type": "cnpj", "document_number": "00000000000000",
    "owner": { "id": "7268299385346197469", "name": "Lucas da Silva", "email": "lucas@company.com", "phone": "+5511999999999", "document_type": "cpf", "document_number": "00000000000" } },
  "payload": { "object": "transaction", "event": "transaction.approved", "created_at": "2026-01-02 16:48:57",
    "data": { "id": 7405530052968814123, "paid_at": "2026-01-02T19:48:57+00:00", "status": "approved",
      "transaction": { "currency": "brl", "amount": 10260, "buyer_fees": 0, "total_amount": 10260, "cupom": "" },
      "payment_details": { "payment_method": "credit_card", "credit_card": { "instalments": 1, "brand": "mastercard", "last_digit": 7600 } },
      "comissions": [],
      "order": { "id": 7405530048429536111,
        "customer": { "id": "7394310639977632991", "name": "João da Silva", "email": "joao@example.com", "phone_country": null, "phone": "+55 11999999999", "document_type": "cpf", "document_number": "00000000000" },
        "main_product": { "id": 7338938162967740123, "title": "Produto 1", "price": 10000 },
        "order_bump": [ { "product_id": 7338938162967740123, "title": "Produto 1", "price": 10000, "order_bump": true } ],
        "utms": [] },
      "subscription": null } } }`

test.group('The Members · exemplo real da documentação', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('o corpo do exemplo é tratado inteiro: IDs de 19 dígitos exatos, valores, pagamento e comprador mascarado', async ({
    assert,
  }) => {
    const result = await ThemembersWebhookService.receive(REAL_SAMPLE, sign(REAL_SAMPLE), SECRET)
    assert.deepInclude(result, { ok: true, duplicate: false })
    const row = await db.from('payment_events').first()
    assert.equal(row.event, 'transaction.approved')
    assert.equal(row.status, 'approved')
    assert.equal(row.external_product_id, '7338938162967740123', 'ID do produto sem perder dígitos')
    assert.equal(row.external_transaction_id, '7405530052968814123')
    assert.equal(row.amount_cents, 10260)
    assert.equal(row.currency, 'BRL')
    assert.equal(row.payment_method, 'credit_card')
    assert.equal(row.instalments, 1)
    assert.equal(row.card_brand, 'mastercard')
    assert.equal(row.buyer_name, 'João S.')
    assert.equal(row.buyer_email, 'j***@e***.com')
    assert.isNull(row.ref, 'utms vazio: sem código da visita')
    assert.equal(row.signature_scheme, 'raw+hex')
    const stored = JSON.stringify(row)
    for (const leak of [
      'joao@example.com',
      'João da Silva',
      '+55 11999999999',
      'lucas@company.com',
      'company.test@email.com',
    ]) {
      assert.notInclude(stored, leak)
    }
  })

  test('o produto da The Members liga ao curso quando o ID de 19 dígitos está na oferta', async ({
    assert,
  }) => {
    const { default: CommercialConfig } = await import('#models/commercial_config')
    await db.table('professionals').insert({
      slug: 'p-real',
      status: 'draft',
      revision: 1,
      data: JSON.stringify({ name: 'P' }),
      name: 'P',
      template_key: 'professional-original',
      created_at: new Date(),
    })
    const pro = await db.from('professionals').where('slug', 'p-real').first()
    await db.table('courses').insert({
      professional_id: pro.id,
      slug: 'c-real',
      status: 'draft',
      revision: 1,
      data: JSON.stringify({ title: 'C' }),
      title: 'C',
      created_at: new Date(),
    })
    const course = await db.from('courses').where('slug', 'c-real').first()
    await CommercialConfig.create({
      courseId: course.id,
      revision: 1,
      currency: 'BRL',
      listCents: 10000,
      discountPct: 0,
      maxInstallments: 1,
      provider: 'themembers',
      externalCourseId: '7338938162967740123',
      checkoutUrl: '',
      environment: 'production',
      active: false,
    })
    const result = await ThemembersWebhookService.receive(REAL_SAMPLE, sign(REAL_SAMPLE), SECRET)
    assert.deepInclude(result, { ok: true, courseId: course.id })
  })

  test('variante com ref no utms (o que esperamos se a The Members devolver as UTMs) é reconhecida', async ({
    assert,
  }) => {
    const withUtm = REAL_SAMPLE.replace(
      '"utms": []',
      `"utms": [ { "utm_source": "academia", "utm_content": "ab_k3j9x0q2m7v5n1c8w4zt" } ]`
    )
    await ThemembersWebhookService.receive(withUtm, sign(withUtm), SECRET)
    assert.equal((await db.from('payment_events').first()).ref, 'ab_k3j9x0q2m7v5n1c8w4zt')
  })
})
