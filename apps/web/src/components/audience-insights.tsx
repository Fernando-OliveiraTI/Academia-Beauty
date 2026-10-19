import Link from 'next/link'
import { DEVICE_LABEL, countryName, money } from '@/lib/checkout-labels'
import { HoursBars } from './hours-bars'

export type Insights = {
  days: number
  sessions: number
  withPayment: number
  paid: number
  paidCents: number
  conversionPct: number
  device: { label: string; count: number }[]
  browser: { label: string; count: number }[]
  os: { label: string; count: number }[]
  city: { label: string; count: number }[]
  country: { label: string; count: number }[]
  source: { label: string; count: number }[]
  language: { label: string; count: number }[]
  hoursUtc: number[]
  byDay: { date: string; sessions: number; paid: number }[]
}

function BarList({ title, rows, total, map }: { title: string; rows: { label: string; count: number }[]; total: number; map?: (label: string) => string }) {
  return (
    <section className="ai-card" aria-label={title}>
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="ai-empty">Sem dados no período.</p> : (
        <ul className="ai-bars">
          {rows.map((r) => {
            const pct = total ? Math.round((r.count / total) * 100) : 0
            return (
              <li key={r.label}>
                <span className="ai-bar-label">{map ? map(r.label) : r.label}</span>
                <span className="ai-bar-track" aria-hidden="true"><i style={{ width: `${Math.max(pct, 3)}%` }} /></span>
                <span className="ai-bar-num">{r.count}<small>{pct}%</small></span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function DayBars({ days }: { days: Insights['byDay'] }) {
  const max = Math.max(1, ...days.map((d) => d.sessions))
  return (
    <div className="ai-days" role="img" aria-label={`Visitas por dia: ${days.map((d) => `${d.date} ${d.sessions}`).join(', ')}`}>
      {days.map((d) => (
        <div key={d.date} className="ai-day" title={`${d.date}: ${d.sessions} visitas, ${d.paid} pagamentos`}>
          <span className="ai-day-bar" style={{ height: `${Math.max((d.sessions / max) * 100, d.sessions ? 6 : 0)}%` }}>
            {d.paid ? <i style={{ height: `${(d.paid / Math.max(d.sessions, 1)) * 100}%` }} /> : null}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Perfil do público que chegou ao checkout no período: aparelho, navegador, sistema, onde estão, de onde vêm e quando. */
export function AudienceInsights({ data }: { data: Insights }) {
  const total = data.sessions
  return (
    <section className="ai" aria-label="Perfil do público">
      <header className="ai-head">
        <div>
          <h2>Perfil do público</h2>
          <p>Quem abriu o checkout nos últimos {data.days} dias. Quanto mais visitas, mais confiável o retrato.</p>
        </div>
        <nav className="tm-filters" aria-label="Período">
          {[7, 30, 90].map((d) => <Link key={d} className="tm-filter" href={`/admin/checkouts?days=${d}`} aria-pressed={data.days === d}>{d} dias</Link>)}
        </nav>
      </header>

      <dl className="ai-kpis">
        <div><dt>Visitas ao checkout</dt><dd>{total}</dd></div>
        <div><dt>Pagamentos aprovados</dt><dd data-tone="ok">{data.paid}<small>{money(data.paidCents)}</small></dd></div>
        <div><dt>Conversão</dt><dd>{data.conversionPct.toLocaleString('pt-BR')}%<small>aprovados ÷ visitas</small></dd></div>
        <div><dt>Chegaram a gerar pagamento</dt><dd>{data.withPayment}<small>{total ? Math.round((data.withPayment / total) * 100) : 0}% das visitas</small></dd></div>
      </dl>

      <div className="ai-grid">
        <section className="ai-card ai-card--wide" aria-label="Visitas por dia">
          <h3>Visitas por dia <small>(barra dourada = parte que pagou)</small></h3>
          <DayBars days={data.byDay} />
          <div className="ai-axis"><span>{data.byDay[0]?.date.slice(5).split('-').reverse().join('/')}</span><span>{data.byDay.at(-1)?.date.slice(5).split('-').reverse().join('/')}</span></div>
        </section>
        <section className="ai-card ai-card--wide" aria-label="Horário das visitas">
          <h3>Horário das visitas <small>(no seu fuso)</small></h3>
          <HoursBars hoursUtc={data.hoursUtc} />
        </section>
        <BarList title="Aparelho" rows={data.device} total={total} map={(l) => DEVICE_LABEL[l] ?? l} />
        <BarList title="Navegador" rows={data.browser} total={total} />
        <BarList title="Sistema" rows={data.os} total={total} />
        <BarList title="Cidades" rows={data.city} total={total} />
        <BarList title="Países" rows={data.country} total={total} map={(l) => countryName(l) ?? l} />
        <BarList title="De onde vêm" rows={data.source} total={total} />
        <BarList title="Idioma" rows={data.language} total={total} />
      </div>
      <p className="ai-note">Cidade e país vêm da CDN que fica na frente do site; sem ela esses blocos ficam vazios. Idade e interesses não são coletados: o navegador não informa e inferir isso por cookies exigiria consentimento.</p>
    </section>
  )
}
