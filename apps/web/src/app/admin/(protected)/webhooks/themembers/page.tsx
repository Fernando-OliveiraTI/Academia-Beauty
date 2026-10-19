import Link from 'next/link'
import { redirect } from 'next/navigation'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { Pager } from '@/components/pager'
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

export default async function WebhookLogPage({ searchParams }: { searchParams: Promise<{ result?: string; page?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('users.manage')) {
    return <main><h1>Webhook da The Members</h1><p>Só administradores veem este registro: ele guarda o corpo bruto das chamadas, com dados de compradores.</p></main>
  }
  const { result = '', page = '1' } = await searchParams
  const params = new URLSearchParams()
  if (FILTERS.includes(result)) params.set('result', result)
  params.set('page', String(Math.max(1, Number(page) || 1)))
  const { data } = await adminGet<List>(`/admin/webhook-deliveries?${params}`)
  const total = Object.values(data?.counts ?? {}).reduce((a, b) => a + b, 0)
  const hrefFor = (p: number) => `/admin/webhooks/themembers?${new URLSearchParams({ ...(result ? { result } : {}), page: String(p) })}`

  return (
    <main>
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Pagamentos</p>
          <h1>Webhook da The Members</h1>
          <p>Cada chamada recebida em <code className="wh-code">/api/webhooks/themembers</code>, com o corpo exatamente como chegou. Use para conferir o que a The Members envia e por que uma assinatura foi recusada.</p>
        </div>
      </section>

      {data && !data.loggingEnabled ? (
        <p role="status" className="wizard-hint">O registro está desligado (<code className="wh-code">THEMEMBERS_LOG_RAW=false</code>): novas chamadas não aparecem aqui.</p>
      ) : null}

      <div className="tm-filters" role="group" aria-label="Filtrar por resultado">
        <Link className="tm-filter" href="/admin/webhooks/themembers" aria-pressed={!result}>Todas <em>{total}</em></Link>
        {FILTERS.filter((f) => (data?.counts[f] ?? 0) > 0 || f === result).map((f) => (
          <Link key={f} className="tm-filter" href={`/admin/webhooks/themembers?result=${f}`} aria-pressed={result === f}>{RESULT_LABEL[f]} <em>{data?.counts[f] ?? 0}</em></Link>
        ))}
      </div>

      <section className="admin-panel">
        {!data ? (
          <p role="alert" className="form-error">Não foi possível carregar o registro. Tente recarregar a página.</p>
        ) : data.items.length === 0 ? (
          <div className="pay-empty">
            <div>
              <strong>Nenhuma chamada registrada{result ? ' com este resultado' : ' ainda'}</strong>
              <p>Cadastre a URL do webhook na The Members e faça um pagamento de teste: a chamada aparece aqui, aceita ou não. Fica guardada por {data.retentionDays} dias.</p>
            </div>
          </div>
        ) : (
          <WebhookDeliveries items={data.items} />
        )}
        {data && data.total > 0 ? <Pager page={data.page} lastPage={Math.max(1, Math.ceil(data.total / data.perPage))} total={data.total} perPage={data.perPage} hrefFor={hrefFor} /> : null}
      </section>
    </main>
  )
}
