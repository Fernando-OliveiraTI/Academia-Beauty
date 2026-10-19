import { describe, expect, it } from 'vitest'
import { brl, money } from './format'

const nbsp = (s: string) => s.replace(/\s/g, ' ')

describe('format', () => {
  it('brl formata centavos em reais', () => {
    expect(nbsp(brl(29700))).toBe('R$ 297,00')
    expect(nbsp(brl(123456))).toBe('R$ 1.234,56')
    expect(nbsp(brl(0))).toBe('R$ 0,00')
  })

  it('money usa BRL por padrão e a moeda informada', () => {
    expect(nbsp(money(29700))).toBe('R$ 297,00')
    expect(nbsp(money(1050, 'USD'))).toBe('US$ 10,50')
    expect(nbsp(money(1050, null))).toBe('R$ 10,50')
  })

  it('money mostra traço quando não há valor', () => {
    expect(money(null)).toBe('—')
    expect(money(null, 'USD')).toBe('—')
  })
})
