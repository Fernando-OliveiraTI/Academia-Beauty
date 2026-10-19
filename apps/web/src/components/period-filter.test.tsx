import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PeriodFilter, parsePeriod } from './period-filter'

describe('parsePeriod', () => {
  it('aceita 7, 30 e 90 (texto ou número) e cai em 30 no resto', () => {
    expect(parsePeriod('7')).toBe(7)
    expect(parsePeriod(90)).toBe(90)
    expect(parsePeriod('60')).toBe(30)
    expect(parsePeriod(undefined)).toBe(30)
    expect(parsePeriod('abc')).toBe(30)
  })
})

describe('PeriodFilter', () => {
  it('marca só o período atual e monta o link de cada opção', () => {
    render(<PeriodFilter value={30} hrefFor={(d) => `/x?days=${d}`} />)
    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['7 dias', '30 dias', '90 dias'])
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/x?days=7', '/x?days=30', '/x?days=90'])
    expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, 'page', null])
  })
})
