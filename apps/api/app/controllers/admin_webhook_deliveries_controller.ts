import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import WebhookDelivery from '#models/webhook_delivery'
import { prettyJson } from '#services/pretty_json'
import { retentionDays } from '#services/webhook_log_service'
import env from '#start/env'

const PER_PAGES = [10, 20, 50]
const DEFAULT_PER_PAGE = 20
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
  /** A chamada trouxe o cabeçalho X-Signature? (diferencia "assinatura ausente" de "assinatura inválida"). */
  hasSignatureHeader: Boolean(d.headers?.['x-signature']),
  ip: d.ip,
  bodyBytes: d.bodyBytes,
  bodyTruncated: d.bodyTruncated,
  paymentEventId: d.paymentEventId,
})

/** `%` e `_` digitados pelo usuário valem como texto na busca (não como curinga do LIKE). */
const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Registro técnico do webhook da The Members (corpo bruto, com dados pessoais): só administrador (`users.manage`). */
export default class AdminWebhookDeliveriesController {
  async index({ request }: HttpContext) {
    const qs = request.qs()
    const result = String(qs.result ?? '')
    const q = String(qs.q ?? '')
      .trim()
      .slice(0, 80)
    const page = Math.max(1, Number.parseInt(String(qs.page ?? '1'), 10) || 1)
    const asked = Number.parseInt(String(qs.perPage ?? ''), 10)
    const perPage = PER_PAGES.includes(asked) ? asked : DEFAULT_PER_PAGE

    const filtered = () => {
      const query = WebhookDelivery.query()
      if (RESULTS.includes(result)) query.where('result', result)
      if (q) {
        const like = `%${likeEscape(q)}%`
        query.where((sub) => {
          sub
            .where('event', 'like', like)
            .orWhere('signature_scheme', 'like', like)
            .orWhere('result', 'like', like)
            .orWhere('ip', 'like', like)
          if (/^\d+$/.test(q)) sub.orWhere('id', Number(q))
          // Ids de transação/produto vivem no corpo: só busca nele com 6+ caracteres (evita varredura por 1-2 letras).
          if (q.length >= 6) sub.orWhere('raw_body', 'like', like)
        })
      }
      return query
    }
    const rows = await filtered()
      .orderBy('id', String(qs.sort) === 'oldest' ? 'asc' : 'desc')
      .offset((page - 1) * perPage)
      .limit(perPage)
    const total = await filtered().count('* as n').first()
    const counts = await db
      .from('webhook_deliveries')
      .select('result')
      .count('* as n')
      .groupBy('result')
    return {
      items: rows.map(toListItem),
      total: Number((total?.$extras as { n?: number | string } | undefined)?.n ?? 0),
      page,
      perPage,
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
