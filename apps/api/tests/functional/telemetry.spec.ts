import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { HttpContext } from '@adonisjs/core/http'
import { createTelemetry, type Telemetry } from '@academia/telemetry'
import telemetry from '#services/telemetry_service'
import AuditService from '#services/audit_service'
import HttpExceptionHandler from '#exceptions/handler'
import { trackCompletedRequest } from '#services/request_telemetry'

type Call = { method: string; args: unknown[] }

/** Troca os métodos de envio do singleton por gravadores durante o teste e restaura ao final. */
function spy() {
  const calls: Call[] = []
  const original = { ...telemetry }
  for (const method of [
    'trackEvent',
    'trackException',
    'trackRequest',
    'trackMetric',
    'trackTrace',
  ] as const) {
    ;(telemetry as Record<string, unknown>)[method] = (...args: unknown[]) =>
      calls.push({ method, args })
  }
  return { calls, restore: () => Object.assign(telemetry, original) }
}

const ctxOf = (over: { url?: string; status?: number; pattern?: string | null } = {}) =>
  ({
    request: {
      url: () => over.url ?? '/public/courses/x?email=a@b.com',
      id: () => 'req-1',
      method: () => 'GET',
    },
    response: { getStatus: () => over.status ?? 200 },
    route: over.pattern === null ? undefined : { pattern: over.pattern ?? '/public/courses/:slug' },
  }) as unknown as Pick<HttpContext, 'request' | 'response' | 'route'>

test.group('Telemetria · sem configuração', () => {
  test('fica desligada nos testes e não lança', async ({ assert }) => {
    assert.isFalse(telemetry.enabled)
    assert.doesNotThrow(() => telemetry.trackEvent('x'))
    const result = await telemetry.check()
    assert.isFalse(result.ok)
  })
})

test.group('Telemetria · requisições', () => {
  test('usa o padrão da rota (nunca a URL real) e mede status e duração', ({ assert }) => {
    const sent: unknown[] = []
    const fake = { trackRequest: (r: unknown) => sent.push(r) } as unknown as Telemetry
    trackCompletedRequest(fake, { ctx: ctxOf({ status: 200 }), duration: [0, 42_000_000] })
    assert.deepEqual(sent[0], {
      id: 'req-1',
      name: 'GET /public/courses/:slug',
      url: '/public/courses/:slug',
      durationMs: 42,
      resultCode: 200,
      success: true,
    })
  })

  test('5xx é falha do serviço; 4xx não; rota inexistente e /health', ({ assert }) => {
    const sent: { success: boolean; name: string }[] = []
    const fake = {
      trackRequest: (r: { success: boolean; name: string }) => sent.push(r),
    } as unknown as Telemetry
    trackCompletedRequest(fake, { ctx: ctxOf({ status: 500 }), duration: [0, 1] })
    trackCompletedRequest(fake, { ctx: ctxOf({ status: 404 }), duration: [0, 1] })
    trackCompletedRequest(fake, {
      ctx: ctxOf({ status: 404, pattern: null, url: '/lixo' }),
      duration: [0, 1],
    })
    trackCompletedRequest(fake, { ctx: ctxOf({ url: '/health' }), duration: [0, 1] })
    assert.deepEqual(
      sent.map((s) => s.success),
      [false, true, true]
    )
    assert.equal(sent[2]?.name, 'GET sem rota')
  })
})

test.group('Telemetria · erros, auditoria e webhook', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('só falha do servidor vira exceção (com a rota); 403, 404 e validação não', async ({
    assert,
  }) => {
    const s = spy()
    try {
      const handler = new HttpExceptionHandler()
      const ctx = {
        request: { id: () => 'req-9', method: () => 'POST' },
        route: { pattern: '/admin/courses/:id' },
        logger: { log() {}, error() {}, warn() {}, info() {} },
      } as unknown as HttpContext
      await handler.report(
        Object.assign(new Error('banco caiu'), { status: 500, code: 'E_DB' }),
        ctx
      )
      await handler.report(Object.assign(new Error('não achei'), { status: 404 }), ctx)
      await handler.report(Object.assign(new Error('inválido'), { status: 422 }), ctx)
      await handler.report(Object.assign(new Error('sem permissão'), { status: 403 }), ctx)
      const exceptions = s.calls.filter((c) => c.method === 'trackException')
      assert.lengthOf(exceptions, 1)
      const input = exceptions[0]?.args[0] as {
        operationId: string
        properties: Record<string, unknown>
      }
      assert.equal(input.operationId, 'req-9')
      assert.deepEqual(input.properties, {
        route: 'POST /admin/courses/:id',
        status: 500,
        code: 'E_DB',
      })
    } finally {
      s.restore()
    }
  })

  test('auditoria vira evento só com ação e tipo de recurso (sem ator, ids, IP nem metadados)', async ({
    assert,
  }) => {
    const s = spy()
    try {
      await AuditService.record(null, {
        action: 'auth.login_failed',
        actorId: 7,
        resourceType: 'user',
        resourceId: 7,
        metadata: { email: 'ana@exemplo.com' },
      })
      const events = s.calls.filter((c) => c.method === 'trackEvent')
      assert.lengthOf(events, 1)
      assert.deepEqual(events[0]?.args, ['audit.auth.login_failed', { resource: 'user' }])
    } finally {
      s.restore()
    }
  })

  test('webhook da The Members registra o desfecho de cada chamada', async ({ client, assert }) => {
    const s = spy()
    try {
      const res = await client
        .post('/webhooks/themembers')
        .header('content-type', 'application/json')
      res.assertStatus(400)
      const events = s.calls.filter((c) => c.method === 'trackEvent')
      assert.lengthOf(events, 1)
      assert.deepEqual(events[0]?.args, [
        'webhook.themembers',
        { result: 'empty_body', status: 400, event: undefined },
      ])
    } finally {
      s.restore()
    }
  })
})

test.group('Telemetria · cliente real contra um serviço de mentira', () => {
  test('envia a requisição já limpa ao endpoint de ingestão', async ({ assert }) => {
    const bodies: string[] = []
    const t = createTelemetry({
      role: 'academia-api',
      connectionString:
        'InstrumentationKey=11111111-2222-3333-4444-555555555555;IngestionEndpoint=https://x.in.applicationinsights.azure.com/',
      fetch: (async (_url: unknown, init: { body: string }) => {
        bodies.push(init.body)
        return new Response(JSON.stringify({ itemsReceived: 1, itemsAccepted: 1, errors: [] }), {
          status: 200,
        })
      }) as unknown as typeof fetch,
      flushIntervalMs: 3_600_000,
    })
    trackCompletedRequest(t, { ctx: ctxOf({ status: 500 }), duration: [0, 5_000_000] })
    await t.flush()
    assert.lengthOf(bodies, 1)
    assert.notInclude(bodies[0]!, 'a@b.com')
    assert.include(bodies[0]!, '"responseCode":"500"')
    assert.include(bodies[0]!, '"success":false')
  })
})
