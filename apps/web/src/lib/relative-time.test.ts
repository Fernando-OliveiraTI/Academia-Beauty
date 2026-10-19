import { describe, expect, it } from 'vitest'
import { relativeTime } from './relative-time'

const NOW = Date.parse('2026-10-19T15:00:00Z')
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString()

describe('relativeTime', () => {
  it('descreve minutos, horas, dias, meses e anos', () => {
    expect(relativeTime(ago(5 * 60), NOW)).toBe('há 5 minutos')
    expect(relativeTime(ago(2 * 3600 + 10), NOW)).toBe('há 2 horas')
    expect(relativeTime(ago(26 * 3600), NOW)).toBe('há 1 dia')
    expect(relativeTime(ago(3 * 86400), NOW)).toBe('há 3 dias')
    expect(relativeTime(ago(65 * 86400), NOW)).toBe('há 2 meses')
    expect(relativeTime(ago(400 * 86400), NOW)).toBe('há 1 ano')
  })
  it('trata menos de um minuto, futuro e data inválida como "agora"', () => {
    expect(relativeTime(ago(20), NOW)).toBe('agora')
    expect(relativeTime(ago(-3600), NOW)).toBe('agora')
    expect(relativeTime('lixo', NOW)).toBe('agora')
  })
})
