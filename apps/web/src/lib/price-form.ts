import { computeOffer, PRICE_MAX_CENTS, PRICE_MIN_CENTS, type ComputedOffer, type PriceDisplay } from '@academia/contracts'
import { centsToInput, parseBRLToCents } from '@/app/admin/(protected)/cursos/form-model'

/**
 * Campos de preço do formulário da oferta. O formato escolhido decide quais campos aparecem:
 * - `standard`: só o preço (`final`);
 * - `percent_off`: preço de tabela (`list`) e desconto em % (`pct`);
 * - `from_to` e `full`: "de" (`list`) e "por" (`final`); o % é calculado.
 */
export type PriceForm = { display: PriceDisplay; list: string; final: string; pct: string }
export type PriceErrors = Partial<Record<'list' | 'final' | 'pct', string>>

type Commercial = { listCents: number; discountPct: number; maxInstallments: number; priceDisplay?: PriceDisplay; finalCents?: number | null }

export const initialPriceForm = (c: Commercial | null | undefined): PriceForm => {
  if (!c) return { display: 'full', list: '', final: '', pct: '0' }
  const offer = computeOffer(c)
  return { display: c.priceDisplay ?? 'full', list: centsToInput(c.listCents), final: centsToInput(offer.totalCents), pct: String(c.discountPct) }
}

export type PriceValue = { listCents: number; discountPct: number; finalCents: number | null; priceDisplay: PriceDisplay }
export type PriceResult = { ok: true; value: PriceValue; offer: ComputedOffer } | { ok: false; errors: PriceErrors }

const inRange = (cents: number | null) => cents !== null && cents >= PRICE_MIN_CENTS && cents <= PRICE_MAX_CENTS
const RANGE = 'Informe um valor entre R$ 1,00 e R$ 100.000,00.'

/** O que a API recebe, a oferta calculada para a prévia, ou o erro de cada campo visível. */
export function priceResult(form: PriceForm, maxInstallments = 1): PriceResult {
  const build = (value: PriceValue): PriceResult => ({ ok: true, value, offer: computeOffer({ ...value, maxInstallments }) });
  if (form.display === 'standard') {
    const price = parseBRLToCents(form.final)
    if (!inRange(price)) return { ok: false, errors: { final: RANGE } }
    return build({ listCents: price!, discountPct: 0, finalCents: null, priceDisplay: 'standard' })
  }
  const list = parseBRLToCents(form.list)
  if (!inRange(list)) return { ok: false, errors: { list: RANGE } }
  if (form.display === 'percent_off') {
    const pct = Number(form.pct)
    if (form.pct.trim() === '' || !Number.isInteger(pct) || pct < 0 || pct > 90) return { ok: false, errors: { pct: 'Informe de 0 a 90.' } }
    return build({ listCents: list!, discountPct: pct, finalCents: null, priceDisplay: 'percent_off' })
  }
  // de / por (completo ou sem selo): o "por" em branco = sem desconto
  const final = form.final.trim() === '' ? null : parseBRLToCents(form.final)
  if (final === null && form.final.trim() !== '') return { ok: false, errors: { final: RANGE } }
  if (final !== null && !inRange(final)) return { ok: false, errors: { final: RANGE } }
  if (final !== null && final > list!) return { ok: false, errors: { final: 'O "por" precisa ser menor que o "de".' } }
  if (final !== null && final < list! * 0.1) return { ok: false, errors: { final: 'O desconto máximo é 90%: o "por" não pode ser menor que 10% do "de".' } }
  const typed = final !== null && final < list! ? final : null
  const pct = typed === null ? 0 : Math.round(((list! - typed) * 100) / list!)
  return build({ listCents: list!, discountPct: pct, finalCents: typed, priceDisplay: form.display })
}

/** Troca o formato levando os valores já digitados (o preço atual vira o "por", o % vira o desconto etc.). */
export function switchPriceDisplay(form: PriceForm, next: PriceDisplay, maxInstallments = 1): PriceForm {
  if (next === form.display) return form
  const current = priceResult(form, maxInstallments)
  if (!current.ok) return { ...form, display: next }
  const { listCents, discountPct, totalCents } = current.offer
  if (next === 'standard') return { ...form, display: next, final: centsToInput(totalCents) }
  if (next === 'percent_off') return { display: next, list: centsToInput(listCents), final: form.final, pct: String(discountPct) }
  return { display: next, list: centsToInput(listCents), final: centsToInput(totalCents), pct: String(discountPct) }
}

/** Houve mudança em relação à oferta salva? (compara o resultado, não o texto digitado). */
export function priceDirty(form: PriceForm, saved: Commercial | null | undefined, maxInstallments = 1): boolean {
  const now = priceResult(form, maxInstallments)
  if (!saved) return form.list.trim() !== '' || form.final.trim() !== ''
  if (!now.ok) return true
  const v = now.value
  return v.listCents !== saved.listCents || v.discountPct !== saved.discountPct || (v.finalCents ?? null) !== (saved.finalCents ?? null) || v.priceDisplay !== (saved.priceDisplay ?? 'full')
}
