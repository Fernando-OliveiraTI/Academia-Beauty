import type { CoursePayments, PaymentEventItem, PaymentsSummary } from '@academia/contracts'
import env from '#start/env'
import CommercialConfig from '#models/commercial_config'
import Course from '#models/course'
import PaymentEvent from '#models/payment_event'
import db from '@adonisjs/lucid/services/db'
import { DomainError } from '#services/domain_error'

export const WEBHOOK_PATH = '/webhooks/themembers'
const ITEMS = 50
const WINDOW = 500

const toItem = (e: PaymentEvent): PaymentEventItem => ({
  id: e.id,
  event: e.event,
  kind: e.kind,
  status: e.status,
  paymentMethod: e.paymentMethod,
  amountCents: e.amountCents,
  currency: e.currency,
  instalments: e.instalments,
  cardBrand: e.cardBrand,
  buyerName: e.buyerName,
  buyerEmail: e.buyerEmail,
  occurredAt: e.occurredAt.toUTC().toISO() ?? '',
  receivedAt: e.receivedAt.toUTC().toISO() ?? '',
})

/** O último evento de cada transação (por data do evento e, no empate, o mais recente recebido) define a situação dela. */
export function summarizeTransactions(events: PaymentEvent[]): PaymentsSummary {
  const latest = new Map<string, PaymentEvent>()
  for (const e of events) {
    if (e.kind !== 'transaction') continue
    const key = e.externalTransactionId ?? `evt-${e.id}`
    const current = latest.get(key)
    const newer =
      !current ||
      e.occurredAt.toMillis() > current.occurredAt.toMillis() ||
      (e.occurredAt.toMillis() === current.occurredAt.toMillis() && e.id > current.id)
    if (newer) latest.set(key, e)
  }
  const summary: PaymentsSummary = {
    transactions: latest.size,
    approved: 0,
    approvedCents: 0,
    refunded: 0,
    failed: 0,
    pending: 0,
  }
  for (const e of latest.values()) {
    if (e.status === 'approved') {
      summary.approved += 1
      summary.approvedCents += e.amountCents ?? 0
    } else if (
      e.status === 'refunded' ||
      e.status === 'charged_back' ||
      e.status === 'pending_refund'
    ) {
      summary.refunded += 1
    } else if (e.status === 'failed') {
      summary.failed += 1
    } else {
      summary.pending += 1
    }
  }
  return summary
}

export default class PaymentsService {
  static async forCourse(courseId: number): Promise<CoursePayments> {
    const course = await Course.find(courseId)
    if (!course) throw new DomainError(404, 'not_found', 'Curso não encontrado')
    const config = await CommercialConfig.query().where('course_id', courseId).first()

    const recent = await PaymentEvent.query()
      .where('course_id', courseId)
      .orderBy('occurred_at', 'desc')
      .orderBy('id', 'desc')
      .limit(WINDOW)
    const unmatched = (await db
      .from('payment_events')
      .whereNull('course_id')
      .where('kind', 'transaction')
      .count('* as total')
      .first()) as { total: number | string } | null

    return {
      webhookConfigured:
        Boolean(env.get('THEMEMBERS_WEBHOOK_SECRET')) ||
        (env.get('THEMEMBERS_WEBHOOK_TOKEN') ?? '').length >= 24,
      webhookPath: WEBHOOK_PATH,
      webhookTokenConfigured: (env.get('THEMEMBERS_WEBHOOK_TOKEN') ?? '').length >= 24,
      externalCourseId: config?.externalCourseId ?? '',
      summary: summarizeTransactions(recent),
      items: recent.slice(0, ITEMS).map(toItem),
      unmatchedTransactions: Number(unmatched?.total ?? 0),
    }
  }
}
