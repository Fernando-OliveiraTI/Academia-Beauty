import Link from 'next/link'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { mediaSrc } from '@academia/page-renderer'
import { TrendChart } from '@/components/trend-chart'
import {
  RANGES, actionLabel, delta, deviceLabel, fmtCompact, fmtInt, fmtPct, initials, longDate, plural, ratio,
  type Dashboard, type Delta,
} from '@/lib/dashboard'

export const metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

const ICONS = {
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

function Icon({ name, size = 20 }: { name: keyof typeof ICONS; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
}

function DeltaChip({ d }: { d: Delta }) {
  const arrow = d.kind === 'up' ? '▲' : d.kind === 'down' ? '▼' : d.kind === 'new' ? '●' : '–'
  return <span className="kpi-delta" data-kind={d.kind}>{d.kind === 'none' ? null : <i aria-hidden="true">{arrow}</i>}{d.label}</span>
}

/** Linha mínima do cartão: forma da série, sem eixos nem rótulos (o número grande já diz o valor). */
function Sparkline({ values }: { values: number[] }) {
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

type Tone = 'gold' | 'purple' | 'orange' | 'green' | 'blue'

function Kpi({ icon, label, value, chip, hint, spark, tone }: { icon: keyof typeof ICONS; label: string; value: string; chip?: Delta; hint?: string; spark?: number[]; tone: Tone }) {
  return (
    <article className="kpi" data-tone={tone}>
      <header><span className="kpi-icon"><Icon name={icon} /></span><h3>{label}</h3>{chip ? <DeltaChip d={chip} /> : null}</header>
      <p className="kpi-value">{value}</p>
      <footer>{hint ? <span>{hint}</span> : <span />}{spark ? <Sparkline values={spark} /> : null}</footer>
    </article>
  )
}

function Card({ icon, title, subtitle, children, className = '', aside }: { icon: keyof typeof ICONS; title: string; subtitle?: string; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
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

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="dash-empty">{children}</p>
}

/** Rótulo do período no cartão (o período em si é escolhido no topo da página). */
const Period = ({ days }: { days: number }) => <span className="dash-period">Últimos {days} dias</span>

/** Barra horizontal de proporções (100%) com rótulos diretos: dispositivos e situação do catálogo. */
function Split({ parts }: { parts: { label: string; value: number; shade: number }[] }) {
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

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return src
    ? <img className="avatar" src={mediaSrc(src, 96)} alt="" width={44} height={44} loading="lazy" />
    : <span className="avatar avatar-fallback" aria-hidden="true">{initials(name)}</span>
}

function RankBars({ rows, total, avatar }: { rows: { key: string; label: string; value: number; note?: string; photo?: string | null }[]; total?: number; avatar?: boolean }) {
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

/** Estado inicial (nenhum acesso medido ainda): em vez de gráficos vazios, mostra o que acontece a seguir. */
function Waiting() {
  const steps = [
    { icon: 'check', title: 'Coleta ativa', text: 'Cada visita às páginas públicas já é registrada, sem cookie e sem guardar o IP.' },
    { icon: 'globe', title: 'Publique e divulgue', text: 'Os números nascem das páginas publicadas: Home, profissionais e cursos.' },
    { icon: 'cart', title: 'Acompanhe a venda', text: 'Veja quantas pessoas chegam ao curso, clicam em comprar e saem para o checkout.' },
  ] as const
  return (
    <section className="wait">
      <div className="wait-ghost" aria-hidden="true">
        <svg viewBox="0 0 600 200" preserveAspectRatio="none">
          <defs><linearGradient id="wait-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--viz-1)" stopOpacity=".35" /><stop offset="100%" stopColor="var(--viz-1)" stopOpacity="0" /></linearGradient></defs>
          <path d="M0 150 C60 140 90 110 140 115 S230 60 290 80 S380 130 440 70 S540 40 600 30 L600 200 L0 200 Z" fill="url(#wait-fill)" />
          <path d="M0 150 C60 140 90 110 140 115 S230 60 290 80 S380 130 440 70 S540 40 600 30" fill="none" stroke="var(--viz-1)" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="wait-body">
        <span className="wait-badge"><i />Aguardando os primeiros acessos</span>
        <h2>Seus indicadores começam aqui</h2>
        <p>Assim que as páginas públicas receberem visitas, este painel passa a mostrar acessos, funil de vendas, origem do tráfego e os cursos que mais convertem.</p>
        <Link className="admin-button" href="/" target="_blank" rel="noopener">Abrir o site público</Link>
      </div>
      <ol className="wait-steps">
        {steps.map((st, i) => (
          <li key={st.title}>
            <span className="wait-step-icon"><Icon name={st.icon} /></span>
            <div><b>{i + 1}. {st.title}</b><p>{st.text}</p></div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await getCurrentUser()
  const { days: raw } = await searchParams
  const days = (RANGES as readonly number[]).includes(Number(raw)) ? Number(raw) : 30
  const { data } = await adminGet<Dashboard>(`/admin/dashboard?days=${days}`)
  const first = (user?.fullName ?? user?.email ?? '').split(' ')[0]

  return (
    <main className="dash">
      <section className="dash-head">
        <div className="dash-head-text">
          <p className="admin-eyebrow">Dashboard</p>
          <h1>Olá, {first} <span aria-hidden="true">👋</span></h1>
          <p>Aqui está o panorama da sua plataforma no período selecionado.</p>
        </div>
        <div className="dash-head-controls">
          {data ? <p className="dash-daterange"><Icon name="calendar" size={18} />{longDate(data.range.from)} a {longDate(data.range.to)}</p> : null}
          <nav className="dash-range" aria-label="Período">
            {RANGES.map((r) => <Link key={r} href={`/admin?days=${r}`} aria-current={r === days ? 'page' : undefined}>{r} dias</Link>)}
          </nav>
        </div>
        <p className="dash-tagline" aria-hidden="true">Conhecimento<br />transforma<br />beleza em<br />resultados.</p>
      </section>

      {!data ? (
        <section className="dash-card"><Empty>Não foi possível carregar os indicadores agora. Atualize a página em instantes.</Empty></section>
      ) : <Body data={data} />}
    </main>
  )
}

const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function Body({ data }: { data: Dashboard }) {
  const { current, previous } = data.totals
  const { professionals, courses } = data.catalog
  const course = data.funnel
  const days = data.range.days
  const totalDevices = data.devices.reduce((s, d) => s + d.total, 0)
  const sortedDevices = [...data.devices].sort((a, b) => b.total - a.total)
  const pageLabels = [
    { key: 'home', label: 'Home', value: data.viewsByPage.home },
    { key: 'professional', label: 'Páginas de profissionais', value: data.viewsByPage.professional },
    { key: 'course', label: 'Páginas de cursos', value: data.viewsByPage.course },
  ].sort((a, b) => b.value - a.value)
  const totalProViews = data.topProfessionals.reduce((s, p) => s + p.views, 0)

  const noData = current.views === 0 && previous.views === 0 && current.cta === 0 && current.checkout === 0
  const catalogCard = (
    <Card icon="db" title="Situação do catálogo" subtitle="Publicados, rascunhos e arquivados">
      <div className="catalog">
        {([['Profissionais', professionals], ['Cursos', courses]] as const).map(([label, s]) => (
          <div key={label}>
            <h3>{label}</h3>
            <Split parts={[
              { label: 'Publicados', value: s.published, shade: 400 },
              { label: 'Rascunhos', value: s.draft, shade: 300 },
              { label: 'Arquivados', value: s.archived, shade: 250 },
            ]} />
          </div>
        ))}
      </div>
    </Card>
  )
  const activityCard = (
    <Card icon="clock" title="Atividade recente" subtitle="Últimas alterações feitas no painel">
      {data.recent.length === 0 ? <Empty>Nenhuma atividade registrada ainda.</Empty> : (
        <div className="dash-table-wrap">
          <table className="activity">
            <thead><tr><th>Usuário</th><th>Ação</th><th>Item</th><th>Data e hora</th></tr></thead>
            <tbody>
              {data.recent.map((r, i) => (
                <tr key={`${r.at}-${i}`}>
                  <td><span className="activity-user"><Avatar name={r.actor ?? 'Sistema'} /><b>{r.actor ?? 'Sistema'}</b></span></td>
                  <td>{actionLabel(r.action)}</td>
                  <td>{r.item ?? '—'}</td>
                  <td><time dateTime={r.at}>{dateTime(r.at)}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )

  return (
    <>
      <section className="kpi-grid" aria-label="Indicadores principais">
        <Kpi tone="gold" icon="eye" label="Acessos" value={noData ? '—' : fmtCompact(current.views)} chip={delta(current.views, previous.views)} hint={noData ? 'Aguardando os primeiros acessos' : `vs ${fmtInt(previous.views)} no período anterior`} spark={data.series.map((d) => d.views)} />
        <Kpi tone="purple" icon="users" label="Visitantes únicos" value={noData ? '—' : fmtCompact(current.visitors)} chip={delta(current.visitors, previous.visitors)} hint={noData ? 'Contagem diária e anônima' : `${current.visitors ? (current.views / current.visitors).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0'} páginas por visitante`} spark={data.series.map((d) => d.visitors)} />
        <Kpi tone="orange" icon="cart" label="Cliques no checkout" value={noData ? '—' : fmtInt(current.checkout)} chip={delta(current.checkout, previous.checkout)} hint={noData ? 'Saídas para o checkout do curso' : `${fmtInt(current.cta)} cliques em comprar`} spark={data.series.map((d) => d.checkout)} />
        <Kpi tone="green" icon="star" label="Profissionais" value={fmtInt(professionals.published)} hint={`publicados · ${fmtInt(professionals.draft)} em rascunho`} />
        <Kpi tone="purple" icon="book" label="Cursos" value={fmtInt(courses.published)} hint={`publicados · ${fmtInt(courses.draft)} em rascunho`} />
        <Kpi tone="blue" icon="globe" label="Páginas publicadas" value={fmtInt(data.catalog.publishedPages)} hint={`Home ${data.catalog.homePublished ? 'no ar' : 'não publicada'} + ${professionals.published + courses.published} páginas`} />
      </section>

      {noData ? (
        <>
          <Waiting />
          <div className="dash-grid dash-grid-wait">
            {catalogCard}
            {activityCard}
          </div>
        </>
      ) : (
        <>
          <div className="dash-grid dash-grid-main">
            <Card icon="eye" title="Acessos ao longo do tempo" subtitle="Visualizações e visitantes únicos por dia" aside={<Period days={days} />}>
              <TrendChart series={data.series} />
            </Card>

            <Card icon="cart" title="Funil dos cursos" subtitle="Da página do curso ao checkout" aside={<Period days={days} />}>
              {course.views === 0 ? <Empty>Quando os cursos receberem visitas, o funil aparece aqui.</Empty> : (
                <ol className="funnel">
                  {([
                    { icon: 'eye', label: 'Visualizações da página', value: course.views, pct: 100 },
                    { icon: 'cart', label: 'Cliques em comprar', value: course.cta, pct: ratio(course.cta, course.views) },
                    { icon: 'check', label: 'Saídas para o checkout', value: course.checkout, pct: ratio(course.checkout, course.views) },
                  ] as const).map((s) => (
                    <li key={s.label}>
                      <span className="funnel-icon"><Icon name={s.icon} size={22} /></span>
                      <div className="funnel-body">
                        <div className="funnel-top"><span>{s.label}</span><b>{fmtInt(s.value)}</b></div>
                        <div className="funnel-line">
                          <div className="funnel-track"><span style={{ width: `${Math.max(s.value ? 2 : 0, s.pct)}%` }} /></div>
                          <em>{fmtPct(s.pct)}</em>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {course.views > 0 ? <div className="funnel-sum"><span>Conversão geral<br />acesso → checkout</span><b>{fmtPct(ratio(course.checkout, course.views))}</b></div> : null}
            </Card>
          </div>

          <div className="dash-grid dash-grid-split">
            <Card icon="crown" title="Cursos em destaque" subtitle="Desempenho no período" aside={<Period days={days} />}>
              {data.topCourses.length === 0 ? <Empty>Nenhum curso recebeu acessos neste período.</Empty> : (
                <ul className="course-strip">
                  {data.topCourses.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/cursos/${c.slug}`} target="_blank" rel="noopener" className="course-card">
                        <span className="course-cover">
                          {c.cover ? <img src={mediaSrc(c.cover, 480)} alt="" loading="lazy" /> : null}
                          <span className="course-stats">
                            <span title="Acessos"><Icon name="eye" size={15} />{fmtInt(c.views)}</span>
                            <span title="Cliques em comprar"><Icon name="bag" size={15} />{fmtInt(c.cta)}</span>
                          </span>
                        </span>
                        <b>{c.title}</b>
                        {c.professional ? <small>{c.professional}</small> : null}
                        <span className="course-foot">
                          <span className="course-conv">{fmtPct(ratio(c.checkout, c.views))} conversão</span>
                          <span className="status-chip" data-status={c.status}>{c.status === 'published' ? 'Publicado' : c.status === 'archived' ? 'Arquivado' : 'Rascunho'}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card icon="user" title="Profissionais mais vistos" subtitle="Acessos às páginas" aside={<Period days={days} />}>
              {data.topProfessionals.length === 0 ? <Empty>Nenhum profissional recebeu acessos neste período.</Empty> : (
                <RankBars avatar total={totalProViews} rows={data.topProfessionals.map((p) => ({ key: p.slug, label: p.name, value: p.views, photo: p.photo }))} />
              )}
            </Card>
          </div>

          <div className="dash-grid dash-grid-three">
            <Card icon="link" title="Onde as pessoas navegam" subtitle="Acessos por tipo de página" aside={<Period days={days} />}>
              {current.views === 0 ? <Empty>Sem acessos no período.</Empty> : <RankBars rows={pageLabels} total={current.views} />}
              {totalDevices === 0 ? null : <p className="dash-note">{fmtPct(ratio(sortedDevices[0]!.total, totalDevices))} dos acessos vêm de {deviceLabel(sortedDevices[0]!.device).toLowerCase()}.</p>}
            </Card>
            <Card icon="link" title="Origem do tráfego" subtitle="De onde vêm os acessos" aside={<Period days={days} />}>
              {data.sources.length === 0 ? <Empty>Sem acessos no período.</Empty> : (
                <RankBars total={current.views} rows={data.sources.map((s) => ({ key: s.host ?? 'direto', label: s.host ?? 'Direto ou sem origem', value: s.total }))} />
              )}
            </Card>
            {catalogCard}
          </div>
        </>
      )}

      {noData ? null : activityCard}
    </>
  )
}
