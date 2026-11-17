import { INSIGHT_DEVICES, INSIGHT_ORIGINS, type InsightDevice, type InsightOrigin } from '@academia/contracts'

/** Data de hoje no calendário de Brasília (AAAA-MM-DD). */
export function todayBr(now = new Date()): string {
  return new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
}

const shift = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const YMD = /^\d{4}-\d{2}-\d{2}$/

export type InsightsFilters = {
  from: string
  to: string
  /** 7/30/90 quando o período é um atalho; 0 = datas escolhidas à mão. */
  preset: number
  professionalId?: number
  courseId?: number
  device?: InsightDevice
  origin?: InsightOrigin
}

/** Filtros da URL, com padrão "últimos 30 dias" (até hoje) e datas inválidas ignoradas. */
export function parseInsightsFilters(sp: Record<string, string | undefined>, now = new Date()): InsightsFilters {
  const today = todayBr(now)
  const preset = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 0
  let from = sp.from && YMD.test(sp.from) ? sp.from : ''
  let to = sp.to && YMD.test(sp.to) ? sp.to : ''
  if (preset || !from || !to || from > to) {
    const days = preset || 30
    to = today
    from = shift(today, -(days - 1))
  }
  const id = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined)
  return {
    from,
    to,
    preset: sp.from && sp.to && !preset && from === sp.from ? 0 : preset || 30,
    professionalId: id(sp.professionalId),
    courseId: id(sp.courseId),
    device: (INSIGHT_DEVICES as readonly string[]).includes(sp.device ?? '') ? (sp.device as InsightDevice) : undefined,
    origin: (INSIGHT_ORIGINS as readonly string[]).includes(sp.origin ?? '') ? (sp.origin as InsightOrigin) : undefined,
  }
}

/** Parâmetros da consulta à API (só os presentes). */
export function insightsQuery(f: InsightsFilters): string {
  const q = new URLSearchParams({ from: f.from, to: f.to })
  if (f.professionalId) q.set('professionalId', String(f.professionalId))
  if (f.courseId) q.set('courseId', String(f.courseId))
  if (f.device) q.set('device', f.device)
  if (f.origin) q.set('origin', f.origin)
  return q.toString()
}

/** 95_000 ms → "1min 35s"; 42_000 → "42s"; 0 → "—". */
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const total = Math.round(ms / 1000)
  if (total < 60) return `${total}s`
  const m = Math.floor(total / 60)
  const s = total % 60
  return s ? `${m}min ${s}s` : `${m}min`
}

/** Tempo médio por visita (a soma do tempo visível dividida pelas visitas). */
export const avgTime = (timeMs: number, views: number) => (views > 0 ? timeMs / views : 0)

/** "2026-11-03" → "03/11/2026". */
export const brDate = (ymd: string) => ymd.split('-').reverse().join('/')

export const DEVICE_LABEL: Record<InsightDevice, string> = { mobile: 'Celular', tablet: 'Tablet', desktop: 'Computador' }
