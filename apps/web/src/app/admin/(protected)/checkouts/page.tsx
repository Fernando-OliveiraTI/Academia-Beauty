import { redirect } from 'next/navigation'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { ListToolbar, type StatusTab } from '@/components/list-toolbar'
import { ListEmpty } from '@/components/list-empty'
import { Pager, lastPageOf } from '@/components/pager'
import { isPerPage, listHref, pageOf } from '@/lib/list-params'
import { parsePeriod } from '@/components/period-filter'
import { CheckoutSessions, type SessionItem } from '@/components/checkout-sessions'
import { AudienceInsights, type Insights } from '@/components/audience-insights'
import { STATE_LABEL } from '@/lib/checkout-labels'

export const metadata = { title: 'Checkouts' }
export const dynamic = 'force-dynamic'

type List = {
  items: SessionItem[]
  total: number
  page: number
  perPage: number
  counts: { all: number; paid: number; pending: number; failed: number; none: number }
  enabled: boolean
  ipMode: 'full' | 'truncated' | 'none'
  retentionDays: number
}
const STATES = ['paid', 'pending', 'failed', 'none'] as const
const SORTS = [{ value: '', label: 'Mais recentes' }, { value: 'oldest', label: 'Mais antigas' }]
const dot = (tone: 'ok' | 'bad' | 'neutral' | 'all' | 'warn') => <span className="wh-dot" data-tone={tone} aria-hidden="true" />
const TONE = { paid: 'ok', pending: 'warn', failed: 'bad', none: 'neutral' } as const
const IP_NOTE = { full: 'IP completo', truncated: 'IP truncado (rede)', none: 'IP não guardado' } as const

const CheckoutArt = ({ sessions, conversion, days }: { sessions: number; conversion: number; days: number }) => (
  <div className="wh-art" aria-hidden="true">
    <div className="wh-art-main">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 15 4-5 3 3 5-7" /></svg>
    </div>
    <div className="wh-art-chip wh-art-chip--ok"><i /><div><b>{sessions} visitas</b><span>últimos {days} dias</span></div></div>
    <div className="wh-art-chip wh-art-chip--bad cs-chip-conv"><i /><div><b>{conversion.toLocaleString('pt-BR')}% conversão</b><span>aprovados ÷ visitas</span></div></div>
  </div>
)

export default async function CheckoutsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; sort?: string; perPage?: string; days?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('users.manage')) {
    return <main><h1>Checkouts</h1><p>Só administradores veem este módulo: ele guarda o IP e os dados de navegação dos visitantes.</p></main>
  }
  const { status = '', q = '', page = '1', sort = '', perPage = '', days = '30' } = await searchParams
  const period = parsePeriod(days)
  const params = new URLSearchParams()
  if ((STATES as readonly string[]).includes(status)) params.set('state', status)
  if (q) params.set('q', q.slice(0, 80))
  if (sort === 'oldest') params.set('sort', sort)
  if (isPerPage(perPage)) params.set('perPage', perPage)
  params.set('page', String(pageOf(page)))
  const [{ data }, { data: insights }] = await Promise.all([
    adminGet<List>(`/admin/checkout-sessions?${params}`),
    adminGet<Insights>(`/admin/checkout-sessions/insights?days=${period}`),
  ])

  const tabs: StatusTab[] = [
    { value: '', label: 'Todas', icon: dot('all'), count: data?.counts.all ?? 0 },
    ...STATES.map((s) => ({ value: s, label: STATE_LABEL[s], icon: dot(TONE[s]), count: data?.counts[s] ?? 0 })),
  ]
  const hrefFor = (p: number) => listHref('/admin/checkouts', { status, q, sort, perPage, days }, p)

  return (
    <main>
      <section className="admin-hero wh-hero">
        <div>
          <p className="admin-eyebrow">Pagamentos</p>
          <h1>Checkouts</h1>
          <p>Cada abertura do checkout recebe um código. Quando a The Members devolve o código no webhook, você vê quem pagou, de onde veio e com que aparelho. Também serve para conferir os testes de pagamento.</p>
        </div>
        <CheckoutArt sessions={insights?.sessions ?? 0} conversion={insights?.conversionPct ?? 0} days={insights?.days ?? 30} />
      </section>

      {data && !data.enabled ? (
        <p role="status" className="wizard-hint">O registro de visitas está desligado (<code className="wh-code">CHECKOUT_SESSIONS_ENABLED=false</code>): novas visitas não aparecem aqui.</p>
      ) : null}
      {data ? <p className="wizard-hint">{IP_NOTE[data.ipMode]} · guardado por {data.retentionDays} dias.</p> : null}

      {insights ? <AudienceInsights data={insights} /> : <p role="alert" className="form-error">Não foi possível carregar o perfil do público.</p>}

      <h2 className="cs-list-title">Visitas e pagamentos</h2>
      <ListToolbar variant="inline" searchPlaceholder="Buscar por código, cidade, origem…" tabs={tabs} sorts={SORTS} />

      {!data ? (
        <p role="alert" className="form-error">Não foi possível carregar as visitas. Tente recarregar a página.</p>
      ) : data.items.length === 0 ? (
        <ListEmpty title={q || status ? 'Nenhuma visita encontrada' : 'Nenhuma visita registrada ainda'}>
          {q || status ? 'Ajuste a busca ou limpe os filtros para ver mais resultados.' : 'Abra a página de um curso com checkout da The Members: a visita aparece aqui assim que o checkout ficar visível na tela.'}
        </ListEmpty>
      ) : (
        <section className="admin-panel wh-panel">
          <CheckoutSessions items={data.items} />
          <Pager page={data.page} lastPage={lastPageOf(data.total, data.perPage)} total={data.total} perPage={data.perPage} hrefFor={hrefFor} />
        </section>
      )}
    </main>
  )
}
