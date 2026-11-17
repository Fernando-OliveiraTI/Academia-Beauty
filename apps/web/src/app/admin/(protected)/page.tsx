import Link from 'next/link'
import { redirect } from 'next/navigation'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { PeriodFilter, parsePeriod } from '@/components/period-filter'
import { mediaSrc } from '@academia/page-renderer'
import { TrendChart } from '@/components/trend-chart'
import { Avatar, Card, Empty, Icon, Kpi, Period, RankBars, Split } from '@/components/dash-ui'
import {
  actionLabel, delta, deviceLabel, fmtCompact, fmtInt, fmtPct, longDate, ratio,
  type Dashboard,
} from '@/lib/dashboard'

export const metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

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
  // Login de profissional (D-040) não vê o painel geral: a casa dele é a área Insights.
  if (user && !user.permissions.includes('professionals.read') && user.permissions.includes('insights.read')) redirect('/admin/insights')
  const { days: raw } = await searchParams
  const days = parsePeriod(raw)
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
          <PeriodFilter value={days} hrefFor={(d) => `/admin?days=${d}`} />
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
