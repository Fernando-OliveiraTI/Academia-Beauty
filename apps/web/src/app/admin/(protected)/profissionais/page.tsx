import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminProfessional } from '@academia/contracts'
import { adminGet, getCurrentUser } from '@/lib/api-server'

export const metadata = { title: 'Profissionais' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' } as const
const FILTERS = [
  { value: '', label: 'Ativos' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'published', label: 'Publicados' },
  { value: 'archived', label: 'Arquivados' },
]

type List = { items: AdminProfessional[]; meta: { total: number; page: number; lastPage: number } }

export default async function ProfessionalsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('professionals.read')) {
    return <main><h1>Profissionais</h1><p>Você não tem permissão para ver este módulo.</p></main>
  }
  const { status = '', q = '', page = '1' } = await searchParams
  const params = new URLSearchParams()
  if (['draft', 'published', 'archived'].includes(status)) params.set('status', status)
  if (q) params.set('q', q.slice(0, 80))
  params.set('page', String(Math.max(1, Number(page) || 1)))
  const { data, status: httpStatus } = await adminGet<List>(`/admin/professionals?${params}`)
  const canWrite = user.permissions.includes('professionals.write')

  return (
    <main>
      <p className="admin-eyebrow">Catálogo</p>
      <div className="admin-title-row">
        <h1>Profissionais</h1>
        {canWrite ? <Link className="admin-button" href="/admin/profissionais/novo">Novo profissional</Link> : null}
      </div>

      <form className="admin-filters" method="get" aria-label="Filtrar profissionais">
        <label className="ds-label" htmlFor="q">Buscar</label>
        <input id="q" name="q" className="ds-input" defaultValue={q} maxLength={80} placeholder="Nome ou slug" />
        <label className="ds-label" htmlFor="status">Situação</label>
        <select id="status" name="status" className="ds-input" defaultValue={status}>
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button className="admin-button secondary" type="submit">Filtrar</button>
      </form>

      {!data ? (
        <p role="alert" className="form-error">Não foi possível carregar a lista (código {httpStatus}). Tente novamente.</p>
      ) : data.items.length === 0 ? (
        <section className="admin-card"><p>Nenhum profissional encontrado.</p></section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="sr-only">Profissionais cadastrados</caption>
            <thead><tr><th scope="col">Nome</th><th scope="col">Situação</th><th scope="col">Home</th><th scope="col">Atualizado</th></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <th scope="row"><Link href={`/admin/profissionais/${p.id}`}>{p.data.name}</Link><small>/{p.slug}</small></th>
                  <td>
                    <span className={`admin-badge ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                    {p.hasUnpublishedChanges ? <span className="admin-badge pending">Alterações não publicadas</span> : null}
                  </td>
                  <td>{p.status === 'published' && p.homeVisible ? `Sim (#${p.homeOrder})` : '—'}</td>
                  <td><time dateTime={p.updatedAt}>{new Date(p.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.meta.lastPage > 1 ? (
            <nav className="admin-pager" aria-label="Paginação">
              {data.meta.page > 1 ? <Link href={`?${new URLSearchParams({ status, q, page: String(data.meta.page - 1) })}`}>Anterior</Link> : null}
              <span>Página {data.meta.page} de {data.meta.lastPage}</span>
              {data.meta.page < data.meta.lastPage ? <Link href={`?${new URLSearchParams({ status, q, page: String(data.meta.page + 1) })}`}>Próxima</Link> : null}
            </nav>
          ) : null}
        </div>
      )}
    </main>
  )
}
