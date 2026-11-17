import { describe, expect, it } from 'vitest'
import { avgTime, fmtDuration, insightsQuery, parseInsightsFilters, todayBr } from './insights'

const NOW = new Date('2026-11-17T02:00:00Z') // 16/11 23:00 em Brasília

describe('parseInsightsFilters', () => {
  it('padrão: últimos 30 dias até hoje no calendário de Brasília', () => {
    expect(todayBr(NOW)).toBe('2026-11-16')
    expect(parseInsightsFilters({}, NOW)).toMatchObject({ from: '2026-10-18', to: '2026-11-16', preset: 30 })
  })
  it('atalho 7 dias e datas livres; datas inválidas ou invertidas voltam ao padrão', () => {
    expect(parseInsightsFilters({ days: '7' }, NOW)).toMatchObject({ from: '2026-11-10', to: '2026-11-16', preset: 7 })
    expect(parseInsightsFilters({ from: '2026-11-01', to: '2026-11-05' }, NOW)).toMatchObject({ from: '2026-11-01', to: '2026-11-05', preset: 0 })
    expect(parseInsightsFilters({ from: '2026-11-05', to: '2026-11-01' }, NOW)).toMatchObject({ preset: 30 })
    expect(parseInsightsFilters({ from: 'ontem', to: '2026-11-01' }, NOW)).toMatchObject({ preset: 30 })
  })
  it('ids, aparelho e origem só valem se válidos', () => {
    const f = parseInsightsFilters({ professionalId: '3', courseId: 'x', device: 'mobile', origin: 'hack' }, NOW)
    expect(f).toMatchObject({ professionalId: 3, courseId: undefined, device: 'mobile', origin: undefined })
    expect(insightsQuery(f)).toBe('from=2026-10-18&to=2026-11-16&professionalId=3&device=mobile')
  })
})

describe('tempo', () => {
  it('formata a duração e calcula a média por visita', () => {
    expect(fmtDuration(42_000)).toBe('42s')
    expect(fmtDuration(95_000)).toBe('1min 35s')
    expect(fmtDuration(120_000)).toBe('2min')
    expect(fmtDuration(0)).toBe('—')
    expect(avgTime(90_000, 3)).toBe(30_000)
    expect(avgTime(10, 0)).toBe(0)
  })
})
