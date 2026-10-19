import Link from 'next/link'
import { redirect } from 'next/navigation'
import { computeOffer, type AdminCourse } from '@academia/contracts'
import { mediaSrc } from '@academia/page-renderer'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { RowActions } from '@/components/row-actions'
import { ListToolbar } from '@/components/list-toolbar'
import { ListEmpty } from '@/components/list-empty'
import { Pager } from '@/components/pager'
import { isPerPage, pageOf } from '@/lib/list-params'
import { brl } from '@/lib/format'
import { relativeTime } from '@/lib/relative-time'
import { ThemembersSync } from '@/components/themembers-sync'

export const metadata = { title: 'Cursos' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' } as const
const SORTS = [
  { value: '', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'name', label: 'Título (A–Z)' },
  { value: 'name_desc', label: 'Título (Z–A)' },
  { value: 'created', label: 'Criados recentemente' },
]

const Ico = ({ children }: { children: React.ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const TAB_ICONS = {
  active: <Ico><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></Ico>,
  published: <Ico><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.500 5.700 12 3z" /></Ico>,
  draft: <Ico><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></Ico>,
  archived: <Ico><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></Ico>,
}
const CalendarIcon = () => <svg className="cl-cal" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.500" y="5" width="17" height="15.500" rx="2" /><path d="M3.500 10h17M8 3v4M16 3v4" /></svg>
type ProRow = { id: number; data: { name: string; specialty?: string; portraitSrc?: string; cardPhotoSrc?: string } }

type List = { items: AdminCourse[]; meta: { total: number; page: number; perPage: number; lastPage: number; counts: { draft: number; published: number; archived: number } } }

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; sort?: string; perPage?: string; professionalId?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('courses.read')) {
    return <main><h1>Cursos</h1><p>Você não tem permissão para ver este módulo.</p></main>
  }
  const { status = '', q = '', page = '1', sort = '', perPage = '', professionalId = '' } = await searchParams
  const params = new URLSearchParams()
  if (['draft', 'published', 'archived'].includes(status)) params.set('status', status)
  if (q) params.set('q', q.slice(0, 80))
  if (['oldest', 'name', 'name_desc', 'created'].includes(sort)) params.set('sort', sort)
  if (isPerPage(perPage)) params.set('perPage', perPage)
  if (/^\d+$/.test(professionalId)) params.set('professionalId', professionalId)
  params.set('page', String(pageOf(page)))
  const { data, status: httpStatus } = await adminGet<List>(`/admin/courses?${params}`)
  const { data: pros } = await adminGet<{ items: ProRow[] }>('/admin/professionals?perPage=100&sort=name')
  const proById = new Map((pros?.items ?? []).map((p) => [p.id, p.data] as const))
  const canWrite = user.permissions.includes('courses.write')
  const canArchive = user.permissions.includes('courses.publish')
  const canDuplicate = user.permissions.includes('courses.write')
  const canSync = user.permissions.includes('commerce.manage')

  return (
    <main>
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Catálogo</p>
          <h1>Cursos</h1>
          <p>Gerencie os cursos da academia. Crie páginas de venda, publique e acompanhe o status de cada curso.</p>
        </div>
        <div className="admin-hero-actions">
          {canSync ? <ThemembersSync /> : null}
          {canWrite ? <Link className="admin-button" href="/admin/cursos/novo">+ Novo curso</Link> : null}
        </div>
      </section>

      <ListToolbar
        searchPlaceholder="Buscar por título, profissional ou slug…"
        statusOptions={[{ value: '', label: 'Todos' }, { value: 'published', label: 'Publicados' }, { value: 'draft', label: 'Rascunhos' }, { value: 'archived', label: 'Arquivados' }]}
        sorts={SORTS}
        tabs={[
          { value: '', label: 'Ativos', icon: TAB_ICONS.active, count: (data?.meta.counts.draft ?? 0) + (data?.meta.counts.published ?? 0) },
          { value: 'published', label: 'Publicados', icon: TAB_ICONS.published, count: data?.meta.counts.published ?? 0 },
          { value: 'draft', label: 'Rascunhos', icon: TAB_ICONS.draft, count: data?.meta.counts.draft ?? 0 },
          { value: 'archived', label: 'Arquivados', icon: TAB_ICONS.archived, count: data?.meta.counts.archived ?? 0 },
        ]}
      />

      {!data ? (
        <p role="alert" className="form-error">Não foi possível carregar a lista (código {httpStatus}). Tente novamente.</p>
      ) : data.items.length === 0 ? (
        <ListEmpty title="Nenhum curso encontrado">Ajuste a busca ou limpe os filtros para ver mais resultados.</ListEmpty>
      ) : (
        <div className="admin-table-wrap admin-panel">
          <table className="admin-table">
            <caption className="sr-only">Cursos cadastrados</caption>
            <thead><tr><th scope="col">Curso</th><th scope="col">Profissional</th><th scope="col">Situação</th><th scope="col">Oferta</th><th scope="col">Atualizado</th><th scope="col">Ações</th></tr></thead>
            <tbody>
              {data.items.map((c) => {
                const pro = proById.get(c.professionalId)
                const photo = pro?.portraitSrc || pro?.cardPhotoSrc
                const offer = c.commercial ? computeOffer({ listCents: c.commercial.listCents, discountPct: c.commercial.discountPct, maxInstallments: c.commercial.maxInstallments }) : null
                const updated = new Date(c.updatedAt)
                return (
                  <tr key={c.id}>
                    <th scope="row">
                      <div className="admin-person cl-course">
                        {c.data.coverSrc ? <img className="cl-cover" src={mediaSrc(c.data.coverSrc, 320)} alt="" width={160} height={64} loading="lazy" /> : <span className="cl-cover" aria-hidden="true" />}
                        <div><Link href={`/admin/cursos/${c.id}`}>{c.data.title}</Link><small>/{c.slug}</small></div>
                      </div>
                    </th>
                    <td>
                      <div className="admin-person cl-pro">
                        {photo ? <img className="cl-avatar" src={mediaSrc(photo, 96)} alt="" width={40} height={40} loading="lazy" /> : <span className="cl-avatar" aria-hidden="true" />}
                        <div><b>{c.professionalName}</b>{pro?.specialty ? <small>{pro.specialty}</small> : null}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`admin-badge cl-status ${c.status}`}><i aria-hidden="true" />{STATUS_LABEL[c.status]}</span>
                      {c.hasUnpublishedChanges ? <span className="admin-badge pending">Alterações não publicadas</span> : null}
                    </td>
                    <td>
                      {c.commercial && offer ? (
                        <div className="cl-offer">
                          {offer.discountPct > 0 ? (
                            <>
                              <span className="cl-old"><s>{brl(offer.listCents)}</s><em className="cl-off">−{offer.discountPct}%</em></span>
                              <strong>{brl(offer.totalCents)}</strong>
                            </>
                          ) : <strong>{brl(offer.listCents)}</strong>}
                          {!c.commercial.active ? <span className="cl-inactive"><span className="admin-badge">Inativa</span>{offer.discountPct === 0 ? <small>Oferta desativada</small> : null}</span> : null}
                        </div>
                      ) : <span className="cl-muted">—</span>}
                    </td>
                    <td>
                      <div className="cl-date">
                        <CalendarIcon />
                        <div><time dateTime={c.updatedAt}>{updated.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time><small>{relativeTime(c.updatedAt)}</small></div>
                      </div>
                    </td>
                    <td><RowActions apiPath={`/admin/courses/${c.id}`} editHref={`/admin/editor/cursos/${c.id}`} noun="curso" name={c.data.title} status={c.status} canArchive={canArchive} canDuplicate={canDuplicate} editorBase="/admin/editor/cursos" viewHref={c.status === 'published' ? `/cursos/${c.slug}` : `/admin/preview/cursos/${c.id}`} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pager page={data.meta.page} lastPage={data.meta.lastPage} total={data.meta.total} perPage={data.meta.perPage} hrefFor={(n) => `?${new URLSearchParams({ ...Object.fromEntries(params), page: String(n) })}`} />
        </div>
      )}
    </main>
  )
}
