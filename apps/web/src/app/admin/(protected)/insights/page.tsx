import Link from 'next/link'
import { redirect } from 'next/navigation'
import { INSIGHT_ORIGIN_LABEL, type Insights } from '@academia/contracts'
import { mediaSrc } from '@academia/page-renderer'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { Card, Empty, Icon, Kpi, RankBars, Split } from '@/components/dash-ui'
import { TrendChart } from '@/components/trend-chart'
import { InsightsFilters } from '@/components/insights-filters'
import { brl } from '@/lib/format'
import { fmtCompact, fmtInt, fmtPct, ratio } from '@/lib/dashboard'
import { DEVICE_LABEL, avgTime, brDate, fmtDuration, insightsQuery, parseInsightsFilters } from '@/lib/insights'

export const metadata = { title: 'Insights' }
export const dynamic = 'force-dynamic'

type Search = Record<string, string | undefined>

/**
 * Insights (D-040): engajamento e vendas por curso, com filtros de período, profissional, curso, aparelho e origem.
 * Login de profissional vê só os próprios cursos (imposto pela API).
 */
export default async function InsightsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('insights.read')) return <main><h1>Insights</h1><p>Você não tem permissão para ver este módulo.</p></main>
  const filters = parseInsightsFilters(await searchParams)
  const { data, status } = await adminGet<Insights & { message?: string }>(`/admin/insights?${insightsQuery(filters)}`)
  const restricted = !user.permissions.includes('insights.all')
  const proName = data?.options.professionals.find((p) => p.id === data.scope.professionalId)?.name

  return (
    <main className="dash ins">
      <section className="dash-head">
        <div className="dash-head-text">
          <p className="admin-eyebrow">{restricted && proName ? `Seus cursos · ${proName}` : 'Desempenho dos cursos'}</p>
          <h1>Insights</h1>
          <p>Quem visita cada curso, quanto tempo fica, quantos clicam para comprar e quantas vendas foram aprovadas.</p>
        </div>
        <div className="dash-head-controls">
          <p className="dash-daterange"><Icon name="calendar" size={18} />{brDate(filters.from)} a {brDate(filters.to)}</p>
        </div>
      </section>

      {!data ? (
        <section className="dash-card"><Empty>{status === 403 ? 'Este login ainda não está ligado a um profissional. Fale com o administrador.' : status === 422 ? (data as { message?: string } | null)?.message ?? 'Filtros inválidos.' : 'Não foi possível carregar os insights agora. Atualize a página em instantes.'}</Empty></section>
      ) : (
        <>
          <InsightsFilters key={`${filters.from}|${filters.to}`} filters={filters} options={data.options} restricted={restricted} />
          <Body data={data} />
        </>
      )}
    </main>
  )
}

function Body({ data }: { data: Insights }) {
  const t = data.totals
  const avg = avgTime(t.timeMs, t.views)
  const net = t.revenueCents - t.refundedCents
  const noTime = !data.timeTrackingSince
  const days = data.series.map((d) => ({ date: d.date, views: d.views, visitors: d.visitors, cta: d.cta, checkout: d.checkout }))

  return (
    <>
      <section className="kpi-grid" aria-label="Indicadores principais">
        <Kpi tone="gold" icon="eye" label="Visitas aos cursos" value={fmtCompact(t.views)} hint={`${fmtInt(data.professionalPageViews)} visitas à página do profissional`} spark={data.series.map((d) => d.views)} />
        <Kpi tone="purple" icon="users" label="Visitantes únicos" value={fmtCompact(t.visitors)} hint="Contagem diária e anônima" spark={data.series.map((d) => d.visitors)} />
        <Kpi tone="blue" icon="clock" label="Tempo médio na página" value={fmtDuration(avg)} hint={noTime ? 'A medição começa a partir de agora' : 'Com a página visível, por visita'} />
        <Kpi tone="orange" icon="cart" label="Cliques em comprar" value={fmtInt(t.cta)} hint={`${fmtInt(t.checkout)} chegaram ao checkout`} spark={data.series.map((d) => d.checkout)} />
        <Kpi tone="green" icon="bag" label="Vendas aprovadas" value={fmtInt(t.sales)} hint={t.refunds ? `${fmtInt(t.refunds)} reembolsada(s) ou estornada(s)` : 'Confirmadas pelo webhook do pagamento'} spark={data.series.map((d) => d.sales)} />
        <Kpi tone="gold" icon="star" label="Receita" value={brl(t.revenueCents)} hint={t.refundedCents ? `Líquida ${brl(net)} após reembolsos` : `Conversão visita → venda ${fmtPct(ratio(t.sales, t.views))}`} />
      </section>

      {data.salesIgnoreAudience ? <p className="ins-note" role="note">Vendas e receita não seguem o filtro de aparelho/origem: o pagamento chega pelo webhook, sem esses dados.</p> : null}

      <div className="dash-grid dash-grid-main">
        <Card icon="eye" title="Visitas ao longo do tempo" subtitle="Visualizações e visitantes únicos por dia">
          {t.views === 0 ? <Empty>Sem visitas aos cursos no período.</Empty> : <TrendChart series={days} />}
        </Card>
        <Card icon="cart" title="Funil de venda" subtitle="Da página do curso à venda aprovada">
          {t.views === 0 && t.sales === 0 ? <Empty>Quando os cursos receberem visitas, o funil aparece aqui.</Empty> : (
            <ol className="funnel">
              {([
                { icon: 'eye', label: 'Visitas à página', value: t.views, pct: 100 },
                { icon: 'cart', label: 'Cliques em comprar', value: t.cta, pct: ratio(t.cta, t.views) },
                { icon: 'check', label: 'Chegadas ao checkout', value: t.checkout, pct: ratio(t.checkout, t.views) },
                { icon: 'bag', label: 'Vendas aprovadas', value: t.sales, pct: ratio(t.sales, t.views) },
              ] as const).map((s) => (
                <li key={s.label}>
                  <span className="funnel-icon"><Icon name={s.icon} size={22} /></span>
                  <div className="funnel-body">
                    <div className="funnel-top"><span>{s.label}</span><b>{fmtInt(s.value)}</b></div>
                    <div className="funnel-line">
                      <div className="funnel-track"><span style={{ width: `${Math.min(100, Math.max(s.value ? 2 : 0, s.pct))}%` }} /></div>
                      <em>{fmtPct(s.pct)}</em>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {t.checkout > 0 ? <div className="funnel-sum"><span>Checkout → venda</span><b>{fmtPct(ratio(t.sales, t.checkout))}</b></div> : null}
        </Card>
      </div>

      <Card icon="table" title="Cursos" subtitle="Desempenho de cada curso no período · clique para filtrar" className="ins-table-card">
        {data.courses.length === 0 ? <Empty>Nenhum curso neste filtro.</Empty> : (
          <div className="admin-table-wrap">
            <table className="admin-table ins-table">
              <caption className="sr-only">Desempenho por curso</caption>
              <thead>
                <tr>
                  <th scope="col">Curso</th><th scope="col">Visitas</th><th scope="col">Visitantes</th><th scope="col">Tempo médio</th>
                  <th scope="col">Comprar</th><th scope="col">Checkout</th><th scope="col">Vendas</th><th scope="col">Receita</th><th scope="col">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {data.courses.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">
                      <Link className="ins-course" href={`?${new URLSearchParams({ from: data.range.from, to: data.range.to, courseId: String(c.id), ...(data.scope.professionalId && !data.scope.restricted ? { professionalId: String(data.scope.professionalId) } : {}) })}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {c.coverSrc ? <img className="cl-cover" src={mediaSrc(c.coverSrc, 320)} alt="" width={96} height={54} loading="lazy" /> : <span className="cl-cover" aria-hidden="true" />}
                        <span><b>{c.title}</b><small>{c.professionalName}{c.status !== 'published' ? ` · ${c.status === 'draft' ? 'rascunho' : 'arquivado'}` : ''}</small></span>
                      </Link>
                    </th>
                    <td>{fmtInt(c.views)}</td>
                    <td>{fmtInt(c.visitors)}</td>
                    <td>{fmtDuration(avgTime(c.timeMs, c.views))}</td>
                    <td>{fmtInt(c.cta)}</td>
                    <td>{fmtInt(c.checkout)}</td>
                    <td><b>{fmtInt(c.sales)}</b>{c.refunds ? <small className="ins-refund">−{fmtInt(c.refunds)} reemb.</small> : null}</td>
                    <td>{brl(c.revenueCents)}</td>
                    <td>{fmtPct(ratio(c.sales, c.views))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="dash-grid dash-grid-split">
        <Card icon="globe" title="Aparelhos" subtitle="Visitas aos cursos por tipo de aparelho">
          <Split parts={data.devices.map((d, i) => ({ label: DEVICE_LABEL[d.device], value: d.views, shade: [1, 3, 5][i] ?? 2 }))} />
        </Card>
        <Card icon="link" title="Origem das visitas" subtitle="De onde as pessoas chegaram ao curso">
          {data.origins.length === 0 ? <Empty>Sem visitas no período.</Empty> : (
            <RankBars total={t.views} rows={data.origins.map((o) => ({ key: o.origin, label: INSIGHT_ORIGIN_LABEL[o.origin], value: o.views }))} />
          )}
        </Card>
      </div>
    </>
  )
}
