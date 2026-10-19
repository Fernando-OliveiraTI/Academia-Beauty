import { redirect } from 'next/navigation'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { ListToolbar, type StatusTab } from '@/components/list-toolbar'
import { ListEmpty } from '@/components/list-empty'
import { Pager, lastPageOf } from '@/components/pager'
import { isPerPage, listHref, pageOf } from '@/lib/list-params'
import { WebhookDeliveries, type DeliveryItem } from '@/components/webhook-deliveries'
import { RESULT_LABEL } from '@/lib/webhook-labels'

export const metadata = { title: 'Webhook da The Members' }
export const dynamic = 'force-dynamic'

type List = {
  items: DeliveryItem[]
  total: number
  page: number
  perPage: number
  counts: Record<string, number>
  loggingEnabled: boolean
  retentionDays: number
}
const FILTERS = ['accepted', 'duplicate', 'invalid_signature', 'invalid_payload', 'not_configured', 'empty_body']
const SORTS = [{ value: '', label: 'Mais recentes' }, { value: 'oldest', label: 'Mais antigas' }]
const dot = (tone: 'ok' | 'bad' | 'neutral' | 'all') => <span className="wh-dot" data-tone={tone} aria-hidden="true" />
const TONE: Record<string, 'ok' | 'bad' | 'neutral'> = { accepted: 'ok', duplicate: 'neutral', invalid_signature: 'bad', invalid_payload: 'bad', not_configured: 'bad', empty_body: 'bad' }

const WebhookArt = () => (
  <div className="wh-art" aria-hidden="true">
    <div className="wh-art-main">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 16.980h-5.990c-1.100 0-1.950.940-2.480 1.900A4 4 0 0 1 2 17c.010-.7.200-1.400.570-2" /><path d="m6 17 3.130-5.780c.530-.970.100-2.180-.500-3.100a4 4 0 1 1 6.890-4.060" /><path d="m12 6 3.130 5.730C15.660 12.700 16.900 13 18 13a4 4 0 0 1 0 8" /></svg>
    </div>
    <div className="wh-art-chip wh-art-chip--ok"><i /><div><b>HTTP 200</b><span>transaction.approved</span></div></div>
    <div className="wh-art-chip wh-art-chip--bad"><i /><div><b>HTTP 403</b><span>invalid signature</span></div></div>
  </div>
)

export default async function WebhookLogPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; sort?: string; perPage?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('users.manage')) {
    return <main><h1>Webhook da The Members</h1><p>Só administradores veem este registro: ele guarda o corpo bruto das chamadas, com dados de compradores.</p></main>
  }
  const { status = '', q = '', page = '1', sort = '', perPage = '' } = await searchParams
  const params = new URLSearchParams()
  if (FILTERS.includes(status)) params.set('result', status)
  if (q) params.set('q', q.slice(0, 80))
  if (sort === 'oldest') params.set('sort', sort)
  if (isPerPage(perPage)) params.set('perPage', perPage)
  params.set('page', String(pageOf(page)))
  const { data } = await adminGet<List>(`/admin/webhook-deliveries?${params}`)

  const total = Object.values(data?.counts ?? {}).reduce((a, b) => a + b, 0)
  const tabs: StatusTab[] = [
    { value: '', label: 'Todas', icon: dot('all'), count: total },
    ...FILTERS.filter((f) => (data?.counts[f] ?? 0) > 0 || f === status).map((f) => ({ value: f, label: RESULT_LABEL[f]!, icon: dot(TONE[f]!), count: data?.counts[f] ?? 0 })),
  ]
  const hrefFor = (p: number) => listHref('/admin/webhooks/themembers', { status, q, sort, perPage }, p)

  return (
    <main>
      <section className="admin-hero wh-hero">
        <div>
          <p className="admin-eyebrow">Pagamentos</p>
          <h1>Webhook da The Members</h1>
          <p>Cada chamada recebida em <code className="wh-code">/api/webhooks/themembers</code>, com o corpo exatamente como chegou. Use para conferir o que a The Members envia e por que uma chamada foi recusada.</p>
        </div>
        <WebhookArt />
      </section>

      {data && !data.loggingEnabled ? (
        <p role="status" className="wizard-hint">O registro está desligado (<code className="wh-code">THEMEMBERS_LOG_RAW=false</code>): novas chamadas não aparecem aqui.</p>
      ) : null}

      <ListToolbar variant="inline" searchPlaceholder="Buscar por evento, ID, assinatura…" tabs={tabs} sorts={SORTS} />

      {!data ? (
        <p role="alert" className="form-error">Não foi possível carregar o registro. Tente recarregar a página.</p>
      ) : data.items.length === 0 ? (
        <ListEmpty title={q || status ? 'Nenhuma chamada encontrada' : 'Nenhuma chamada registrada ainda'}>
          {q || status ? 'Ajuste a busca ou limpe os filtros para ver mais resultados.' : `Cadastre a URL do webhook na The Members e faça um pagamento de teste: a chamada aparece aqui, aceita ou não. Fica guardada por ${data.retentionDays} dias.`}
        </ListEmpty>
      ) : (
        <section className="admin-panel wh-panel">
          <WebhookDeliveries items={data.items} />
          <Pager page={data.page} lastPage={lastPageOf(data.total, data.perPage)} total={data.total} perPage={data.perPage} hrefFor={hrefFor} />
        </section>
      )}
    </main>
  )
}
