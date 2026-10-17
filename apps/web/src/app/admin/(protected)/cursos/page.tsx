import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminCourse } from '@academia/contracts'
import { adminGet, getCurrentUser } from '@/lib/api-server'

export const metadata = { title: 'Cursos' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' } as const
const FILTERS = [
  { value: '', label: 'Ativos' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'published', label: 'Publicados' },
  { value: 'archived', label: 'Arquivados' },
]
const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

type List = { items: AdminCourse[]; meta: { total: number; page: number; lastPage: number } }

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('courses.read')) {
    return <main><h1>Cursos</h1><p>Você não tem permissão para ver este módulo.</p></main>
  }
  const { status = '', q = '', page = '1' } = await searchParams
  const params = new URLSearchParams()
  if (['draft', 'published', 'archived'].includes(status)) params.set('status', status)
  if (q) params.set('q', q.slice(0, 80))
  params.set('page', String(Math.max(1, Number(page) || 1)))
  const { data, status: httpStatus } = await adminGet<List>(`/admin/courses?${params}`)
  const canWrite = user.permissions.includes('courses.write')

  return (
    <main>
      <p className="admin-eyebrow">Catálogo</p>
      <div className="admin-title-row">
        <h1>Cursos</h1>
        {canWrite ? <Link className="admin-button" href="/admin/cursos/novo">Novo curso</Link> : null}
      </div>

      <form className="admin-filters" method="get" aria-label="Filtrar cursos">
        <label className="ds-label" htmlFor="q">Buscar</label>
        <input id="q" name="q" className="ds-input" defaultValue={q} maxLength={80} placeholder="Título ou slug" />
        <label className="ds-label" htmlFor="status">Situação</label>
        <select id="status" name="status" className="ds-input" defaultValue={status}>
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button className="admin-button secondary" type="submit">Filtrar</button>
      </form>

      {!data ? (
        <p role="alert" className="form-error">Não foi possível carregar a lista (código {httpStatus}). Tente novamente.</p>
      ) : data.items.length === 0 ? (
        <section className="admin-card"><p>Nenhum curso encontrado.</p></section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="sr-only">Cursos cadastrados</caption>
            <thead><tr><th scope="col">Curso</th><th scope="col">Profissional</th><th scope="col">Situação</th><th scope="col">Oferta</th><th scope="col">Atualizado</th></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <th scope="row"><Link href={`/admin/cursos/${c.id}`}>{c.data.title}</Link><small>/{c.slug}</small></th>
                  <td>{c.professionalName}</td>
                  <td>
                    <span className={`admin-badge ${c.status}`}>{STATUS_LABEL[c.status]}</span>
                    {c.hasUnpublishedChanges ? <span className="admin-badge pending">Alterações não publicadas</span> : null}
                  </td>
                  <td>{c.commercial ? `${brl(c.commercial.listCents)}${c.commercial.discountPct ? ` −${c.commercial.discountPct}%` : ''}${c.commercial.active ? '' : ' (inativa)'}` : '—'}</td>
                  <td><time dateTime={c.updatedAt}>{new Date(c.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time></td>
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
