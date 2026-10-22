import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTelemetry, formatDuration, parseConnectionString, sanitizeProps, scrubText, scrubUrl } from './index.js'

const KEY = '11111111-2222-3333-4444-555555555555'
const CS = `InstrumentationKey=${KEY};IngestionEndpoint=https://brazilsouth-1.in.applicationinsights.azure.com/;LiveEndpoint=https://brazilsouth.livediagnostics.monitor.azure.com/`

afterEach(() => vi.useRealTimers())

describe('parseConnectionString', () => {
  it('lê chave e endpoint oficial', () => {
    expect(parseConnectionString(CS)).toEqual({ instrumentationKey: KEY, trackUrl: 'https://brazilsouth-1.in.applicationinsights.azure.com/v2/track' })
  })
  it('sem endpoint usa o padrão global', () => {
    expect(parseConnectionString(`InstrumentationKey=${KEY}`)?.trackUrl).toBe('https://dc.services.visualstudio.com/v2/track')
  })
  it('recusa vazio, chave inválida, http, host fora da lista e credenciais', () => {
    for (const bad of [undefined, '', 'x', 'InstrumentationKey=abc', `InstrumentationKey=${KEY};IngestionEndpoint=http://x.in.applicationinsights.azure.com`, `InstrumentationKey=${KEY};IngestionEndpoint=https://evil.example.com`, `InstrumentationKey=${KEY};IngestionEndpoint=https://a:b@x.in.applicationinsights.azure.com`, `InstrumentationKey=${KEY};IngestionEndpoint=https://applicationinsights.azure.com.evil.com`]) {
      expect(parseConnectionString(bad)).toBeNull()
    }
  })
})

describe('scrubText', () => {
  it.each([
    ['falha para ana@exemplo.com.br', 'falha para [email]'],
    ['cpf 123.456.789-09 inválido', 'cpf [cpf] inválido'],
    ['cnpj 12.345.678/0001-95', 'cnpj [cnpj]'],
    ['cartão 4111 1111 1111 1111', 'cartão [num]'],
    ['ligar (11) 98765-4321', 'ligar [tel]'],
    ['ip 189.12.34.56 bloqueado', 'ip [ip] bloqueado'],
    ['Authorization: Bearer abc.def-ghi_123', 'Authorization: [redigido]'],
    ['enviado com Bearer abc.def-ghi_123', 'enviado com Bearer [token]'],
    ['password=Segredo123 ok', 'password=[redigido] ok'],
    ['jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123 fim', 'jwt [token] fim'],
    ['id 0123456789abcdef0123456789abcdef', 'id [token]'],
  ])('%s', (input, expected) => {
    expect(scrubText(input)).toBe(expected)
  })
  it('mantém texto técnico comum e trunca', () => {
    expect(scrubText('connect ECONNREFUSED at db.query (/app/build/x.js:10:5)')).toContain('ECONNREFUSED')
    expect(scrubText('ab '.repeat(30), 9)).toBe('ab ab ab …')
  })
})

describe('scrubUrl e sanitizeProps', () => {
  it('remove consulta e fragmento', () => {
    expect(scrubUrl('/cursos/x?token=abc&email=a@b.com#topo')).toBe('/cursos/x')
  })
  it('chaves sensíveis nunca levam valor; limita 20 propriedades', () => {
    const out = sanitizeProps({ route: '/x', email: 'a@b.com', cpf: '1', userToken: 'z', status: 500, ok: false, nada: undefined })
    expect(out).toEqual({ route: '/x', email: '[redigido]', cpf: '[redigido]', userToken: '[redigido]', status: '500', ok: 'false' })
    const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, i]))
    expect(Object.keys(sanitizeProps(many))).toHaveLength(20)
  })
})

describe('formatDuration', () => {
  it('usa o formato do serviço', () => {
    expect(formatDuration(0)).toBe('00:00:00.0000000')
    expect(formatDuration(1234)).toBe('00:00:01.2340000')
    expect(formatDuration(3_723_005)).toBe('01:02:03.0050000')
    expect(formatDuration(90_000_000)).toBe('1.01:00:00.0000000')
    expect(formatDuration(-5)).toBe('00:00:00.0000000')
  })
})

type Mock = ReturnType<typeof vi.fn>
type Item = { name: string; tags: Record<string, string>; iKey: string; data: { baseType: string; baseData: Record<string, any> } } // eslint-disable-line @typescript-eslint/no-explicit-any
/** Itens enviados na chamada `n` do fetch simulado. */
const sent = (fetch: Mock, n = 0): Item[] => JSON.parse((fetch.mock.calls[n] as [string, { body: string }])[1].body)

const ok = () => new Response(JSON.stringify({ itemsReceived: 1, itemsAccepted: 1, errors: [] }), { status: 200 })

describe('createTelemetry', () => {
  it('sem connection string fica desligada e não faz chamadas', async () => {
    const fetch = vi.fn()
    const t = createTelemetry({ role: 'api', fetch })
    t.trackEvent('x')
    t.trackException({ error: new Error('x') })
    await t.flush()
    expect(t.enabled).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    expect((await t.check()).ok).toBe(false)
  })

  it('connection string inválida avisa e desliga', () => {
    const onError = vi.fn()
    expect(createTelemetry({ role: 'api', connectionString: 'lixo', onError }).enabled).toBe(false)
    expect(onError).toHaveBeenCalled()
  })

  it('onError que lança não derruba nada (nem na subida, nem no envio)', async () => {
    const boom = () => {
      throw new Error('logger indisponível')
    }
    expect(() => createTelemetry({ role: 'api', connectionString: 'lixo', onError: boom })).not.toThrow()
    const t = createTelemetry({ role: 'api', connectionString: CS, fetch: vi.fn().mockRejectedValue(new Error('rede')), onError: boom, flushIntervalMs: 3_600_000 })
    t.trackEvent('a')
    await expect(t.flush()).resolves.toBeUndefined()
  })

  it('envia em lote os envelopes corretos, com função, instância e dados limpos', async () => {
    const fetch = vi.fn().mockResolvedValue(ok())
    const t = createTelemetry({ role: 'academia-api', version: '1.2.3', instance: 'i-1', connectionString: CS, fetch, flushIntervalMs: 3_600_000 })
    t.trackRequest({ id: 'req-1', name: 'GET /courses/:slug', url: '/public/courses/x?email=a@b.com', durationMs: 42, resultCode: 200, success: true })
    t.trackException({ error: new Error('falha com ana@exemplo.com'), operationId: 'req-1', properties: { route: '/x' } })
    t.trackEvent('webhook.received', { outcome: 'accepted' }, { items: 1 })
    t.trackMetric('queue.size', 3)
    t.trackTrace('subiu', 'information')
    await t.flush()
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toBe('https://brazilsouth-1.in.applicationinsights.azure.com/v2/track')
    expect(init.method).toBe('POST')
    const items = sent(fetch)
    expect(items.map((i) => i.data.baseType)).toEqual(['RequestData', 'ExceptionData', 'EventData', 'MetricData', 'MessageData'])
    expect(items[0]!.name).toBe(`Microsoft.ApplicationInsights.${KEY.replace(/-/g, '')}.Request`)
    expect(items[0]!.iKey).toBe(KEY)
    expect(items[0]!.tags).toMatchObject({ 'ai.cloud.role': 'academia-api', 'ai.cloud.roleInstance': 'i-1', 'ai.application.ver': '1.2.3', 'ai.operation.id': 'req-1' })
    expect(items[0]!.data.baseData).toMatchObject({ ver: 2, responseCode: '200', success: true, url: '/public/courses/x', duration: '00:00:00.0420000' })
    expect(items[1]!.data.baseData.exceptions[0].message).toBe('falha com [email]')
    expect(items[1]!.data.baseData.severityLevel).toBe(3)
    expect(items[2]!.data.baseData).toMatchObject({ name: 'webhook.received', properties: { outcome: 'accepted' }, measurements: { items: 1 } })
    expect(JSON.stringify(items)).not.toContain('a@b.com')
    expect(JSON.stringify(items)).not.toContain('ana@exemplo.com')
  })

  it('amostragem vale só para requisições', async () => {
    const fetch = vi.fn().mockResolvedValue(ok())
    const t = createTelemetry({ role: 'api', connectionString: CS, fetch, requestSampling: 0.5, random: () => 0.9, flushIntervalMs: 3_600_000 })
    t.trackRequest({ name: 'GET /x', url: '/x', durationMs: 1, resultCode: 200, success: true })
    t.trackException({ error: new Error('boom') })
    await t.flush()
    expect(sent(fetch).map((i) => i.data.baseType)).toEqual(['ExceptionData'])
  })

  it('falha transitória: mantém a fila e reenvia depois da espera', async () => {
    let t0 = 1_000_000
    const fetch = vi.fn().mockResolvedValueOnce(new Response('x', { status: 503 })).mockResolvedValue(ok())
    const onError = vi.fn()
    const t = createTelemetry({ role: 'api', connectionString: CS, fetch, onError, now: () => t0, flushIntervalMs: 3_600_000 })
    t.trackEvent('a')
    await t.flush()
    expect(fetch).toHaveBeenCalledTimes(1)
    await t.flush() // ainda dentro da espera: não envia
    expect(fetch).toHaveBeenCalledTimes(1)
    t0 += 120_000
    await t.flush()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(sent(fetch, 1)).toHaveLength(1)
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('erro de rede não lança e erro 400 descarta o lote', async () => {
    const onError = vi.fn()
    const net = createTelemetry({ role: 'api', connectionString: CS, fetch: vi.fn().mockRejectedValue(new Error('rede')), onError, flushIntervalMs: 3_600_000 })
    net.trackEvent('a')
    await expect(net.flush()).resolves.toBeUndefined()
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 400 }))
    const bad = createTelemetry({ role: 'api', connectionString: CS, fetch, onError, flushIntervalMs: 3_600_000 })
    bad.trackEvent('a')
    await bad.flush()
    await bad.flush()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('206: reenvia só os itens com erro transitório', async () => {
    let t0 = 5_000_000
    const partial = new Response(JSON.stringify({ itemsReceived: 2, itemsAccepted: 1, errors: [{ index: 1, statusCode: 500, message: 'x' }] }), { status: 206 })
    const fetch = vi.fn().mockResolvedValueOnce(partial).mockResolvedValue(ok())
    const t = createTelemetry({ role: 'api', connectionString: CS, fetch, now: () => t0, flushIntervalMs: 3_600_000 })
    t.trackEvent('um')
    t.trackEvent('dois')
    await t.flush()
    await t.flush()
    const second = sent(fetch, 1)
    expect(second).toHaveLength(1)
    expect(second[0]!.data.baseData.name).toBe('dois')
  })

  it('fila com limite descarta os mais antigos', async () => {
    const fetch = vi.fn().mockResolvedValue(ok())
    const t = createTelemetry({ role: 'api', connectionString: CS, fetch, maxQueue: 3, maxBatch: 100, flushIntervalMs: 3_600_000 })
    for (let i = 0; i < 6; i++) t.trackEvent(`e${i}`)
    await t.flush()
    expect(sent(fetch).map((i) => i.data.baseData.name)).toEqual(['e3', 'e4', 'e5'])
  })

  it('envia sozinho ao atingir o tamanho do lote e shutdown descarrega o resto', async () => {
    const fetch = vi.fn().mockResolvedValue(ok())
    const t = createTelemetry({ role: 'api', connectionString: CS, fetch, maxBatch: 2, flushIntervalMs: 3_600_000 })
    t.trackEvent('a')
    t.trackEvent('b')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    t.trackEvent('c')
    await t.shutdown()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('check devolve a resposta do serviço', async () => {
    const fetch = vi.fn().mockResolvedValue(ok())
    const t = createTelemetry({ role: 'api', connectionString: CS, fetch, flushIntervalMs: 3_600_000 })
    expect(await t.check()).toMatchObject({ ok: true, status: 200, itemsAccepted: 1 })
    const rejected = createTelemetry({ role: 'api', connectionString: CS, fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ itemsReceived: 1, itemsAccepted: 0, errors: [{ index: 0, statusCode: 400, message: 'Invalid instrumentation key' }] }), { status: 400 })), flushIntervalMs: 3_600_000 })
    expect(await rejected.check()).toMatchObject({ ok: false, status: 400, errors: ['Invalid instrumentation key'] })
  })
})
