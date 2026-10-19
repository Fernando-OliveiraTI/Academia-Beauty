import PaymentEvent from '#models/payment_event'
import { REF_PATTERN } from '#services/themembers_webhook_service'

/** Situação do pagamento para o comprador (nada além disto sai pela rota pública). */
export type CheckoutStatus = {
  status: 'none' | 'processing' | 'waiting' | 'approved' | 'failed' | 'refunded'
  /** `pix`/`boleto` quando aguardando; ajuda a página a dizer o que fazer. */
  method: string | null
}

export function isValidRef(ref: unknown): ref is string {
  return typeof ref === 'string' && REF_PATTERN.test(ref)
}

const APPROVED = new Set(['approved', 'completed'])
const REFUNDED = new Set(['refunded', 'charged_back', 'pending_refund'])

export default class CheckoutStatusService {
  /**
   * O evento mais recente da visita (por data do evento e, no empate, o último recebido) decide. Assim "recusado" seguido
   * de "aprovado" (nova tentativa) vale como aprovado, e "aprovado" seguido de reembolso vale como reembolsado.
   */
  static async forRef(ref: string): Promise<CheckoutStatus> {
    const latest = await PaymentEvent.query()
      .where('ref', ref)
      .whereIn('kind', ['transaction', 'order'])
      .orderBy('occurred_at', 'desc')
      .orderBy('id', 'desc')
      .first()
    if (!latest?.status) return { status: 'none', method: null }
    if (APPROVED.has(latest.status)) return { status: 'approved', method: null }
    if (REFUNDED.has(latest.status)) return { status: 'refunded', method: null }
    if (latest.status === 'failed' || latest.status === 'canceled' || latest.status === 'expired') {
      return { status: 'failed', method: null }
    }
    if (latest.status === 'pending') return { status: 'waiting', method: latest.paymentMethod }
    if (latest.status === 'processing')
      return { status: 'processing', method: latest.paymentMethod }
    return { status: 'none', method: null }
  }
}
