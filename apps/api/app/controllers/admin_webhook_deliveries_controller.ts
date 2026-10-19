import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import WebhookDelivery from '#models/webhook_delivery'
import { prettyJson } from '#services/pretty_json'
import { retentionDays } from '#services/webhook_log_service'
import env from '#start/env'

const PER_PAGE = 30
const RESULTS = [
  'accepted',
  'duplicate',
  'invalid_signature',
  'invalid_payload',
  'not_configured',
  'empty_body',
]

const toListItem = (d: WebhookDelivery) => ({
  id: d.id,
  receivedAt: d.receivedAt.toUTC().toISO(),
  result: d.result,
  httpStatus: d.httpStatus,
  event: d.event,
  signatureScheme: d.signatureScheme,
  ip: d.ip,
  bodyBytes: d.bodyBytes,
  bodyTruncated: d.bodyTruncated,
  paymentEventId: d.paymentEventId,
})

/** Registro técnico do webhook da The Members (corpo bruto, com dados pessoais): só administrador (`users.manage`). */
export default class AdminWebhookDeliveriesController {
  async index({ request }: HttpContext) {
    const result = String(request.qs().result ?? '')
    const page = Math.max(1, Number.parseInt(String(request.qs().page ?? '1'), 10) || 1)
    const query = WebhookDelivery.query().orderBy('id', 'desc')
    if (RESULTS.includes(result)) query.where('result', result)
    const [rows, total, counts] = await Promise.all([
      query
        .clone()
        .offset((page - 1) * PER_PAGE)
        .limit(PER_PAGE),
      query.clone().clearOrder().count('* as n').first(),
      db.from('webhook_deliveries').select('result').count('* as n').groupBy('result'),
    ])
    return {
      items: rows.map(toListItem),
      total: Number((total?.$extras as { n?: number | string } | undefined)?.n ?? 0),
      page,
      perPage: PER_PAGE,
      counts: Object.fromEntries(
        (counts as Array<{ result: string; n: number | string }>).map((c) => [
          c.result,
          Number(c.n),
        ])
      ),
      loggingEnabled: env.get('THEMEMBERS_LOG_RAW') !== false,
      retentionDays: retentionDays(),
    }
  }

  async show({ params, response }: HttpContext) {
    const delivery = await WebhookDelivery.find(params.id)
    if (!delivery) return response.notFound({ message: 'Chamada não encontrada' })
    return {
      ...toListItem(delivery),
      headers: delivery.headers,
      rawBody: delivery.rawBody ?? '',
      prettyBody: delivery.rawBody ? prettyJson(delivery.rawBody) : '',
    }
  }
}
