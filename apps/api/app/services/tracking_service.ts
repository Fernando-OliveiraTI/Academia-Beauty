import { createHash } from 'node:crypto'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'

export const EVENT_KINDS = ['view', 'cta', 'checkout'] as const
export const RESOURCE_TYPES = ['home', 'professional', 'course'] as const
export type EventKind = (typeof EVENT_KINDS)[number]
export type ResourceType = (typeof RESOURCE_TYPES)[number]

const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|axios|node-fetch/i
const SLUG = /^[a-z0-9-]{3,80}$/

export type TrackInput = {
  kind: string
  type: string
  slug?: string | null
  referrer?: string | null
  ip: string
  userAgent: string
}

/** Janela simples por IP em memória: coleta pública não pode virar vetor de enchente do banco. */
const hits = new Map<string, { count: number; reset: number }>()
const LIMIT = 90
const MAX_TRACKED_IPS = 5000
function allowed(ip: string, now = Date.now()) {
  const entry = hits.get(ip)
  if (!entry || entry.reset <= now) {
    if (hits.size >= MAX_TRACKED_IPS) {
      for (const [key, value] of hits) if (value.reset <= now) hits.delete(key)
      // Cheio de janelas ainda ativas: descarta o IP novo (a coleta é só métrica) em vez de zerar os limites de todos.
      if (hits.size >= MAX_TRACKED_IPS) return false
    }
    hits.set(ip, { count: 1, reset: now + 60_000 })
    return true
  }
  entry.count += 1
  return entry.count <= LIMIT
}
export const resetTrackingLimiter = () => hits.clear()

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
    if (!allowed(input.ip)) return false

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
      created_at: now,
    })
    return true
  }
}
