/** Formato devolvido por `GET /admin/dashboard` (ver `DashboardService.overview` na API). */
export type DashboardCounts = { views: number; visitors: number; cta: number; checkout: number }
export type DashboardDay = DashboardCounts & { date: string }
type StatusCounts = { draft: number; published: number; archived: number }

export type Dashboard = {
  range: { days: 7 | 30 | 90; from: string; to: string }
  totals: { current: DashboardCounts; previous: DashboardCounts }
  series: DashboardDay[]
  funnel: { views: number; cta: number; checkout: number }
  viewsByPage: { home: number; professional: number; course: number }
  devices: { device: string; total: number }[]
  sources: { host: string | null; total: number }[]
  topProfessionals: { slug: string; name: string; views: number; visitors: number; photo: string | null }[]
  topCourses: { slug: string; title: string; views: number; cta: number; checkout: number; status: string; professional: string | null; cover: string | null }[]
  catalog: { professionals: StatusCounts; courses: StatusCounts; publishedPages: number; homePublished: boolean }
  recent: { action: string; resourceType: string | null; resourceId: string | null; actor: string | null; item: string | null; at: string }[]
}

export const RANGES = [7, 30, 90] as const

const nf = new Intl.NumberFormat('pt-BR')
export const fmtInt = (n: number) => nf.format(Math.round(n))
/** 12.400 → "12,4 mil": só nos números grandes dos cartões, onde o espaço é curto. */
export const fmtCompact = (n: number) => (n >= 10_000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : fmtInt(n))
export const plural = (n: number, one: string, many: string) => `${fmtInt(n)} ${n === 1 ? one : many}`
export const fmtPct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

/** Razão em porcentagem; denominador zero não vira NaN nem infinito. */
export const ratio = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)

export type Delta = { kind: 'up' | 'down' | 'flat' | 'new' | 'none'; label: string }

/** Variação contra o período anterior de mesmo tamanho. */
export function delta(current: number, previous: number): Delta {
  if (current === 0 && previous === 0) return { kind: 'none', label: 'sem dados' }
  if (previous === 0) return { kind: 'new', label: 'novo' }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) return { kind: 'flat', label: '0%' }
  return { kind: pct > 0 ? 'up' : 'down', label: `${pct > 0 ? '+' : '−'}${Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%` }
}

/** "2026-10-17" → "17/10" sem passar por Date (evita deslocar o dia por fuso). */
export const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
/** "2026-10-17" → "17 de outubro de 2026" (sem Date, pelo mesmo motivo de `shortDate`). */
export const longDate = (iso: string) => `${Number(iso.slice(8, 10))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`

/** Iniciais para avatar sem foto: "Lukas Almeida" → "LA". */
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')

/** Teto "redondo" do eixo e suas divisões: 0, 25, 50, 75, 100... */
export function niceScale(max: number, steps = 4): { top: number; ticks: number[] } {
  if (max <= 0) return { top: steps, ticks: Array.from({ length: steps + 1 }, (_, i) => i) }
  // Contagens são inteiras: o menor degrau do eixo é 1 (sem rótulos repetidos como 1, 1, 1).
  const rough = Math.max(1, max / steps)
  const mag = 10 ** Math.floor(Math.log10(rough))
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((u) => u >= rough) ?? 10 * mag
  return { top: unit * steps, ticks: Array.from({ length: steps + 1 }, (_, i) => unit * i) }
}

const ACTIONS: Record<string, string> = {
  'professional.create': 'criou o profissional',
  'professional.update': 'atualizou o profissional',
  'professional.publish': 'publicou o profissional',
  'professional.duplicate': 'duplicou o profissional',
  'course.create': 'criou o curso',
  'course.update': 'atualizou o curso',
  'course.publish': 'publicou o curso',
  'course.duplicate': 'duplicou o curso',
  'course.commercial.update': 'ajustou a oferta do curso',
  'home.publish': 'publicou a Home',
  'media.upload': 'enviou uma mídia',
}
export const actionLabel = (action: string) => ACTIONS[action] ?? action

const DEVICES: Record<string, string> = { mobile: 'Celular', desktop: 'Computador', tablet: 'Tablet' }
export const deviceLabel = (d: string) => DEVICES[d] ?? d

/** "há 5 min", "há 3 h", "ontem" ou a data curta. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ontem'
  if (d < 7) return `há ${d} dias`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
