/** Rótulos e formatos das visitas ao checkout (módulo simples: usado por componentes de servidor e de cliente). */
export type PaymentState = 'paid' | 'pending' | 'refunded' | 'failed' | 'none'

export const STATE_LABEL: Record<PaymentState, string> = {
  paid: 'Pagaram',
  pending: 'Pendentes',
  refunded: 'Reembolsadas',
  failed: 'Não aprovadas',
  none: 'Sem pagamento',
}
export const STATE_PILL: Record<PaymentState, string> = {
  paid: 'Pago',
  pending: 'Aguardando',
  refunded: 'Reembolsado',
  failed: 'Não aprovado',
  none: 'Só visitou',
}
export const STATE_TONE: Record<PaymentState, 'ok' | 'warn' | 'bad' | 'neutral'> = { paid: 'ok', pending: 'warn', refunded: 'bad', failed: 'bad', none: 'neutral' }
export const DEVICE_LABEL: Record<string, string> = { mobile: 'Celular', tablet: 'Tablet', desktop: 'Computador', bot: 'Robô' }

export function countryName(code: string | null): string | null {
  if (!code) return null
  try { return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(code) ?? code } catch { return code }
}

/** "Recife · PE, Brasil" (o que houver). */
export function placeOf(city: string | null, region: string | null, country: string | null): string | null {
  const head = [city, region].filter(Boolean).join(' · ')
  const tail = countryName(country)
  return [head, tail].filter(Boolean).join(', ') || null
}

/** Etapas da história de um pagamento (sem pedido, acesso nem chamadas do webhook). */
export const HISTORY_LABEL: Record<string, string> = {
  pending: 'Pagamento pendente',
  processing: 'Pagamento em processamento',
  approved: 'Pagamento aprovado',
  failed: 'Pagamento recusado',
  pending_refund: 'Reembolso pendente',
  refunded: 'Reembolso aprovado',
  charged_back: 'Chargeback',
}
export const HISTORY_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  pending: 'warn',
  processing: 'warn',
  approved: 'ok',
  failed: 'bad',
  pending_refund: 'warn',
  refunded: 'bad',
  charged_back: 'bad',
}

/** Etiqueta da situação atual de uma visita: reembolso mostra o passo exato (pendente, reembolsado, chargeback). */
export function paymentPill(payment: { state: PaymentState; status: string | null }): { text: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' } {
  if (payment.state === 'refunded') {
    if (payment.status === 'pending_refund') return { text: 'Reembolso pendente', tone: 'warn' }
    if (payment.status === 'charged_back') return { text: 'Chargeback', tone: 'bad' }
    return { text: 'Reembolsado', tone: 'bad' }
  }
  return { text: STATE_PILL[payment.state], tone: STATE_TONE[payment.state] }
}
