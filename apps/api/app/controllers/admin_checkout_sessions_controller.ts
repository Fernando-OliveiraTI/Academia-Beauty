import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import CheckoutSession from '#models/checkout_session'
import Course from '#models/course'
import {
  deliveryIdFor,
  latestEventsByRef,
  ipMode,
  retentionDays,
  sessionsEnabled,
  stateOf,
  type LatestByRef,
  type PaymentState,
} from '#services/checkout_session_service'

const PER_PAGES = [10, 20, 50]
const DEFAULT_PER_PAGE = 20
const STATES: PaymentState[] = ['paid', 'pending', 'failed', 'none']

const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

const paymentView = (latest: LatestByRef, ref: string, deliveryId?: number | null) => {
  const found = latest.get(ref)
  if (!found) return null
  const e = found.event
  return {
    state: stateOf(e.status),
    status: e.status,
    event: e.event,
    method: e.paymentMethod,
    amountCents: e.amountCents,
    currency: e.currency,
    instalments: e.instalments,
    cardBrand: e.cardBrand,
    buyerName: e.buyerName,
    buyerEmail: e.buyerEmail,
    occurredAt: e.occurredAt.toUTC().toISO(),
    events: found.count,
    paymentEventId: e.id,
    deliveryId: deliveryId ?? null,
  }
}

const sessionView = (s: CheckoutSession, titles: Map<number, string>) => ({
  id: s.id,
  ref: s.ref,
  courseSlug: s.courseSlug,
  courseTitle: s.courseId ? (titles.get(s.courseId) ?? null) : null,
  createdAt: s.createdAt.toUTC().toISO(),
  lastSeenAt: s.lastSeenAt.toUTC().toISO(),
  visits: s.visits,
  ip: s.ip,
  country: s.country,
  region: s.region,
  city: s.city,
  browser: s.browser,
  browserVersion: s.browserVersion,
  os: s.os,
  osVersion: s.osVersion,
  device: s.device,
  inApp: s.inApp,
  language: s.language,
  timezone: s.timezone,
  viewport: s.viewportW && s.viewportH ? { w: s.viewportW, h: s.viewportH } : null,
  referrerHost: s.referrerHost,
  landingPath: s.landingPath,
  utm: {
    source: s.utmSource,
    medium: s.utmMedium,
    campaign: s.utmCampaign,
    content: s.utmContent,
    term: s.utmTerm,
  },
  hasClickId: s.hasClickId,
})

async function titlesFor(sessions: CheckoutSession[]): Promise<Map<number, string>> {
  const ids = [...new Set(sessions.map((s) => s.courseId).filter((v): v is number => v !== null))]
  if (!ids.length) return new Map()
  const courses = await Course.query().whereIn('id', ids).select('id', 'title')
  return new Map(courses.map((c) => [c.id, c.title]))
}

type Counter = Map<string, number>
const bump = (counter: Counter, key: string | null | undefined) => {
  if (!key) return
  counter.set(key, (counter.get(key) ?? 0) + 1)
}
const top = (counter: Counter, limit = 6) =>
  [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))

/** Visitas ao checkout e o pagamento ligado a cada uma pelo código (`users.manage`: traz IP e dados de navegação). */
export default class AdminCheckoutSessionsController {
  async index({ request }: HttpContext) {
    const qs = request.qs()
    const state = String(qs.state ?? '')
    const q = String(qs.q ?? '')
      .trim()
      .slice(0, 80)
    const page = Math.max(1, Number.parseInt(String(qs.page ?? '1'), 10) || 1)
    const asked = Number.parseInt(String(qs.perPage ?? ''), 10)
    const perPage = PER_PAGES.includes(asked) ? asked : DEFAULT_PER_PAGE

    const latestAll = await latestEventsByRef()
    const refsByState: Record<PaymentState, string[]> = {
      paid: [],
      pending: [],
      failed: [],
      none: [],
    }
    for (const [ref, { event }] of latestAll) refsByState[stateOf(event.status)].push(ref)
    const linkedRefs = [...latestAll.keys()]

    const filtered = () => {
      const query = CheckoutSession.query()
      if (STATES.includes(state as PaymentState)) {
        if (state === 'none') {
          if (linkedRefs.length) query.whereNotIn('ref', linkedRefs)
        } else
          query.whereIn(
            'ref',
            refsByState[state as PaymentState].length ? refsByState[state as PaymentState] : ['']
          )
      }
      if (q) {
        const like = `%${likeEscape(q)}%`
        query.where((sub) => {
          for (const column of [
            'ref',
            'ip',
            'city',
            'region',
            'country',
            'browser',
            'os',
            'device',
            'in_app',
            'utm_source',
            'utm_campaign',
            'referrer_host',
            'course_slug',
          ]) {
            sub.orWhere(column, 'like', like)
          }
        })
      }
      return query
    }

    const rows = await filtered()
      .orderBy('id', String(qs.sort) === 'oldest' ? 'asc' : 'desc')
      .offset((page - 1) * perPage)
      .limit(perPage)
    const totalRow = await filtered().count('* as n').first()
    const allCount = await CheckoutSession.query().count('* as n').first()
    const latest = await latestEventsByRef(rows.map((r) => r.ref))
    const titles = await titlesFor(rows)

    const total = (row: typeof totalRow) =>
      Number((row?.$extras as { n?: number | string } | undefined)?.n ?? 0)
    const all = total(allCount)
    // As abas contam só visitas que existem (um pagamento com código que nunca abriu a página não entra).
    const countState = async (refs: string[]) =>
      refs.length
        ? total(await CheckoutSession.query().whereIn('ref', refs).count('* as n').first())
        : 0
    const [paid, pending, failed, linkedSessions] = await Promise.all([
      countState(refsByState.paid),
      countState(refsByState.pending),
      countState(refsByState.failed),
      countState(linkedRefs),
    ])
    return {
      items: rows.map((s) => ({ ...sessionView(s, titles), payment: paymentView(latest, s.ref) })),
      total: total(totalRow),
      page,
      perPage,
      counts: { all, paid, pending, failed, none: Math.max(0, all - linkedSessions) },
      enabled: sessionsEnabled(),
      ipMode: ipMode(),
      retentionDays: retentionDays(),
    }
  }

  async show({ params, response }: HttpContext) {
    const session = await CheckoutSession.find(params.id)
    if (!session) return response.notFound({ message: 'Visita não encontrada' })
    const latest = await latestEventsByRef([session.ref])
    const titles = await titlesFor([session])
    const found = latest.get(session.ref)
    const deliveryId = found ? await deliveryIdFor(found.event.id) : null
    return {
      ...sessionView(session, titles),
      payment: paymentView(latest, session.ref, deliveryId),
    }
  }

  /** Perfil do público no período: aparelho, navegador, sistema, cidade, origem e conversão. */
  async insights({ request }: HttpContext) {
    const asked = Number.parseInt(String(request.qs().days ?? '30'), 10)
    const days = [7, 30, 90].includes(asked) ? asked : 30
    const since = DateTime.utc().minus({ days })
    const sessions = await CheckoutSession.query()
      .where('created_at', '>=', since.toSQL({ includeOffset: false })!)
      .limit(20_000)
    const latest = await latestEventsByRef(sessions.map((s) => s.ref))

    const device: Counter = new Map()
    const browser: Counter = new Map()
    const os: Counter = new Map()
    const city: Counter = new Map()
    const country: Counter = new Map()
    const source: Counter = new Map()
    const language: Counter = new Map()
    const hours = Array.from({ length: 24 }, () => 0)
    const byDay = new Map<string, { sessions: number; paid: number }>()
    for (let i = days - 1; i >= 0; i--)
      byDay.set(DateTime.utc().minus({ days: i }).toISODate()!, { sessions: 0, paid: 0 })
    let paid = 0
    let paidCents = 0
    let withPayment = 0

    for (const s of sessions) {
      bump(device, s.device)
      bump(browser, s.inApp ? `${s.inApp} (app)` : s.browser)
      bump(os, s.os)
      bump(city, s.city ? `${s.city}${s.region ? ` · ${s.region}` : ''}` : null)
      bump(country, s.country)
      bump(source, s.utmSource ? s.utmSource : s.referrerHost ? s.referrerHost : 'direto')
      bump(language, s.language?.split('-')[0])
      hours[s.createdAt.toUTC().hour]!++
      const day = byDay.get(s.createdAt.toUTC().toISODate()!)
      if (day) day.sessions++
      const found = latest.get(s.ref)
      if (found) withPayment++
      if (found && stateOf(found.event.status) === 'paid') {
        paid++
        paidCents += found.event.amountCents ?? 0
        if (day) day.paid++
      }
    }
    return {
      days,
      sessions: sessions.length,
      withPayment,
      paid,
      paidCents,
      conversionPct: sessions.length ? Math.round((paid / sessions.length) * 1000) / 10 : 0,
      device: top(device),
      browser: top(browser),
      os: top(os),
      city: top(city),
      country: top(country),
      source: top(source),
      language: top(language),
      hoursUtc: hours,
      byDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    }
  }
}
