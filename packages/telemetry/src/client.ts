import { parseConnectionString } from './connection.js'
import { eventEnvelope, exceptionEnvelope, metricEnvelope, requestEnvelope, traceEnvelope, type Context, type Envelope, type ExceptionInput, type RequestInput, SEVERITY } from './envelope.js'
import type { Props } from './scrub.js'

export type TelemetryOptions = {
  /** `InstrumentationKey=...;IngestionEndpoint=https://...` (variável `APPLICATIONINSIGHTS_CONNECTION_STRING`). Vazio/inválido = desligada. */
  connectionString?: string
  /** Nome lógico do serviço (ex.: `academia-api`, `academia-web`). */
  role: string
  version?: string
  /** Identificador desta instância (padrão: `WEBSITE_INSTANCE_ID` ou o PID). */
  instance?: string
  /** Fração das requisições enviadas (0–1). Erros e eventos nunca são amostrados. */
  requestSampling?: number
  flushIntervalMs?: number
  maxBatch?: number
  maxQueue?: number
  timeoutMs?: number
  /** Chamado com falhas de envio (nunca lança). */
  onError?: (message: string) => void
  /** Injetável nos testes. */
  fetch?: typeof fetch
  now?: () => number
  random?: () => number
}

export type CheckResult = { ok: boolean; status: number; itemsReceived?: number; itemsAccepted?: number; errors?: string[]; message?: string }

export type Telemetry = {
  readonly enabled: boolean
  trackRequest(input: RequestInput): void
  trackException(input: ExceptionInput): void
  trackEvent(name: string, properties?: Props, measurements?: Record<string, number>): void
  trackMetric(name: string, value: number, properties?: Props): void
  trackTrace(message: string, severity?: keyof typeof SEVERITY, properties?: Props): void
  /** Envia o que está na fila (usado ao encerrar o processo). */
  flush(): Promise<void>
  /** Para o temporizador e envia o restante. */
  shutdown(): Promise<void>
  /** Envia um evento de teste direto e devolve a resposta do serviço (comando `telemetry:check`). */
  check(): Promise<CheckResult>
}

const RETRYABLE = new Set([408, 429, 439, 500, 502, 503, 504])

const DISABLED: Telemetry = {
  enabled: false,
  trackRequest() {},
  trackException() {},
  trackEvent() {},
  trackMetric() {},
  trackTrace() {},
  async flush() {},
  async shutdown() {},
  async check() {
    return { ok: false, status: 0, message: 'Telemetria desligada: defina APPLICATIONINSIGHTS_CONNECTION_STRING com um valor válido.' }
  },
}

/**
 * Cliente mínimo do Application Insights (API `/v2/track`), sem dependências e sem instrumentação automática.
 * Fila em memória com limite, envio em lote, nova tentativa com espera crescente e nenhuma exceção para quem chama:
 * um problema na telemetria jamais pode derrubar ou atrasar uma requisição.
 */
export function createTelemetry(options: TelemetryOptions): Telemetry {
  // Quem recebe o aviso pode falhar (ex.: logger ainda não iniciado na subida): isso nunca pode derrubar o processo.
  const report = (message: string) => {
    try {
      options.onError?.(message)
    } catch {
      // sem destino para o aviso; segue
    }
  }
  const connection = parseConnectionString(options.connectionString)
  if (!connection) {
    if (options.connectionString?.trim()) report('APPLICATIONINSIGHTS_CONNECTION_STRING inválida: telemetria desligada')
    return DISABLED
  }
  const doFetch = options.fetch ?? globalThis.fetch
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const maxBatch = options.maxBatch ?? 50
  const maxQueue = options.maxQueue ?? 500
  const timeoutMs = options.timeoutMs ?? 5000
  const sampling = Math.min(1, Math.max(0, options.requestSampling ?? 1))
  const ctx: Context = {
    instrumentationKey: connection.instrumentationKey,
    role: options.role,
    instance: options.instance ?? process.env.WEBSITE_INSTANCE_ID ?? String(process.pid),
    version: options.version,
  }

  let queue: Envelope[] = []
  let flushing: Promise<void> | null = null
  let failures = 0
  let retryAt = 0

  const post = (items: Envelope[]) =>
    doFetch(connection.trackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(items),
      signal: AbortSignal.timeout(timeoutMs),
    })

  const enqueue = (item: Envelope) => {
    try {
      queue.push(item)
      if (queue.length > maxQueue) queue = queue.slice(queue.length - maxQueue) // descarta os mais antigos
      if (queue.length >= maxBatch && now() >= retryAt) void flush()
    } catch (error) {
      report(`telemetria: falha ao enfileirar (${String(error)})`)
    }
  }

  async function sendOnce(): Promise<void> {
    const batch = queue.splice(0, maxBatch)
    if (batch.length === 0) return
    try {
      const res = await post(batch)
      if (res.status === 200) {
        failures = 0
        return
      }
      if (res.status === 206) {
        // Aceitou parte: reenvia só o que o serviço marcou como transitório.
        const body = (await res.json().catch(() => null)) as { errors?: { index: number; statusCode: number }[] } | null
        const again = (body?.errors ?? []).filter((e) => RETRYABLE.has(e.statusCode)).map((e) => batch[e.index]).filter((e): e is Envelope => Boolean(e))
        if (again.length) queue = [...again, ...queue].slice(0, maxQueue)
        return
      }
      if (RETRYABLE.has(res.status)) throw new Error(`HTTP ${res.status}`)
      report(`telemetria recusada pelo serviço (HTTP ${res.status}); ${batch.length} item(ns) descartado(s)`)
    } catch (error) {
      failures++
      retryAt = now() + Math.min(60_000, 2 ** failures * 2000)
      queue = [...batch, ...queue].slice(0, maxQueue)
      report(`telemetria: envio falhou (${error instanceof Error ? error.message : String(error)}); nova tentativa em breve`)
    }
  }

  function flush(): Promise<void> {
    if (flushing) return flushing
    const run = (async () => {
      while (queue.length > 0 && now() >= retryAt) {
        const before = failures
        await sendOnce()
        if (failures > before) break
      }
    })()
    flushing = run
    // Libera só depois de terminar (e só se ninguém tiver trocado a promessa): evita ficar preso numa promessa antiga.
    void run.finally(() => {
      if (flushing === run) flushing = null
    })
    return run
  }

  const timer = setInterval(() => void flush(), options.flushIntervalMs ?? 10_000)
  timer.unref?.()

  const safe =
    <A extends unknown[]>(fn: (...args: A) => Envelope) =>
    (...args: A) => {
      try {
        enqueue(fn(...args))
      } catch (error) {
        report(`telemetria: item descartado (${String(error)})`)
      }
    }

  return {
    enabled: true,
    trackRequest: (input) => {
      if (sampling < 1 && random() >= sampling) return
      safe((i: RequestInput) => requestEnvelope(ctx, i))(input)
    },
    trackException: safe((input: ExceptionInput) => exceptionEnvelope(ctx, input)),
    trackEvent: safe((name: string, properties?: Props, measurements?: Record<string, number>) => eventEnvelope(ctx, name, properties, measurements)),
    trackMetric: safe((name: string, value: number, properties?: Props) => metricEnvelope(ctx, name, value, properties)),
    trackTrace: safe((message: string, severity?: keyof typeof SEVERITY, properties?: Props) => traceEnvelope(ctx, message, severity, properties)),
    flush,
    async shutdown() {
      clearInterval(timer)
      retryAt = 0
      await flush()
    },
    async check() {
      try {
        const res = await post([eventEnvelope(ctx, 'telemetry.check', { role: options.role })])
        const body = (await res.json().catch(() => null)) as { itemsReceived?: number; itemsAccepted?: number; errors?: { message?: string }[] } | null
        return {
          ok: res.status === 200 && body?.itemsAccepted === 1,
          status: res.status,
          itemsReceived: body?.itemsReceived,
          itemsAccepted: body?.itemsAccepted,
          errors: body?.errors?.map((e) => e.message ?? '').filter(Boolean),
        }
      } catch (error) {
        return { ok: false, status: 0, message: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
