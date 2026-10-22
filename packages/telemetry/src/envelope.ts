import { sanitizeProps, scrubText, scrubUrl, truncate, type Props } from './scrub.js'

export type Envelope = {
  name: string
  time: string
  iKey: string
  tags: Record<string, string>
  data: { baseType: string; baseData: Record<string, unknown> }
}

export type Context = { instrumentationKey: string; role: string; instance: string; version?: string }

/** Severidades do Application Insights. */
export const SEVERITY = { verbose: 0, information: 1, warning: 2, error: 3, critical: 4 } as const

const KINDS: Record<string, string> = { EventData: 'Event', ExceptionData: 'Exception', RequestData: 'Request', MessageData: 'Message', MetricData: 'Metric' }

/** Duração no formato do serviço: `DD.HH:MM:SS.fffffff` (dias só quando existem). */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const days = Math.floor(safe / 86_400_000)
  const rest = safe % 86_400_000
  const hh = String(Math.floor(rest / 3_600_000)).padStart(2, '0')
  const mm = String(Math.floor((rest % 3_600_000) / 60_000)).padStart(2, '0')
  const ss = String(Math.floor((rest % 60_000) / 1000)).padStart(2, '0')
  const frac = String(rest % 1000).padStart(3, '0')
  return `${days > 0 ? `${days}.` : ''}${hh}:${mm}:${ss}.${frac}0000`
}

function wrap(ctx: Context, baseType: string, baseData: Record<string, unknown>, tags: Record<string, string> = {}, at = new Date()): Envelope {
  return {
    name: `Microsoft.ApplicationInsights.${ctx.instrumentationKey.replace(/-/g, '')}.${KINDS[baseType]}`,
    time: at.toISOString(),
    iKey: ctx.instrumentationKey,
    tags: { 'ai.cloud.role': ctx.role, 'ai.cloud.roleInstance': ctx.instance, ...(ctx.version ? { 'ai.application.ver': ctx.version } : {}), ...tags },
    data: { baseType, baseData: { ver: 2, ...baseData } },
  }
}

const opTags = (operationId?: string, operationName?: string): Record<string, string> => ({
  ...(operationId ? { 'ai.operation.id': truncate(operationId, 128) } : {}),
  ...(operationName ? { 'ai.operation.name': truncate(scrubText(operationName, 200), 200) } : {}),
})

export type RequestInput = { id?: string; name: string; url: string; durationMs: number; resultCode: number | string; success: boolean; properties?: Props }
export type ExceptionInput = { error: unknown; severity?: keyof typeof SEVERITY; operationId?: string; properties?: Props }

export const eventEnvelope = (ctx: Context, name: string, properties?: Props, measurements?: Record<string, number>) =>
  wrap(ctx, 'EventData', { name: truncate(name, 150), properties: sanitizeProps(properties), measurements: measurements ?? {} })

export const metricEnvelope = (ctx: Context, name: string, value: number, properties?: Props) =>
  wrap(ctx, 'MetricData', { metrics: [{ name: truncate(name, 150), value, count: 1 }], properties: sanitizeProps(properties) })

export const traceEnvelope = (ctx: Context, message: string, severity: keyof typeof SEVERITY = 'information', properties?: Props) =>
  wrap(ctx, 'MessageData', { message: scrubText(message, 2000), severityLevel: SEVERITY[severity], properties: sanitizeProps(properties) })

export function requestEnvelope(ctx: Context, input: RequestInput): Envelope {
  const name = scrubText(input.name, 200)
  return wrap(
    ctx,
    'RequestData',
    {
      id: input.id ?? '',
      name,
      duration: formatDuration(input.durationMs),
      responseCode: String(input.resultCode),
      success: input.success,
      url: scrubUrl(input.url),
      properties: sanitizeProps(input.properties),
    },
    opTags(input.id, name),
  )
}

export function exceptionEnvelope(ctx: Context, input: ExceptionInput): Envelope {
  const err = input.error instanceof Error ? input.error : new Error(String(input.error))
  const stack = err.stack ? scrubText(err.stack, 8000) : undefined
  return wrap(
    ctx,
    'ExceptionData',
    {
      exceptions: [{ typeName: truncate(err.name || 'Error', 200), message: scrubText(err.message || err.name || 'Error', 2000), hasFullStack: Boolean(stack), stack }],
      severityLevel: SEVERITY[input.severity ?? 'error'],
      properties: sanitizeProps(input.properties),
    },
    opTags(input.operationId),
  )
}
