import { DateTime } from 'luxon'
import env from '#start/env'
import WebhookDelivery from '#models/webhook_delivery'

/** Teto do corpo guardado por chamada (o corpo real dos webhooks de venda tem poucos KB). */
export const MAX_LOGGED_BODY = 128 * 1024
const MAX_ROWS = 5000

/** Só estes cabeçalhos são guardados (nada de cookie nem authorization). */
const HEADER_WHITELIST = [
  'content-type',
  'content-length',
  'user-agent',
  'x-signature',
  'x-forwarded-for',
  'x-real-ip',
  'host',
  'x-request-id',
  'accept',
]

export type DeliveryInput = {
  result: string
  httpStatus: number
  raw: string
  headers: Record<string, string | string[] | undefined>
  ip: string | null
  event?: string | null
  signatureScheme?: string | null
  paymentEventId?: number | null
}

export function retentionDays(): number {
  const raw = Number(env.get('THEMEMBERS_LOG_RETENTION_DAYS') ?? 30)
  return Number.isFinite(raw) && raw >= 1 ? Math.min(raw, 365) : 30
}

export function pickHeaders(headers: DeliveryInput['headers']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of HEADER_WHITELIST) {
    const value = headers[name]
    if (value === undefined) continue
    out[name] = (Array.isArray(value) ? value.join(', ') : value).slice(0, 300)
  }
  return out
}

export default class WebhookLogService {
  /** Registro de depuração: nunca derruba o webhook (qualquer falha aqui é engolida). Desligável por `THEMEMBERS_LOG_RAW=false`. */
  static async record(input: DeliveryInput): Promise<void> {
    if (env.get('THEMEMBERS_LOG_RAW') === false) return
    try {
      const bytes = Buffer.byteLength(input.raw, 'utf8')
      const truncated = bytes > MAX_LOGGED_BODY
      await WebhookDelivery.create({
        provider: 'themembers',
        result: input.result,
        httpStatus: input.httpStatus,
        event: input.event ?? null,
        signatureScheme: input.signatureScheme ?? null,
        ip: input.ip?.slice(0, 45) ?? null,
        headers: pickHeaders(input.headers),
        bodyBytes: bytes,
        bodyTruncated: truncated,
        rawBody: truncated ? input.raw.slice(0, MAX_LOGGED_BODY) : input.raw,
        paymentEventId: input.paymentEventId ?? null,
        receivedAt: DateTime.utc(),
      })
      await WebhookLogService.purge()
    } catch {
      // registro técnico: falha de banco aqui não pode afetar o recebimento do webhook
    }
  }

  /** Apaga o que passou da retenção e o excedente de linhas (limpeza barata, feita junto da gravação). */
  static async purge(now: DateTime = DateTime.utc()): Promise<void> {
    const cutoff = now.minus({ days: retentionDays() })
    await WebhookDelivery.query()
      .where('received_at', '<', cutoff.toSQL({ includeOffset: false })!)
      .delete()
    const newest = await WebhookDelivery.query().orderBy('id', 'desc').offset(MAX_ROWS).first()
    if (newest) await WebhookDelivery.query().where('id', '<=', newest.id).delete()
  }
}
