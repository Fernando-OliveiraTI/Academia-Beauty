import { createHash } from 'node:crypto'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import IpRateLimit from '#services/ip_rate_limit'

const LIMIT_PER_MINUTE = 90

/** `time`: tempo com a página visível desde o envio anterior (Insights, D-040). */
export const EVENT_KINDS = ['view', 'cta', 'checkout', 'time'] as const
export const RESOURCE_TYPES = ['home', 'professional', 'course'] as const
export type EventKind = (typeof EVENT_KINDS)[number]
export type ResourceType = (typeof RESOURCE_TYPES)[number]

const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|axios|node-fetch/i
const SLUG = /^[a-z0-9-]{3,80}$/
/** Tempo aceito por envio: abaixo de 1 s é ruído; acima de 30 min, aba esquecida aberta (vira o teto). */
const MIN_TIME_MS = 1000
const MAX_TIME_MS = 30 * 60 * 1000

export type TrackInput = {
  kind: string
  type: string
  slug?: string | null
  referrer?: string | null
  /** Só em `time`: milissegundos com a página visível. */
  durationMs?: number | null
  ip: string
  userAgent: string
}

function device(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet'
  if (/mobi|iphone|android/i.test(ua)) return 'mobile'
  return 'desktop'
}

/** Resumo diário e irreversível de IP + navegador: conta visitantes únicos sem guardar o IP nem criar cookie. */
function visitorHash(ip: string, ua: string, day: string) {
  return createHash('sha256')
    .update(`${env.get('APP_KEY')}|${day}|${ip}|${ua}`)
    .digest('hex')
    .slice(0, 20)
}

function referrerHost(raw: string | null | undefined, ownHost: string | null) {
  if (!raw) return null
  try {
    const host = new URL(raw).hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .slice(0, 80)
    return host && host !== ownHost ? host : null
  } catch {
    return null
  }
}

export default class TrackingService {
  /** Retorna `true` quando gravou; ignora bots, entradas inválidas e recursos inexistentes sem lançar erro. */
  static async record(input: TrackInput, ownHost: string | null = null): Promise<boolean> {
    if (!(EVENT_KINDS as readonly string[]).includes(input.kind)) return false
    if (!(RESOURCE_TYPES as readonly string[]).includes(input.type)) return false
    if (!input.userAgent || BOT.test(input.userAgent)) return false
    let durationMs: number | null = null
    if (input.kind === 'time') {
      const ms = Number(input.durationMs)
      if (!Number.isFinite(ms) || ms < MIN_TIME_MS) return false
      durationMs = Math.min(Math.round(ms), MAX_TIME_MS)
    }
    if (!(await IpRateLimit.allow('track', input.ip, LIMIT_PER_MINUTE))) return false

    let slug: string | null = null
    if (input.type !== 'home') {
      slug = input.slug ?? ''
      if (!SLUG.test(slug)) return false
      const table = input.type === 'course' ? 'courses' : 'professionals'
      const row = await db.from(table).where({ slug, status: 'published' }).select('id').first()
      if (!row) return false
    }

    const now = new Date()
    const day = now.toISOString().slice(0, 10)
    await db.table('page_events').insert({
      kind: input.kind,
      resource_type: input.type,
      resource_slug: slug,
      visitor_hash: visitorHash(input.ip, input.userAgent, day),
      device: device(input.userAgent),
      referrer_host: referrerHost(input.referrer, ownHost),
      duration_ms: durationMs,
      created_at: now,
    })
    return true
  }
}
