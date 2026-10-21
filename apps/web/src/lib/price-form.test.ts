import { describe, expect, it } from 'vitest'
import { initialPriceForm, priceDirty, priceResult, switchPriceDisplay, type PriceForm } from './price-form'

const form = (over: Partial<PriceForm> = {}): PriceForm => ({ display: 'from_to', list: '100,00', final: '50,00', pct: '0', ...over })

describe('formulário de preço por formato', () => {
  it('de/por: o "por" digitado manda e o % é calculado', () => {
    const r = priceResult(form({ list: '297,00', final: '197,00' }))
    expect(r.ok && r.value).toEqual({ listCents: 29700, discountPct: 34, finalCents: 19700, priceDisplay: 'from_to' })
    expect(r.ok && r.offer.totalCents).toBe(19700)
  })
  it('de/por: "por" em branco ou igual ao "de" = sem desconto; maior que o "de" ou abaixo de 10% é erro', () => {
    expect(priceResult(form({ final: '' })).ok).toBe(true)
    const same = priceResult(form({ final: '100,00' }))
    expect(same.ok && same.value.finalCents).toBeNull()
    expect(priceResult(form({ final: '150,00' }))).toMatchObject({ ok: false, errors: { final: expect.stringContaining('menor') } })
    expect(priceResult(form({ final: '5,00' }))).toMatchObject({ ok: false, errors: { final: expect.stringContaining('90%') } })
  })
  it('% OFF: preço de tabela e porcentagem', () => {
    const r = priceResult(form({ display: 'percent_off', pct: '30' }))
    expect(r.ok && r.value).toEqual({ listCents: 10000, discountPct: 30, finalCents: null, priceDisplay: 'percent_off' })
    expect(r.ok && r.offer.totalCents).toBe(7000)
    expect(priceResult(form({ display: 'percent_off', pct: '95' })).ok).toBe(false)
    expect(priceResult(form({ display: 'percent_off', pct: '' })).ok).toBe(false)
  })
  it('preço padrão: um preço só, sem desconto', () => {
    const r = priceResult(form({ display: 'standard', final: '87,50' }))
    expect(r.ok && r.value).toEqual({ listCents: 8750, discountPct: 0, finalCents: null, priceDisplay: 'standard' })
    expect(priceResult(form({ display: 'standard', final: '' })).ok).toBe(false)
  })
  it('trocar o formato leva os valores já digitados', () => {
    const toPct = switchPriceDisplay(form({ list: '200,00', final: '150,00' }), 'percent_off')
    expect(toPct).toMatchObject({ display: 'percent_off', list: '200,00', pct: '25' })
    const toStd = switchPriceDisplay(form({ list: '200,00', final: '150,00' }), 'standard')
    expect(toStd).toMatchObject({ display: 'standard', final: '150,00' })
    const back = switchPriceDisplay(form({ display: 'percent_off', list: '100,00', pct: '40' }), 'from_to')
    expect(back).toMatchObject({ display: 'from_to', list: '100,00', final: '60,00' })
  })
  it('só marca alteração quando o resultado muda em relação ao salvo', () => {
    const saved = { listCents: 10000, discountPct: 50, maxInstallments: 1, priceDisplay: 'from_to' as const, finalCents: 5000 }
    expect(priceDirty(initialPriceForm(saved), saved)).toBe(false)
    expect(priceDirty(form({ final: '60,00' }), saved)).toBe(true)
    expect(priceDirty(form({ display: 'full' }), saved)).toBe(true)
  })
  it('oferta salva por % abre com o "por" já calculado', () => {
    const f = initialPriceForm({ listCents: 10000, discountPct: 30, maxInstallments: 1, priceDisplay: 'percent_off', finalCents: null })
    expect(f).toMatchObject({ display: 'percent_off', list: '100,00', final: '70,00', pct: '30' })
  })
})
