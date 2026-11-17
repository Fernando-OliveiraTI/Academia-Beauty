import { mediaSrc } from '@academia/page-renderer'
import { fmtInt, fmtPct, initials, ratio, type Delta } from '@/lib/dashboard'

/**
 * Peças visuais dos painéis de números (Dashboard e Insights): ícones, indicador com minigráfico, cartão, barras de
 * ranking e barra de proporções. Extraídas do Dashboard sem mudança de aparência.
 */

export const ICONS = {
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.500 6.500 0 0 1 13 0" /><path d="M16 4.500a3.500 3.500 0 0 1 0 7M18 14.500a6.500 6.500 0 0 1 3.500 5.500" /></>,
  cart: <><path d="M3 4h2.500l2 11h10l2-8H7" /><circle cx="9" cy="19.500" r="1.200" /><circle cx="17" cy="19.500" r="1.200" /></>,
  star: <path d="m12 3 2.700 5.600 6.100.8-4.500 4.300 1.100 6.100L12 16.800 6.600 19.800l1.100-6.100L3.200 9.400l6.100-.8L12 3Z" />,
  book: <><path d="M4 5.500A2.500 2.500 0 0 1 6.500 3H20v15H6.500A2.500 2.500 0 0 0 4 20.500v-15Z" /><path d="M4 20.500A2.500 2.500 0 0 0 6.500 23H20" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.200 3 14.800 0 18M12 3c-3 3.200-3 14.800 0 18" /></>,
  bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12.500 3 3 5-6" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1" /><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></>,
  crown: <path d="m3 8 4.500 4L12 5l4.500 7L21 8l-2 11H5L3 8Z" />,
  user: <><circle cx="12" cy="8" r="3.500" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  db: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.700 3.600 3 8 3s8-1.300 8-3V6M4 12v6c0 1.700 3.600 3 8 3s8-1.300 8-3v-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  table: <><rect x="3.500" y="4" width="17" height="16" rx="2" /><path d="M3.500 10h17M9 10v10" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  calendar: <><rect x="3.500" y="5" width="17" height="15" rx="2" /><path d="M3.500 10h17M8 3v4M16 3v4" /></>,
} as const

export function Icon({ name, size = 20 }: { name: keyof typeof ICONS; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
}

export function DeltaChip({ d }: { d: Delta }) {
  const arrow = d.kind === 'up' ? '▲' : d.kind === 'down' ? '▼' : d.kind === 'new' ? '●' : '–'
  return <span className="kpi-delta" data-kind={d.kind}>{d.kind === 'none' ? null : <i aria-hidden="true">{arrow}</i>}{d.label}</span>
}

/** Linha mínima do cartão: forma da série, sem eixos nem rótulos (o número grande já diz o valor). */
export function Sparkline({ values }: { values: number[] }) {
  const w = 120, h = 40
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, h - 3 - (v / max) * (h - 8)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const flat = values.every((v) => v === 0)
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {flat ? <line x1="0" x2={w} y1={h - 3} y2={h - 3} className="kpi-spark-flat" /> : <><path d={`${d} L${w} ${h} L0 ${h} Z`} className="kpi-spark-area" /><path d={d} className="kpi-spark-line" /></>}
    </svg>
  )
}

export type Tone = 'gold' | 'purple' | 'orange' | 'green' | 'blue'

export function Kpi({ icon, label, value, chip, hint, spark, tone }: { icon: keyof typeof ICONS; label: string; value: string; chip?: Delta; hint?: string; spark?: number[]; tone: Tone }) {
  return (
    <article className="kpi" data-tone={tone}>
      <header><span className="kpi-icon"><Icon name={icon} /></span><h3>{label}</h3>{chip ? <DeltaChip d={chip} /> : null}</header>
      <p className="kpi-value">{value}</p>
      <footer>{hint ? <span>{hint}</span> : <span />}{spark ? <Sparkline values={spark} /> : null}</footer>
    </article>
  )
}

export function Card({ icon, title, subtitle, children, className = '', aside }: { icon: keyof typeof ICONS; title: string; subtitle?: string; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <section className={`dash-card ${className}`.trim()}>
      <header>
        <span className="dash-card-icon"><Icon name={icon} size={22} /></span>
        <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
        {aside ? <span className="dash-card-aside">{aside}</span> : null}
      </header>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="dash-empty">{children}</p>
}

/** Rótulo do período no cartão (o período em si é escolhido no topo da página). */
export const Period = ({ days }: { days: number }) => <span className="dash-period">Últimos {days} dias</span>

/** Barra horizontal de proporções (100%) com rótulos diretos: dispositivos e situação do catálogo. */
export function Split({ parts }: { parts: { label: string; value: number; shade: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (total === 0) return <Empty>Sem dados no período.</Empty>
  return (
    <div className="split">
      <div className="split-bar" role="img" aria-label={parts.map((p) => `${p.label} ${fmtPct(ratio(p.value, total))}`).join(', ')}>
        {parts.filter((p) => p.value > 0).map((p) => <span key={p.label} style={{ flexGrow: p.value, background: `var(--viz-seq-${p.shade})` }} />)}
      </div>
      <ul>
        {parts.map((p) => (
          <li key={p.label}><i style={{ background: `var(--viz-seq-${p.shade})` }} /><span>{p.label}</span><b>{fmtPct(ratio(p.value, total))}</b><em>{fmtInt(p.value)}</em></li>
        ))}
      </ul>
    </div>
  )
}

export function Avatar({ name, src }: { name: string; src?: string | null }) {
  return src
    ? <img className="avatar" src={mediaSrc(src, 96)} alt="" width={44} height={44} loading="lazy" />
    : <span className="avatar avatar-fallback" aria-hidden="true">{initials(name)}</span>
}

export function RankBars({ rows, total, avatar }: { rows: { key: string; label: string; value: number; note?: string; photo?: string | null }[]; total?: number; avatar?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ol className="rank">
      {rows.map((r, i) => (
        <li key={r.key}>
          <span className="rank-pos">{i + 1}</span>
          {avatar ? <Avatar name={r.label} src={r.photo} /> : null}
          <div className="rank-body">
            <div className="rank-top"><span>{r.label}</span><b>{fmtInt(r.value)}</b></div>
            <div className="rank-track"><span style={{ width: `${r.value > 0 ? Math.max(3, (r.value / max) * 100) : 0}%` }} /></div>
            {total !== undefined ? <small>{fmtPct(ratio(r.value, total))} do total</small> : r.note ? <small>{r.note}</small> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
