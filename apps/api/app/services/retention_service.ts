import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import CheckoutSessionService from '#services/checkout_session_service'
import WebhookLogService from '#services/webhook_log_service'

function days(raw: number | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw ?? fallback)
  return Number.isFinite(value) && value >= min ? Math.min(value, max) : fallback
}

export const pageEventsDays = () => days(env.get('PAGE_EVENTS_RETENTION_DAYS'), 400, 30, 1095)
export const auditDays = () => days(env.get('AUDIT_LOG_RETENTION_DAYS'), 730, 90, 3650)
export const paymentEventsDays = () =>
  days(env.get('PAYMENT_EVENTS_RETENTION_DAYS'), 1825, 365, 3650)

/** `delete()` do query builder devolve a contagem de linhas (o tipo da biblioteca diz array). */
const affected = (result: unknown) => Number(result)
const sql = (date: DateTime) => date.toSQL({ includeOffset: false })!

export type PurgeReport = Record<string, number>

/**
 * Limpeza de dados vencidos (retenção). Roda por agendamento (`node ace maintenance:purge`, uma vez ao dia): a limpeza
 * "de carona" nas gravações só cobre visitas e registro de webhook, e só enquanto há tráfego.
 */
export default class RetentionService {
  static async purgeAll(now: DateTime = DateTime.utc()): Promise<PurgeReport> {
    const report: PurgeReport = {}

    report.page_events = affected(
      await db
        .from('page_events')
        .where('created_at', '<', sql(now.minus({ days: pageEventsDays() })))
        .delete()
    )
    report.audit_logs = affected(
      await db
        .from('audit_logs')
        .where('created_at', '<', sql(now.minus({ days: auditDays() })))
        .delete()
    )
    report.payment_events = affected(
      await db
        .from('payment_events')
        .where('received_at', '<', sql(now.minus({ days: paymentEventsDays() })))
        .delete()
    )
    // Sessões vencidas e contadores de limite vencidos (a coluna `expire` está em milissegundos).
    report.sessions = affected(
      await db.from('sessions').where('expires_at', '<', sql(now)).delete()
    )
    report.rate_limits = affected(
      await db.from('rate_limits').where('expire', '<', now.toMillis()).delete()
    )

    // Visitas ao checkout e registro bruto do webhook têm as próprias regras (retenção e teto de linhas).
    const [sessionsBefore, deliveriesBefore] = await Promise.all([
      db.from('checkout_sessions').count('* as n').first(),
      db.from('webhook_deliveries').count('* as n').first(),
    ])
    await CheckoutSessionService.purge(now)
    await WebhookLogService.purge(now)
    const [sessionsAfter, deliveriesAfter] = await Promise.all([
      db.from('checkout_sessions').count('* as n').first(),
      db.from('webhook_deliveries').count('* as n').first(),
    ])
    report.checkout_sessions = Number(sessionsBefore?.n ?? 0) - Number(sessionsAfter?.n ?? 0)
    report.webhook_deliveries = Number(deliveriesBefore?.n ?? 0) - Number(deliveriesAfter?.n ?? 0)
    return report
  }
}
