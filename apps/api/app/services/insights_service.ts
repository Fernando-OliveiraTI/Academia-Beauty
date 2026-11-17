import db from '@adonisjs/lucid/services/db'
import type { DatabaseQueryBuilderContract } from '@adonisjs/lucid/types/querybuilder'
import type {
  InsightDevice,
  InsightOrigin,
  Insights,
  InsightsCourseRow,
  InsightsDay,
  InsightsMetrics,
  InsightsQuery,
} from '@academia/contracts'
import { INSIGHT_DEVICES, INSIGHT_ORIGINS } from '@academia/contracts'
import PaymentEvent from '#models/payment_event'
import { summarizeTransactions } from '#services/payments_service'
import { DomainError } from '#services/domain_error'

/** Fuso de Brasília (sem horário de verão desde 2019): os dias dos filtros e da série seguem o calendário do Brasil. */
const OFFSET = '-03:00'
const DAY_SQL = `date_format(convert_tz(e.created_at, '+00:00', '${OFFSET}'), '%Y-%m-%d')`

/** Origem agrupada a partir do host do referenciador (o resto vira "outros"; sem referenciador, "direto"). */
const ORIGIN_SQL = `case
  when e.referrer_host is null then 'direto'
  when e.referrer_host like '%instagram%' then 'instagram'
  when e.referrer_host like '%facebook%' or e.referrer_host like 'fb.%' or e.referrer_host = 'm.me' then 'facebook'
  when e.referrer_host like '%google%' then 'google'
  when e.referrer_host like '%tiktok%' then 'tiktok'
  when e.referrer_host like '%youtube%' or e.referrer_host = 'youtu.be' then 'youtube'
  when e.referrer_host like '%whatsapp%' or e.referrer_host = 'wa.me' then 'whatsapp'
  else 'outros' end`

const num = (v: unknown) => Number(v ?? 0)
const zero = (): InsightsMetrics => ({
  views: 0,
  visitors: 0,
  cta: 0,
  checkout: 0,
  timeMs: 0,
  sales: 0,
  revenueCents: 0,
  refunds: 0,
  refundedCents: 0,
})

/** "2026-11-01" no fuso de Brasília → instante UTC do início do dia. */
const startOf = (day: string) => new Date(`${day}T00:00:00${OFFSET}`)
const nextDay = (day: string) => new Date(startOf(day).getTime() + 86_400_000)
const ymd = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)

export type InsightsViewer = { canSeeAll: boolean; professionalId: number | null }

/**
 * Área Insights (D-040): funil de cada curso — visitas, visitantes, tempo com a página visível, cliques em comprar,
 * checkout, vendas aprovadas (webhook) e reembolsos — com filtros de período, profissional, curso, aparelho e origem.
 * Quem não tem `insights.all` só enxerga o próprio profissional: o filtro é imposto aqui, não pela tela.
 */
export default class InsightsService {
  static async overview(query: InsightsQuery, viewer: InsightsViewer): Promise<Insights> {
    // Escopo: login de profissional fica preso ao profissional dele, seja qual for o filtro pedido.
    let professionalId = query.professionalId ?? null
    if (!viewer.canSeeAll) {
      if (!viewer.professionalId) {
        throw new DomainError(
          422,
          'no_professional',
          'Este login não está ligado a um profissional.'
        )
      }
      professionalId = viewer.professionalId
    }

    const courseRows = await db
      .from('courses as c')
      .join('professionals as p', 'p.id', 'c.professional_id')
      .if(professionalId, (q) => q.where('c.professional_id', professionalId!))
      .select(
        'c.id',
        'c.slug',
        'c.title',
        'c.status',
        'c.professional_id',
        'c.data',
        'p.name as professional_name',
        'p.slug as professional_slug'
      )
      .orderBy('c.title')
    if (query.courseId && !courseRows.some((c) => c.id === query.courseId)) {
      throw new DomainError(404, 'not_found', 'Curso não encontrado neste filtro.')
    }
    const scoped = query.courseId ? courseRows.filter((c) => c.id === query.courseId) : courseRows
    const slugs = scoped.map((c) => c.slug as string)
    const ids = scoped.map((c) => c.id as number)

    const from = startOf(query.from)
    const to = nextDay(query.to)
    const audience = (q: DatabaseQueryBuilderContract) => {
      if (query.device) q.where('e.device', query.device)
      if (query.origin) q.whereRaw(`${ORIGIN_SQL} = ?`, [query.origin])
      return q
    }
    const courseEvents = () =>
      audience(
        db
          .from('page_events as e')
          .where('e.resource_type', 'course')
          .whereIn('e.resource_slug', slugs.length ? slugs : ['__nenhum__'])
          .where('e.created_at', '>=', from)
          .where('e.created_at', '<', to)
      )
    const metricCols = [
      db.raw("coalesce(sum(e.kind = 'view'), 0) as views"),
      db.raw(
        "count(distinct case when e.kind = 'view' then concat(e.visitor_hash, ':', e.resource_slug) end) as visitors"
      ),
      db.raw("coalesce(sum(e.kind = 'cta'), 0) as cta"),
      db.raw("coalesce(sum(e.kind = 'checkout'), 0) as checkout"),
      db.raw("coalesce(sum(case when e.kind = 'time' then e.duration_ms end), 0) as time_ms"),
    ]

    const [
      perCourse,
      totalsRow,
      perDay,
      perDevice,
      perOrigin,
      proViews,
      firstTime,
      payments,
      options,
    ] = await Promise.all([
      courseEvents()
        .groupBy('e.resource_slug')
        .select('e.resource_slug as slug', ...metricCols),
      courseEvents()
        .select(
          db.raw("coalesce(sum(e.kind = 'view'), 0) as views"),
          // Visitante único por dia em qualquer curso do filtro (resumo anônimo diário).
          db.raw("count(distinct case when e.kind = 'view' then e.visitor_hash end) as visitors"),
          db.raw("coalesce(sum(e.kind = 'cta'), 0) as cta"),
          db.raw("coalesce(sum(e.kind = 'checkout'), 0) as checkout"),
          db.raw("coalesce(sum(case when e.kind = 'time' then e.duration_ms end), 0) as time_ms")
        )
        .first(),
      courseEvents()
        .groupByRaw(DAY_SQL)
        .select(
          db.raw(`${DAY_SQL} as day`),
          db.raw("coalesce(sum(e.kind = 'view'), 0) as views"),
          db.raw("count(distinct case when e.kind = 'view' then e.visitor_hash end) as visitors"),
          db.raw("coalesce(sum(e.kind = 'cta'), 0) as cta"),
          db.raw("coalesce(sum(e.kind = 'checkout'), 0) as checkout")
        ),
      courseEvents()
        .where('e.kind', 'view')
        .groupBy('e.device')
        .select('e.device', db.raw('count(*) as views')),
      courseEvents()
        .where('e.kind', 'view')
        .groupByRaw(ORIGIN_SQL)
        .select(db.raw(`${ORIGIN_SQL} as origin`), db.raw('count(*) as views')),
      // A página do profissional não tem curso: com filtro de curso, não se aplica.
      query.courseId
        ? Promise.resolve(null)
        : this.#professionalPageViews(professionalId, from, to, audience),
      db.from('page_events').where('kind', 'time').min('created_at as since').first(),
      ids.length
        ? PaymentEvent.query()
            .whereIn('course_id', ids)
            .where('kind', 'transaction')
            .where('occurred_at', '>=', from)
            .where('occurred_at', '<', to)
        : Promise.resolve([] as PaymentEvent[]),
      this.#options(viewer, professionalId),
    ])

    const professionalPageViews = num((proViews as { total?: unknown } | null)?.total)

    // Vendas por curso e por dia: a mesma regra do resto do painel (último evento define a situação; compra aprovada
    // continua compra depois do reembolso). A data da venda é a do evento de aprovação.
    const byCourse = new Map<number, PaymentEvent[]>()
    for (const e of payments) {
      if (e.courseId === null) continue
      const list = byCourse.get(e.courseId) ?? []
      list.push(e)
      byCourse.set(e.courseId, list)
    }
    const salesByDay = new Map<string, { sales: number; revenueCents: number }>()
    const approvedSeen = new Set<string>()
    for (const e of payments) {
      if (e.status !== 'approved') continue
      const key = e.externalTransactionId ?? `evt-${e.id}`
      if (approvedSeen.has(key)) continue
      approvedSeen.add(key)
      const day = ymd(e.occurredAt.toJSDate())
      const cur = salesByDay.get(day) ?? { sales: 0, revenueCents: 0 }
      cur.sales += 1
      cur.revenueCents += e.amountCents ?? 0
      salesByDay.set(day, cur)
    }

    const events = new Map(perCourse.map((r: Record<string, unknown>) => [r.slug as string, r]))
    const courses: InsightsCourseRow[] = scoped.map((c) => {
      const ev = events.get(c.slug) ?? {}
      const pay = summarizeTransactions(byCourse.get(c.id) ?? [])
      const data = (typeof c.data === 'string' ? JSON.parse(c.data) : c.data) ?? {}
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        status: c.status,
        professionalId: c.professional_id,
        professionalName: c.professional_name,
        coverSrc: typeof data.coverSrc === 'string' ? data.coverSrc : '',
        views: num(ev.views),
        visitors: num(ev.visitors),
        cta: num(ev.cta),
        checkout: num(ev.checkout),
        timeMs: num(ev.time_ms),
        sales: pay.purchased,
        revenueCents: pay.purchasedCents,
        refunds: pay.refunded,
        refundedCents: pay.refundedCents,
      }
    })

    const totals = zero()
    totals.views = num(totalsRow?.views)
    totals.visitors = num(totalsRow?.visitors)
    totals.cta = num(totalsRow?.cta)
    totals.checkout = num(totalsRow?.checkout)
    totals.timeMs = num(totalsRow?.time_ms)
    for (const c of courses) {
      totals.sales += c.sales
      totals.revenueCents += c.revenueCents
      totals.refunds += c.refunds
      totals.refundedCents += c.refundedCents
    }

    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
    const dayRows = new Map(perDay.map((r: Record<string, unknown>) => [String(r.day), r]))
    const series: InsightsDay[] = []
    for (let i = 0; i < days; i += 1) {
      const date = ymd(new Date(from.getTime() + i * 86_400_000 + 3 * 3_600_000))
      const r = dayRows.get(date) ?? {}
      const s = salesByDay.get(date)
      series.push({
        date,
        views: num(r.views),
        visitors: num(r.visitors),
        cta: num(r.cta),
        checkout: num(r.checkout),
        sales: s?.sales ?? 0,
        revenueCents: s?.revenueCents ?? 0,
      })
    }

    const deviceMap = new Map(
      perDevice.map((r: Record<string, unknown>) => [String(r.device), num(r.views)])
    )
    const originMap = new Map(
      perOrigin.map((r: Record<string, unknown>) => [String(r.origin), num(r.views)])
    )
    const since = (firstTime as { since?: unknown } | null)?.since

    return {
      range: { from: query.from, to: query.to, days },
      scope: {
        professionalId,
        courseId: query.courseId ?? null,
        device: query.device ?? null,
        origin: query.origin ?? null,
        restricted: !viewer.canSeeAll,
      },
      totals,
      professionalPageViews,
      // Arquivado só aparece se teve atividade no período (os totais já contam tudo do filtro).
      courses: courses
        .filter(
          (c) =>
            c.status !== 'archived' ||
            c.views + c.cta + c.checkout + c.timeMs + c.sales + c.refunds > 0
        )
        .sort((a, b) => b.views - a.views || b.sales - a.sales || a.title.localeCompare(b.title)),
      series,
      devices: INSIGHT_DEVICES.map((device: InsightDevice) => ({
        device,
        views: deviceMap.get(device) ?? 0,
      })),
      origins: INSIGHT_ORIGINS.map((origin: InsightOrigin) => ({
        origin,
        views: originMap.get(origin) ?? 0,
      }))
        .filter((o) => o.views > 0)
        .sort((a, b) => b.views - a.views),
      salesIgnoreAudience: Boolean(query.device || query.origin),
      options,
      timeTrackingSince: since ? new Date(since as string).toISOString() : null,
    }
  }

  /** Visitas à página do profissional filtrado (ou de todos, sem filtro). */
  static async #professionalPageViews(
    professionalId: number | null,
    from: Date,
    to: Date,
    audience: (q: DatabaseQueryBuilderContract) => DatabaseQueryBuilderContract
  ) {
    const pro = professionalId
      ? await db.from('professionals').where('id', professionalId).select('slug').first()
      : null
    if (professionalId && !pro) return { total: 0 }
    return audience(
      db
        .from('page_events as e')
        .where('e.resource_type', 'professional')
        .where('e.kind', 'view')
        .if(pro, (q) => q.where('e.resource_slug', pro!.slug))
        .where('e.created_at', '>=', from)
        .where('e.created_at', '<', to)
    )
      .count('* as total')
      .first()
  }

  /** Opções dos filtros dentro do que o login pode ver (profissional preso ao dele). */
  static async #options(viewer: InsightsViewer, professionalId: number | null) {
    const pros = await db
      .from('professionals')
      .whereNot('status', 'archived')
      .if(!viewer.canSeeAll, (q) => q.where('id', viewer.professionalId ?? 0))
      .orderBy('name')
      .select('id', 'name', 'data')
    const courses = await db
      .from('courses')
      .whereNot('status', 'archived')
      .if(professionalId, (q) => q.where('professional_id', professionalId!))
      .orderBy('title')
      .select('id', 'title', 'professional_id')
    return {
      professionals: pros.map((p) => {
        const data = (typeof p.data === 'string' ? JSON.parse(p.data) : p.data) ?? {}
        return {
          id: p.id,
          name: p.name,
          specialty: data.specialty ?? '',
          photo: data.cardPhotoSrc || data.portraitSrc || '',
        }
      }),
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        professionalId: c.professional_id,
      })),
    }
  }
}
