import db from '@adonisjs/lucid/services/db'

export const DASHBOARD_RANGES = [7, 30, 90] as const
export type DashboardRange = (typeof DASHBOARD_RANGES)[number]

type Counts = { views: number; visitors: number; cta: number; checkout: number }
type Status = { draft: number; published: number; archived: number }

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const num = (v: unknown) => Number(v ?? 0)

/** Eventos do período [from, to) já filtrados. */
const inRange = (from: Date, to: Date, alias = 'page_events') =>
  db
    .from(alias === 'page_events' ? 'page_events' : `page_events as ${alias}`)
    .where(`${alias}.created_at`, '>=', from)
    .where(`${alias}.created_at`, '<', to)

async function totals(from: Date, to: Date): Promise<Counts> {
  const row = await inRange(from, to)
    .select(
      db.raw("coalesce(sum(kind = 'view'), 0) as views"),
      db.raw("count(distinct case when kind = 'view' then visitor_hash end) as visitors"),
      db.raw("coalesce(sum(kind = 'cta'), 0) as cta"),
      db.raw("coalesce(sum(kind = 'checkout'), 0) as checkout")
    )
    .first()
  return {
    views: num(row?.views),
    visitors: num(row?.visitors),
    cta: num(row?.cta),
    checkout: num(row?.checkout),
  }
}

async function statusCounts(table: 'professionals' | 'courses'): Promise<Status> {
  const rows = await db.from(table).groupBy('status').select('status', db.raw('count(*) as total'))
  const out: Status = { draft: 0, published: 0, archived: 0 }
  for (const r of rows) if (r.status in out) out[r.status as keyof Status] = num(r.total)
  return out
}

const RECENT_ACTIONS = [
  'professional.create',
  'professional.publish',
  'professional.update',
  'professional.duplicate',
  'course.create',
  'course.publish',
  'course.update',
  'course.duplicate',
  'course.commercial.update',
  'home.publish',
  'media.upload',
]

export default class DashboardService {
  static async overview(days: DashboardRange, now = new Date()) {
    const to = addDays(startOfDay(now), 1)
    const from = addDays(to, -days)
    const prevFrom = addDays(from, -days)

    const [
      current,
      previous,
      courseFunnel,
      daily,
      byType,
      devices,
      sources,
      topPro,
      topCourse,
      professionals,
      courses,
      home,
      recent,
    ] = await Promise.all([
      totals(from, to),
      totals(prevFrom, from),
      inRange(from, to)
        .where('resource_type', 'course')
        .select(
          db.raw("coalesce(sum(kind = 'view'), 0) as views"),
          db.raw("coalesce(sum(kind = 'cta'), 0) as cta"),
          db.raw("coalesce(sum(kind = 'checkout'), 0) as checkout")
        )
        .first(),
      inRange(from, to)
        .groupByRaw("date_format(created_at, '%Y-%m-%d')")
        .select(
          db.raw("date_format(created_at, '%Y-%m-%d') as day"),
          db.raw("coalesce(sum(kind = 'view'), 0) as views"),
          db.raw("count(distinct case when kind = 'view' then visitor_hash end) as visitors"),
          db.raw("coalesce(sum(kind = 'cta'), 0) as cta"),
          db.raw("coalesce(sum(kind = 'checkout'), 0) as checkout")
        ),
      inRange(from, to)
        .where('kind', 'view')
        .groupBy('resource_type')
        .select('resource_type', db.raw('count(*) as total')),
      inRange(from, to)
        .where('kind', 'view')
        .groupBy('device')
        .select('device', db.raw('count(*) as total')),
      inRange(from, to)
        .where('kind', 'view')
        .groupByRaw("coalesce(referrer_host, '')")
        .select(db.raw("coalesce(referrer_host, '') as host"), db.raw('count(*) as total'))
        .orderBy('total', 'desc')
        .limit(6),
      inRange(from, to, 'e')
        .join('professionals as p', 'p.slug', 'e.resource_slug')
        .where('e.resource_type', 'professional')
        .where('e.kind', 'view')
        .groupBy('p.slug', 'p.name')
        .select(
          'p.slug',
          'p.name',
          db.raw('count(*) as views'),
          db.raw('count(distinct e.visitor_hash) as visitors')
        )
        .orderBy('views', 'desc')
        .limit(5),
      inRange(from, to, 'e')
        .join('courses as c', 'c.slug', 'e.resource_slug')
        .where('e.resource_type', 'course')
        .groupBy('c.slug', 'c.title')
        .select(
          'c.slug',
          'c.title',
          db.raw("coalesce(sum(e.kind = 'view'), 0) as views"),
          db.raw("coalesce(sum(e.kind = 'cta'), 0) as cta"),
          db.raw("coalesce(sum(e.kind = 'checkout'), 0) as checkout")
        )
        .orderBy('views', 'desc')
        .limit(5),
      statusCounts('professionals'),
      statusCounts('courses'),
      db.from('home_pages').where('id', 1).select('status').first(),
      db
        .from('audit_logs as a')
        .leftJoin('users as u', 'u.id', 'a.actor_id')
        .whereIn('a.action', RECENT_ACTIONS)
        .select(
          'a.action',
          'a.resource_type',
          'a.resource_id',
          'a.created_at',
          'u.full_name',
          'u.email'
        )
        .orderBy('a.id', 'desc')
        .limit(5),
    ])

    // Dados de apresentação (foto, capa, status, nome do item) buscados à parte: o agrupamento acima fica só nas métricas.
    const proSlugs = topPro.map((r) => String(r.slug))
    const courseSlugs = topCourse.map((r) => String(r.slug))
    const idsOf = (type: string) =>
      recent
        .filter((r) => r.resource_type === type && r.resource_id)
        .map((r) => Number(r.resource_id))
    const recentPro = idsOf('professional')
    const recentCourse = idsOf('course')
    const [proInfo, courseInfo, recentProNames, recentCourseNames] = await Promise.all([
      proSlugs.length
        ? db
            .from('professionals')
            .whereIn('slug', proSlugs)
            .select('slug', db.raw("json_unquote(json_extract(data, '$.portraitSrc')) as photo"))
        : [],
      courseSlugs.length
        ? db
            .from('courses as c')
            .join('professionals as p', 'p.id', 'c.professional_id')
            .whereIn('c.slug', courseSlugs)
            .select(
              'c.slug',
              'c.status',
              'p.name as professional',
              db.raw("json_unquote(json_extract(c.data, '$.coverSrc')) as cover")
            )
        : [],
      recentPro.length
        ? db.from('professionals').whereIn('id', recentPro).select('id', 'name')
        : [],
      recentCourse.length
        ? db.from('courses').whereIn('id', recentCourse).select('id', 'title')
        : [],
    ])
    const photoBySlug = new Map(
      proInfo.map((r) => [String(r.slug), r.photo ? String(r.photo) : null])
    )
    const courseBySlug = new Map(courseInfo.map((r) => [String(r.slug), r]))
    const itemName = (type: string | null, id: string | null) => {
      if (type === 'home') return 'Home'
      if (!id) return null
      const rows =
        type === 'professional' ? recentProNames : type === 'course' ? recentCourseNames : []
      const row = rows.find((x) => String(x.id) === id)
      return row ? String(type === 'professional' ? row.name : row.title) : null
    }

    const byDay = new Map(daily.map((r) => [String(r.day), r]))
    const series = Array.from({ length: days }, (_, i) => {
      const date = ymd(addDays(from, i))
      const r = byDay.get(date)
      return {
        date,
        views: num(r?.views),
        visitors: num(r?.visitors),
        cta: num(r?.cta),
        checkout: num(r?.checkout),
      }
    })

    const viewsByPage = { home: 0, professional: 0, course: 0 }
    for (const r of byType)
      if (r.resource_type in viewsByPage)
        viewsByPage[r.resource_type as keyof typeof viewsByPage] = num(r.total)

    const homePublished = home?.status === 'published'
    return {
      range: { days, from: ymd(from), to: ymd(addDays(to, -1)) },
      totals: { current, previous },
      series,
      // Funil só das páginas de curso: é onde a compra acontece.
      funnel: {
        views: num(courseFunnel?.views),
        cta: num(courseFunnel?.cta),
        checkout: num(courseFunnel?.checkout),
      },
      viewsByPage,
      devices: devices.map((r) => ({ device: String(r.device), total: num(r.total) })),
      sources: sources.map((r) => ({ host: String(r.host) || null, total: num(r.total) })),
      topProfessionals: topPro.map((r) => ({
        slug: String(r.slug),
        name: String(r.name),
        views: num(r.views),
        visitors: num(r.visitors),
        photo: photoBySlug.get(String(r.slug)) ?? null,
      })),
      topCourses: topCourse.map((r) => ({
        slug: String(r.slug),
        title: String(r.title),
        views: num(r.views),
        cta: num(r.cta),
        checkout: num(r.checkout),
        status: String(courseBySlug.get(String(r.slug))?.status ?? 'draft'),
        professional: courseBySlug.get(String(r.slug))?.professional
          ? String(courseBySlug.get(String(r.slug))?.professional)
          : null,
        cover: courseBySlug.get(String(r.slug))?.cover
          ? String(courseBySlug.get(String(r.slug))?.cover)
          : null,
      })),
      catalog: {
        professionals,
        courses,
        publishedPages: professionals.published + courses.published + (homePublished ? 1 : 0),
        homePublished,
      },
      recent: recent.map((r) => ({
        action: String(r.action),
        resourceType: r.resource_type ? String(r.resource_type) : null,
        resourceId: r.resource_id ? String(r.resource_id) : null,
        item: itemName(
          r.resource_type ? String(r.resource_type) : null,
          r.resource_id ? String(r.resource_id) : null
        ),
        actor: r.full_name ? String(r.full_name) : r.email ? String(r.email) : null,
        at: new Date(r.created_at).toISOString(),
      })),
    }
  }
}
