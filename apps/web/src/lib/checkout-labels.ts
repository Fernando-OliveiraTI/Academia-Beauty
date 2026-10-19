/** Rótulos e formatos das visitas ao checkout (módulo simples: usado por componentes de servidor e de cliente). */
export type PaymentState = 'paid' | 'pending' | 'failed' | 'none'

export const STATE_LABEL: Record<PaymentState, string> = {
  paid: 'Pagaram',
  pending: 'Pendentes',
  failed: 'Não aprovadas',
  none: 'Sem pagamento',
}
export const STATE_PILL: Record<PaymentState, string> = {
  paid: 'Pago',
  pending: 'Aguardando',
  failed: 'Não aprovado',
  none: 'Só visitou',
}
export const STATE_TONE: Record<PaymentState, 'ok' | 'warn' | 'bad' | 'neutral'> = { paid: 'ok', pending: 'warn', failed: 'bad', none: 'neutral' }
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
