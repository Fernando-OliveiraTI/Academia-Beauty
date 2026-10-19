import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminProfessional } from '@academia/contracts'
import { mediaSrc } from '@academia/page-renderer'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { RowActions } from '@/components/row-actions'
import { ListToolbar } from '@/components/list-toolbar'
import { ListEmpty } from '@/components/list-empty'
import { Pager } from '@/components/pager'
import { isPerPage, pageOf } from '@/lib/list-params'

export const metadata = { title: 'Profissionais' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' } as const
const SORTS = [
  { value: '', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'name', label: 'Nome (A–Z)' },
  { value: 'name_desc', label: 'Nome (Z–A)' },
  { value: 'created', label: 'Criados recentemente' },
]

type List = { items: AdminProfessional[]; meta: { total: number; page: number; perPage: number; lastPage: number; counts: { draft: number; published: number; archived: number } } }

export default async function ProfessionalsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; sort?: string; perPage?: string; professionalId?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('professionals.read')) {
    return <main><h1>Profissionais</h1><p>Você não tem permissão para ver este módulo.</p></main>
  }
  const { status = '', q = '', page = '1', sort = '', perPage = '', professionalId = '' } = await searchParams
  const params = new URLSearchParams()
  if (['draft', 'published', 'archived'].includes(status)) params.set('status', status)
  if (q) params.set('q', q.slice(0, 80))
  if (['oldest', 'name', 'name_desc', 'created'].includes(sort)) params.set('sort', sort)
  if (isPerPage(perPage)) params.set('perPage', perPage)
  if (/^\d+$/.test(professionalId)) params.set('professionalId', professionalId)
  params.set('page', String(pageOf(page)))
  const { data, status: httpStatus } = await adminGet<List>(`/admin/professionals?${params}`)
  const canWrite = user.permissions.includes('professionals.write')
  const canArchive = user.permissions.includes('professionals.publish')
  const canDuplicate = user.permissions.includes('professionals.write')

  return (
    <main>
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Catálogo</p>
          <h1>Profissionais</h1>
          <p>Gerencie os profissionais da academia. Crie novas páginas, publique e acompanhe o status de cada profissional.</p>
        </div>
        {canWrite ? <Link className="admin-button" href="/admin/profissionais/novo">+ Novo profissional</Link> : null}
      </section>

      <ListToolbar
        searchPlaceholder="Buscar por nome ou slug..."
        sorts={SORTS}
        tabs={[
          { value: '', label: 'Ativos', count: (data?.meta.counts.draft ?? 0) + (data?.meta.counts.published ?? 0) },
          { value: 'published', label: 'Publicados', count: data?.meta.counts.published ?? 0 },
          { value: 'draft', label: 'Rascunhos', count: data?.meta.counts.draft ?? 0 },
          { value: 'archived', label: 'Arquivados', count: data?.meta.counts.archived ?? 0 },
        ]}
      />

      {!data ? (
        <p role="alert" className="form-error">Não foi possível carregar a lista (código {httpStatus}). Tente novamente.</p>
      ) : data.items.length === 0 ? (
        <ListEmpty title="Nenhum profissional encontrado">Ajuste a busca ou limpe os filtros para ver mais resultados.</ListEmpty>
      ) : (
        <div className="admin-table-wrap admin-panel">
          <table className="admin-table">
            <caption className="sr-only">Profissionais cadastrados</caption>
            <thead><tr><th scope="col">Profissional</th><th scope="col">Situação</th><th scope="col">Home</th><th scope="col">Atualizado</th><th scope="col">Ações</th></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    <div className="admin-person">
                      {p.data.cardPhotoSrc ? <img className="admin-avatar" src={mediaSrc(p.data.cardPhotoSrc, 96)} alt="" width={52} height={52} loading="lazy" /> : <span className="admin-avatar" aria-hidden="true" />}
                      <div><Link href={`/admin/profissionais/${p.id}`}>{p.data.name}</Link><small>/{p.slug}</small></div>
                    </div>
                  </th>
                  <td>
                    <span className={`admin-badge ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                    {p.hasUnpublishedChanges ? <span className="admin-badge pending">Alterações não publicadas</span> : null}
                  </td>
                  <td>{p.status === 'published' && p.homeVisible ? `Sim (#${p.homeOrder})` : '—'}</td>
                  <td><time dateTime={p.updatedAt}>{new Date(p.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time></td>
                  <td><RowActions apiPath={`/admin/professionals/${p.id}`} editHref={`/admin/editor/profissionais/${p.id}`} noun="profissional" name={p.data.name} status={p.status} canArchive={canArchive} canDuplicate={canDuplicate} editorBase="/admin/editor/profissionais" viewHref={p.status === 'published' ? `/profissionais/${p.slug}` : `/admin/preview/profissionais/${p.id}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={data.meta.page} lastPage={data.meta.lastPage} total={data.meta.total} perPage={data.meta.perPage} hrefFor={(n) => `?${new URLSearchParams({ ...Object.fromEntries(params), page: String(n) })}`} />
        </div>
      )}
    </main>
  )
}
