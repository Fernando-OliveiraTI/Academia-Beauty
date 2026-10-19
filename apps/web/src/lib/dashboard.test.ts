import { describe, expect, it } from 'vitest'
import { delta, niceScale, ratio, shortDate, timeAgo } from './dashboard'

describe('delta', () => {
  it('compara com o período anterior', () => {
    expect(delta(150, 100)).toEqual({ kind: 'up', label: '+50%' })
    expect(delta(50, 100)).toEqual({ kind: 'down', label: '−50%' })
    expect(delta(100, 100).kind).toBe('flat')
  })
  it('trata zeros sem dividir por zero', () => {
    expect(delta(0, 0).kind).toBe('none')
    expect(delta(8, 0).kind).toBe('new')
    expect(delta(0, 8)).toEqual({ kind: 'down', label: '−100%' })
  })
})

describe('ratio', () => {
  it('não gera NaN', () => {
    expect(ratio(5, 0)).toBe(0)
    expect(ratio(1, 4)).toBe(25)
  })
})

describe('niceScale', () => {
  it('arredonda o teto para um valor legível', () => {
    expect(niceScale(87).top).toBe(100)
    expect(niceScale(87).ticks).toEqual([0, 25, 50, 75, 100])
    expect(niceScale(3).ticks[4]).toBeGreaterThanOrEqual(3)
  })
  it('funciona sem dados', () => {
    expect(niceScale(0).ticks).toEqual([0, 1, 2, 3, 4])
  })
})

describe('datas', () => {
  it('formata dia/mês sem fuso', () => {
    expect(shortDate('2026-10-07')).toBe('07/10')
  })
  it('descreve o tempo decorrido', () => {
    const now = Date.parse('2026-10-17T12:00:00Z')
    expect(timeAgo('2026-10-17T11:55:00Z', now)).toBe('há 5 min')
    expect(timeAgo('2026-10-17T09:00:00Z', now)).toBe('há 3 h')
    expect(timeAgo('2026-10-16T09:00:00Z', now)).toBe('ontem')
  })
})
