/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).assertStatus()` mantém os testes legíveis */
import { createHmac } from 'node:crypto'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { makeUser } from '#tests/helpers'
import { resetWebhookLimiter } from '#controllers/themembers_webhook_controller'
import { prettyJson } from '#services/pretty_json'
import WebhookLogService, { MAX_LOGGED_BODY, pickHeaders } from '#services/webhook_log_service'

const SECRET = 'segredo-de-teste-do-webhook-1234567890'
const sign = (body: string, secret = SECRET) =>
  createHmac('sha256', secret).update(body).digest('hex')

/** Corpo bruto com IDs de 19 dígitos (o JSON.parse os arredondaria): o registro precisa guardar exatamente isto. */
const RAW = `{"company":{"id":"7268299385367167832","name":"company","owner":{"id":"7268299385346197469","name":"Lucas da Silva","email":"lucas@company.com","document_number":"00000000000"}},"payload":{"object":"transaction","event":"transaction.approved","created_at":"2026-01-02 16:48:57","data":{"id":7405530052968814123,"status":"approved","transaction":{"currency":"brl","amount":10260,"buyer_fees":0,"total_amount":10260,"cupom":""},"payment_details":{"payment_method":"credit_card","credit_card":{"instalments":1,"brand":"mastercard","last_digit":7600}},"comissions":[],"order":{"id":7405530048429536111,"customer":{"id":"1","name":"João da Silva","email":"joao@example.com","document_number":"00000000000"},"main_product":{"id":7338938162967740123,"title":"Produto 1","price":10000},"order_bump":[],"utms":[]},"subscription":null}}}`

const json = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value)

const post = (
  client: any,
  raw: string,
  signature: string | null,
  extra: Record<string, string> = {}
) => {
  let req = client.post('/webhooks/themembers')
  if (signature) req = req.header('x-signature', signature)
  for (const [k, v] of Object.entries(extra)) req = req.header(k, v)
  // `.json(string)` envia o texto como está (superagent só serializa objetos): preserva o corpo bruto byte a byte.
  return req.json(raw as never)
}

test.group('Webhook · registro técnico das chamadas', (group) => {
  let previous: string | undefined
  group.each.setup(async () => {
    resetWebhookLimiter()
    previous = env.get('THEMEMBERS_WEBHOOK_SECRET')
    env.set('THEMEMBERS_WEBHOOK_SECRET', SECRET)
    return testUtils.db().withGlobalTransaction()
  })
  group.each.teardown(() => {
    env.set('THEMEMBERS_WEBHOOK_SECRET', previous ?? '')
    env.set('THEMEMBERS_LOG_RAW', true)
  })

  test('chamada aceita guarda o corpo bruto exato (IDs de 19 dígitos), a variante da assinatura e o evento gravado', async ({
    client,
    assert,
  }) => {
    ;(
      await post(client, RAW, sign(RAW), { cookie: 'sessao=segredo', authorization: 'Bearer x' })
    ).assertStatus(200)
    const log = await db.from('webhook_deliveries').first()
    assert.equal(log.result, 'accepted')
    assert.equal(log.http_status, 200)
    assert.equal(log.event, 'transaction.approved')
    assert.equal(log.signature_scheme, 'raw+hex')
    assert.equal(log.raw_body, RAW, 'o corpo é guardado byte a byte')
    assert.include(log.raw_body, '7405530052968814123')
    assert.equal(log.body_bytes, Buffer.byteLength(RAW))
    assert.isFalse(Boolean(log.body_truncated))
    const event = await db.from('payment_events').first()
    assert.equal(Number(log.payment_event_id), Number(event.id))
    const headers = json(log.headers)
    assert.equal(headers['x-signature'], sign(RAW))
    assert.equal(headers['content-type'], 'application/json')
    assert.notProperty(headers, 'cookie')
    assert.notProperty(headers, 'authorization')
  })

  test('assinatura inválida também é registrada (corpo e cabeçalho X-Signature) para depurar o formato em produção', async ({
    client,
    assert,
  }) => {
    ;(await post(client, RAW, 'assinatura-errada')).assertStatus(403)
    ;(await post(client, RAW, null)).assertStatus(403)
    const rows = await db.from('webhook_deliveries').orderBy('id')
    assert.deepEqual(
      rows.map((r) => [r.result, r.http_status]),
      [
        ['invalid_signature', 403],
        ['invalid_signature', 403],
      ]
    )
    assert.equal(rows[0].raw_body, RAW)
    assert.equal(json(rows[0].headers)['x-signature'], 'assinatura-errada')
    assert.notProperty(json(rows[1].headers), 'x-signature')
    assert.isNull(rows[0].event)
    assert.lengthOf(await db.from('payment_events'), 0, 'recusada não vira pagamento')
  })

  test('reenvio vira "duplicate"; sem segredo configurado vira "not_configured"; evento desconhecido vira "invalid_payload"', async ({
    client,
    assert,
  }) => {
    ;(await post(client, RAW, sign(RAW))).assertStatus(200)
    ;(await post(client, RAW, sign(RAW))).assertStatus(200)
    const unknown = RAW.replace('transaction.approved', 'COISA ESTRANHA!')
    ;(await post(client, unknown, sign(unknown))).assertStatus(400)
    env.set('THEMEMBERS_WEBHOOK_SECRET', '')
    ;(await post(client, RAW, sign(RAW))).assertStatus(503)
    const results = (await db.from('webhook_deliveries').orderBy('id')).map((r) => r.result)
    assert.deepEqual(results, ['accepted', 'duplicate', 'invalid_payload', 'not_configured'])
  })

  test('THEMEMBERS_LOG_RAW=false desliga o registro sem afetar o recebimento', async ({
    client,
    assert,
  }) => {
    env.set('THEMEMBERS_LOG_RAW', false)
    ;(await post(client, RAW, sign(RAW))).assertStatus(200)
    assert.lengthOf(await db.from('webhook_deliveries'), 0)
    assert.lengthOf(await db.from('payment_events'), 1)
  })

  test('corpo gigante é cortado no limite e marcado; o que passou da retenção é apagado', async ({
    assert,
  }) => {
    const huge = 'x'.repeat(MAX_LOGGED_BODY + 500)
    await db.table('webhook_deliveries').insert({
      provider: 'themembers',
      result: 'accepted',
      http_status: 200,
      headers: '{}',
      body_bytes: 1,
      body_truncated: false,
      raw_body: 'velho',
      received_at: DateTime.utc().minus({ days: 45 }).toSQL({ includeOffset: false }),
    })
    await WebhookLogService.record({
      result: 'invalid_signature',
      httpStatus: 403,
      raw: huge,
      headers: {},
      ip: '1.2.3.4',
    })
    const rows = await db.from('webhook_deliveries')
    assert.lengthOf(rows, 1, 'a linha de 45 dias saiu (retenção padrão de 30)')
    assert.isTrue(Boolean(rows[0].body_truncated))
    assert.equal(rows[0].raw_body.length, MAX_LOGGED_BODY)
    assert.equal(rows[0].body_bytes, huge.length)
  })

  test('pickHeaders guarda só a lista segura e limita o tamanho', ({ assert }) => {
    const out = pickHeaders({
      'cookie': 'a=b',
      'authorization': 'x',
      'x-signature': 'z'.repeat(1000),
      'user-agent': 'TheMembers/1',
      'x-forwarded-for': ['1.1.1.1', '2.2.2.2'],
    })
    assert.deepEqual(Object.keys(out).sort(), ['user-agent', 'x-forwarded-for', 'x-signature'])
    assert.equal(out['x-signature']!.length, 300)
    assert.equal(out['x-forwarded-for'], '1.1.1.1, 2.2.2.2')
  })

  test('prettyJson indenta sem tocar nos números (19 dígitos exatos) nem nas strings', ({
    assert,
  }) => {
    const out = prettyJson(
      '{"id":7405530052968814123,"s":"a,b:{c}\\"d","l":[1,2],"o":{},"e":[],"n":null}'
    )
    assert.include(out, '"id": 7405530052968814123')
    assert.include(out, '"s": "a,b:{c}\\"d"')
    assert.include(out, '"o": {}')
    assert.include(out, '"e": []')
    assert.deepEqual(
      JSON.parse(out),
      JSON.parse('{"id":7405530052968815000,"s":"a,b:{c}\\"d","l":[1,2],"o":{},"e":[],"n":null}')
    )
    // Fora de strings só os espaços são descartados.
    assert.equal(prettyJson('não é json'), 'nãoéjson')
  })
})

test.group('Webhook · consulta do registro (admin)', (group) => {
  let previous: string | undefined
  group.each.setup(async () => {
    resetWebhookLimiter()
    previous = env.get('THEMEMBERS_WEBHOOK_SECRET')
    env.set('THEMEMBERS_WEBHOOK_SECRET', SECRET)
    return testUtils.db().withGlobalTransaction()
  })
  group.each.teardown(() => env.set('THEMEMBERS_WEBHOOK_SECRET', previous ?? ''))

  test('só administrador lê: editor e viewer 403, sem sessão 401', async ({ client }) => {
    ;(await client.get('/admin/webhook-deliveries')).assertStatus(401)
    ;(await client.get('/admin/webhook-deliveries').loginAs(await makeUser('editor'))).assertStatus(
      403
    )
    ;(await client.get('/admin/webhook-deliveries').loginAs(await makeUser('viewer'))).assertStatus(
      403
    )
    ;(
      await client.get('/admin/webhook-deliveries/1').loginAs(await makeUser('editor'))
    ).assertStatus(403)
  })

  test('lista com contagem por resultado e filtro; detalhe traz o corpo bruto, o formatado e os cabeçalhos', async ({
    client,
    assert,
  }) => {
    ;(await post(client, RAW, sign(RAW))).assertStatus(200)
    ;(await post(client, RAW, 'errada')).assertStatus(403)
    const admin = await makeUser('admin')
    const list = await client.get('/admin/webhook-deliveries').loginAs(admin)
    list.assertStatus(200)
    assert.equal(list.body().total, 2)
    assert.deepEqual(list.body().counts, { accepted: 1, invalid_signature: 1 })
    assert.equal(list.body().loggingEnabled, true)
    assert.equal(list.body().retentionDays, 30)
    assert.notProperty(list.body().items[0], 'rawBody')

    const onlyBad = await client
      .get('/admin/webhook-deliveries?result=invalid_signature')
      .loginAs(admin)
    assert.equal(onlyBad.body().total, 1)
    assert.equal(onlyBad.body().items[0].result, 'invalid_signature')

    const accepted = list.body().items.find((i: any) => i.result === 'accepted')
    const detail = await client.get(`/admin/webhook-deliveries/${accepted.id}`).loginAs(admin)
    detail.assertStatus(200)
    assert.equal(detail.body().rawBody, RAW)
    assert.include(detail.body().prettyBody, '"id": 7405530052968814123')
    assert.include(detail.body().prettyBody, '\n')
    assert.equal(detail.body().headers['x-signature'], sign(RAW))
    ;(await client.get('/admin/webhook-deliveries/999999').loginAs(admin)).assertStatus(404)
  })
})
