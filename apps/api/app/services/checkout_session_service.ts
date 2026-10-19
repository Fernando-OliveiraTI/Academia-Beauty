import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import CheckoutSession from '#models/checkout_session'
import Course from '#models/course'
import PaymentEvent from '#models/payment_event'
import { REF_PATTERN } from '#services/themembers_webhook_service'
import { parseUserAgent } from '#services/user_agent'

type Headers = Record<string, string | string[] | undefined>

const MAX_ROWS = 50_000

/* ------------------------------- higiene dos dados ------------------------------ */

/** Texto curto sem caracteres de controle; vazio vira `null`. */
export function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  // Sem regex com caracteres de controle: descarta por código (o lint proíbe `\u0000` em expressão regular).
  const text = [...value]
    .filter((ch) => {
      const code = ch.codePointAt(0)!
      return code > 0x1f && code !== 0x7f
    })
    .join('')
    .trim()
    .slice(0, max)
  return text || null
}

const intIn = (value: unknown, min: number, max: number): number | null => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

/** IPv4 /24 e IPv6 /48 (a rede, sem identificar o aparelho). */
export function truncateIp(ip: string): string {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip)
  if (mapped) return truncateIp(mapped[1]!)
  if (ip.includes(':')) {
    const groups = ip.replace(/^::ffff:/i, '').split(':')
    return `${groups.slice(0, 3).join(':')}::`
  }
  const parts = ip.split('.')
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : ip
}

export function applyIpMode(
  ip: string | null | undefined,
  mode: 'full' | 'truncated' | 'none' = 'full'
): string | null {
  if (!ip || mode === 'none') return null
  return (mode === 'truncated' ? truncateIp(ip) : ip).slice(0, 45)
}

const header = (headers: Headers, name: string): string | undefined => {
  const value = headers[name]
  return Array.isArray(value) ? value[0] : value
}

const decode = (value: string | undefined): string | null => {
  if (!value) return null
  try {
    return clean(decodeURIComponent(value), 80)
  } catch {
    return clean(value, 80)
  }
}

/**
 * Localização aproximada vinda da CDN/proxy que fica na frente do site (Cloudflare, Vercel, CloudFront). Sem esses
 * cabeçalhos não há cidade: não consultamos serviços de terceiros com o IP do visitante. Os cabeçalhos são informados pela
 * borda; quem chamar a API direto pode forjá-los (serve para análise, não para decisão de segurança).
 */
export function geoFromHeaders(headers: Headers): {
  country: string | null
  region: string | null
  city: string | null
} {
  const rawCountry = (
    header(headers, 'cf-ipcountry') ??
    header(headers, 'x-vercel-ip-country') ??
    header(headers, 'cloudfront-viewer-country') ??
    ''
  ).toUpperCase()
  const country =
    /^[A-Z]{2}$/.test(rawCountry) && !['XX', 'T1'].includes(rawCountry) ? rawCountry : null
  const region = decode(
    header(headers, 'cf-region') ??
      header(headers, 'x-vercel-ip-country-region') ??
      header(headers, 'cloudfront-viewer-country-region-name')
  )
  const city = decode(
    header(headers, 'cf-ipcity') ??
      header(headers, 'x-vercel-ip-city') ??
      header(headers, 'cloudfront-viewer-city')
  )
  return { country, region, city }
}

const hostOf = (value: unknown): string | null => {
  const text = clean(value, 300)
  if (!text) return null
  try {
    return new URL(text).hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .slice(0, 80)
  } catch {
    return null
  }
}

const pathOf = (value: unknown): string | null => {
  const text = clean(value, 300)
  if (!text) return null
  const path = text.split(/[?#]/)[0]!
  return path.startsWith('/') ? path.slice(0, 200) : null
}

/* --------------------------------- registro --------------------------------- */

export type RegisterInput = {
  ref: unknown
  body: Record<string, unknown>
  ip: string | null
  headers: Headers
}

export function sessionsEnabled(): boolean {
  return env.get('CHECKOUT_SESSIONS_ENABLED') !== false
}
export function retentionDays(): number {
  const raw = Number(env.get('CHECKOUT_SESSIONS_RETENTION_DAYS') ?? 180)
  return Number.isFinite(raw) && raw >= 1 ? Math.min(raw, 730) : 180
}

export default class CheckoutSessionService {
  /** Cria a visita ou, se o código já existe (mesma aba recarregou), só marca nova visita. Erros de dados viram `null`. */
  static async register(
    input: RegisterInput
  ): Promise<'created' | 'updated' | 'disabled' | 'invalid'> {
    if (!sessionsEnabled()) return 'disabled'
    const ref = typeof input.ref === 'string' ? input.ref.toLowerCase() : ''
    if (!REF_PATTERN.test(ref)) return 'invalid'

    const body = input.body
    const slug = clean(body.slug, 80)
    const course = slug && /^[a-z0-9-]{3,80}$/.test(slug) ? await Course.findBy('slug', slug) : null
    const agent = parseUserAgent(header(input.headers, 'user-agent'))
    const geo = geoFromHeaders(input.headers)
    const utm = (typeof body.utm === 'object' && body.utm !== null ? body.utm : {}) as Record<
      string,
      unknown
    >
    const viewport = (
      typeof body.viewport === 'object' && body.viewport !== null ? body.viewport : {}
    ) as Record<string, unknown>
    const language =
      clean(body.language, 20) ?? clean(header(input.headers, 'accept-language')?.split(',')[0], 20)
    const timezone = clean(body.timezone, 60)
    const now = DateTime.utc()

    const existing = await CheckoutSession.findBy('ref', ref)
    if (existing) {
      existing.visits += 1
      existing.lastSeenAt = now
      await existing.save()
      return 'updated'
    }

    try {
      await CheckoutSession.create({
        ref,
        courseSlug: course ? course.slug : null,
        courseId: course?.id ?? null,
        ip: applyIpMode(input.ip, env.get('CHECKOUT_SESSIONS_IP_MODE') ?? 'full'),
        country: geo.country,
        region: geo.region,
        city: geo.city,
        userAgent: clean(header(input.headers, 'user-agent'), 400),
        browser: agent.browser,
        browserVersion: agent.browserVersion,
        os: agent.os,
        osVersion: agent.osVersion,
        device: agent.device,
        inApp: agent.inApp,
        language:
          language && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language) ? language : null,
        timezone: timezone && /^[A-Za-z0-9_/+-]{1,60}$/.test(timezone) ? timezone : null,
        viewportW: intIn(viewport.w, 1, 10_000),
        viewportH: intIn(viewport.h, 1, 10_000),
        referrerHost: hostOf(body.referrer),
        landingPath: pathOf(body.landing),
        utmSource: clean(utm.source, 80),
        utmMedium: clean(utm.medium, 80),
        utmCampaign: clean(utm.campaign, 120),
        utmContent: clean(utm.content, 120),
        utmTerm: clean(utm.term, 120),
        hasClickId: body.clickId === true,
        visits: 1,
        createdAt: now,
        lastSeenAt: now,
      })
    } catch (error) {
      // Duas aberturas simultâneas da mesma aba: a segunda perde a corrida e vale como nova visita.
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return 'updated'
      throw error
    }
    await CheckoutSessionService.purge(now)
    return 'created'
  }

  /** Apaga o que passou da retenção e o excedente de linhas (limpeza barata, feita junto da gravação). */
  static async purge(now: DateTime = DateTime.utc()): Promise<void> {
    const cutoff = now.minus({ days: retentionDays() }).toSQL({ includeOffset: false })!
    await CheckoutSession.query().where('created_at', '<', cutoff).delete()
    const newest = await CheckoutSession.query().orderBy('id', 'desc').offset(MAX_ROWS).first()
    if (newest) await CheckoutSession.query().where('id', '<=', newest.id).delete()
  }
}

/* ------------------------- consulta (painel do administrador) ------------------------- */

export type PaymentState = 'paid' | 'pending' | 'failed' | 'none'
const PAID = new Set(['approved', 'completed'])
const PENDING = new Set(['pending', 'processing'])

export const stateOf = (status: string | null | undefined): PaymentState =>
  !status ? 'none' : PAID.has(status) ? 'paid' : PENDING.has(status) ? 'pending' : 'failed'

export type LatestByRef = Map<string, { event: PaymentEvent; count: number }>

/** O evento mais recente de cada código (por data do evento e, no empate, o último recebido). */
export async function latestEventsByRef(refs?: string[]): Promise<LatestByRef> {
  const query = PaymentEvent.query()
    .whereNotNull('ref')
    .whereIn('kind', ['transaction', 'order'])
    .orderBy('occurred_at', 'asc')
    .orderBy('id', 'asc')
  if (refs) query.whereIn('ref', refs.length ? refs : [''])
  const out: LatestByRef = new Map()
  for (const event of await query) {
    const key = event.ref!
    out.set(key, { event, count: (out.get(key)?.count ?? 0) + 1 })
  }
  return out
}

export async function deliveryIdFor(paymentEventId: number): Promise<number | null> {
  const row = await db
    .from('webhook_deliveries')
    .where('payment_event_id', paymentEventId)
    .orderBy('id', 'desc')
    .select('id')
    .first()
  return row ? Number(row.id) : null
}
