'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { mediaSrc } from '@academia/page-renderer'
import { apiGet, apiSend } from '@/lib/api-client'
import { useConfirm } from '@/components/confirm-dialog'
import { ProductPicker } from '@/components/themembers-product-picker'

type Change = { field: 'title' | 'price'; label: string; current: string | null; incoming: string }
type Professional = { id: number; name: string; photoSrc: string | null }
type Item = {
  courseId: number
  slug: string
  title: string
  coverSrc: string | null
  professional: Professional | null
  externalCourseId: string
  state: 'changes' | 'up_to_date' | 'not_found'
  membersStatus: string | null
  membersTitle: string | null
  changes: Change[]
}
type UnlinkedCourse = { courseId: number; slug: string; title: string; coverSrc: string | null; professional: Professional | null; hasOffer: boolean }
type Preview = { items: Item[]; withoutLink: number; unlinkedCourses: UnlinkedCourse[]; unlinkedProducts: { id: string; title: string; coverSrc: string | null }[] }

const ERRORS: Record<string, string> = {
  themembers_not_configured: 'O token da The Members não está configurado no servidor (TOKEN_THE_MEMBERS).',
  themembers_unreachable: 'Não foi possível falar com a The Members. Tente novamente.',
  offer_required: 'Cadastre a oferta do curso antes de informar o ID.',
  external_id_taken: 'Este ID já está em outro curso.',
  themembers_error: 'A The Members recusou ou devolveu uma resposta inesperada.',
}
const VISIBLE_ROWS = 5
type Filter = 'all' | 'changes' | 'up_to_date' | 'not_found' | 'unlinked'
type Row = { kind: 'linked'; item: Item } | { kind: 'unlinked'; course: UnlinkedCourse }
const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const initialOf = (name: string) => name.trim().charAt(0).toUpperCase()
const EMPTY: Record<Filter, { title: string; text: string }> = {
  all: { title: 'Nenhum curso cadastrado', text: 'Cadastre um curso para poder vinculá-lo a um produto da The Members.' },
  changes: { title: 'Tudo em dia', text: 'Nenhum curso vinculado tem nome ou valor diferente do que está na The Members.' },
  up_to_date: { title: 'Nenhum curso em dia ainda', text: 'Todos os cursos vinculados têm algo a atualizar. Confirme a sincronização para aplicar.' },
  not_found: { title: 'Nenhum ID inválido', text: 'Todos os IDs informados existem na The Members.' },
  unlinked: { title: 'Todos os cursos estão vinculados', text: 'Nenhum curso está sem o ID da The Members. Tudo certo por aqui.' },
}
const STATE_LABEL = { changes: 'Com alterações', up_to_date: 'Sem alterações', not_found: 'ID não encontrado' } as const

const Svg = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const MEMBERS_PRODUCT_URL = 'https://dashboard.themembers.com.br/produto/edit/'

/** Abre o produto no painel da The Members (o último trecho da URL é o ID do produto). */
function MembersLink({ id, label = false }: { id: string; label?: boolean }) {
  return (
    <a className={`tm-ext${label ? ' with-label' : ''}`} href={`${MEMBERS_PRODUCT_URL}${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer" aria-label="Ver na The Members (abre em nova aba)" title="Ver na The Members">
      <img src="/admin/themembers-favicon.png" alt="" width={20} height={20} />
      {label ? <span>Ver na The Members</span> : null}
    </a>
  )
}

const SyncIcon = ({ size }: { size?: number }) => <Svg size={size}><path d="M21 12a9 9 0 0 0-15.5-6.3L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 15.5 6.3L21 16" /><path d="M16 16h5v5" /></Svg>
const InfoIcon = ({ size }: { size?: number }) => <Svg size={size}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></Svg>
const ArrowIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
const ChevronIcon = () => <Svg size={16}><path d="M6 9l6 6 6-6" /></Svg>
const TagIcon = () => <Svg size={16}><path d="M4 5a1 1 0 0 1 1-1h7l8 8-8 8-8-8z" /><path d="M8 8h.01" /></Svg>
const MoneyIcon = () => <Svg size={16}><path d="M12 3v18" /><path d="M16.5 7.5C16 6 14.2 5 12 5c-2.4 0-4 1.1-4 3s1.6 2.6 4 3 4 1.1 4 3-1.6 3-4 3c-2.3 0-4.2-1-4.8-2.6" /></Svg>
const BoxIcon = () => <Svg size={20}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></Svg>
const BackIcon = () => <Svg size={16}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>
const UnlinkIcon = () => <Svg size={18}><path d="M9.500 14.500 7 17a3.500 3.500 0 0 1-5-5l3-3M14.500 9.500 17 7a3.500 3.500 0 0 1 5 5l-3 3" /><path d="M3 3l18 18" /></Svg>
const EmptyIcon = ({ kind }: { kind: Filter }) => (
  <Svg size={28}>
    {kind === 'unlinked' ? <><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></>
      : kind === 'not_found' ? <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4M8.5 8.5l5 5M13.5 8.5l-5 5" /></>
      : kind === 'up_to_date' ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
      : <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></>}
  </Svg>
)
const SaveIcon = () => <Svg size={18}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
const CheckCircleIcon = () => <Svg size={24}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></Svg>
const SearchIcon = () => <Svg size={16}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></Svg>
const UsersIcon = () => <Svg size={18}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.500 5.500" /><path d="M16 4.500a3.500 3.500 0 0 1 0 7M18 14.800c2 .6 3.200 2.300 3.500 5.200" /></Svg>

/** Foto do profissional; sem foto (ou imagem quebrada), mostra a inicial. */
function ProfessionalPhoto({ professional }: { professional: Professional }) {
  const [broken, setBroken] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => { if (ref.current?.complete && ref.current.naturalWidth === 0) setBroken(true) }, [])
  return professional.photoSrc && !broken
    ? <img ref={ref} className="tm-pro-photo" src={mediaSrc(professional.photoSrc, 96)} alt="" width={40} height={40} loading="lazy" onError={() => setBroken(true)} />
    : <span className="tm-pro-photo" aria-hidden="true">{initialOf(professional.name)}</span>
}

/** Botão "Sincronizar" da lista de cursos: consulta a The Members e mostra o que mudaria (não grava nada). */
export function ThemembersSync() {
  const router = useRouter()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const dialog = useRef<HTMLDialogElement>(null)
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [professionalId, setProfessionalId] = useState<number | null>(null)
  // Cursos marcados para sincronizar (padrão: nenhum; o usuário escolhe).
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [ids, setIds] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [unlinking, setUnlinking] = useState<number | null>(null)
  const [rowError, setRowError] = useState<Record<number, string>>({})

  useEffect(() => () => dialog.current?.close(), [])

  async function run(refresh = false) {
    setLoading(true)
    setError(null)
    if (!refresh) { setPreview(null); setDone(null); setShowAll(false); setFilter('all'); setQuery(''); setProfessionalId(null); setSelected(new Set()) }
    if (!dialog.current?.open) dialog.current?.showModal()
    const res = await apiGet<Preview & { code?: string }>('/admin/courses/themembers/preview')
    setLoading(false)
    if (res.ok && res.data) return setPreview(res.data)
    setError(res.status === 403 ? 'Sem permissão para sincronizar.' : ERRORS[res.data?.code ?? ''] ?? 'Não foi possível consultar a The Members.')
  }
  const close = () => dialog.current?.close()
  async function apply() {
    setApplying(true)
    setError(null)
    setDone(null)
    const res = await apiSend<{ results?: { applied: string[]; skipped: string | null }[]; code?: string }>('POST', '/admin/courses/themembers/sync', { courseIds: [...selectedIds] })
    setApplying(false)
    if (!res.ok || !res.data?.results) {
      return setError(res.status === 403 ? 'Sem permissão para sincronizar.' : ERRORS[res.data?.code ?? ''] ?? 'Não foi possível sincronizar. Nada foi perdido: tente de novo.')
    }
    const updated = res.data.results.filter((r) => r.applied.length).length
    const skipped = res.data.results.filter((r) => r.skipped).length
    setDone(`${updated} curso(s) atualizado(s).${skipped ? ` ${skipped} com ressalva (valor ou nome fora do permitido, ou curso arquivado): confira o resumo.` : ''}`)
    router.refresh()
    await run(true)
  }

  /** Remove o vínculo de um curso (limpa o ID). Preço e nome do curso não mudam. */
  async function unlink(courseId: number, title: string) {
    if (!(await confirm({ title: 'Remover o vínculo?', message: `“${title}” deixa de ser sincronizado com a The Members. Nome e valor continuam como estão agora.`, confirmLabel: 'Remover vínculo', tone: 'danger' }))) return
    setUnlinking(courseId)
    setRowError((e) => ({ ...e, [courseId]: '' }))
    const res = await apiSend<{ code?: string }>('DELETE', `/admin/courses/${courseId}/themembers-id`)
    setUnlinking(null)
    if (!res.ok) {
      return setRowError((e) => ({ ...e, [courseId]: res.status === 403 ? 'Sem permissão para remover.' : 'Não foi possível remover o vínculo. Tente novamente.' }))
    }
    router.refresh()
    await run(true)
  }

  /** Grava só o ID da The Members na oferta do curso da linha. */
  async function saveId(courseId: number) {
    const value = (ids[courseId] ?? '').trim()
    if (!value) return setRowError((e) => ({ ...e, [courseId]: 'Informe o ID da The Members.' }))
    setSaving(courseId)
    setRowError((e) => ({ ...e, [courseId]: '' }))
    const res = await apiSend<{ code?: string; errors?: { message: string }[] }>('PUT', `/admin/courses/${courseId}/themembers-id`, { externalCourseId: value })
    setSaving(null)
    if (!res.ok) {
      const message = res.status === 403 ? 'Sem permissão para salvar.' : ERRORS[res.data?.code ?? ''] ?? res.data?.errors?.[0]?.message ?? 'Não foi possível salvar. Tente novamente.'
      return setRowError((e) => ({ ...e, [courseId]: message }))
    }
    setIds(({ [courseId]: _saved, ...rest }) => rest)
    await run(true)
  }

  const changed = preview?.items.filter((i) => i.state === 'changes') ?? []
  const selectedIds = new Set(changed.filter((i) => selected.has(i.courseId)).map((i) => i.courseId))
  const rows: Row[] = preview
    ? [...preview.items.map((item): Row => ({ kind: 'linked', item })), ...preview.unlinkedCourses.map((course): Row => ({ kind: 'unlinked', course }))]
    : []
  const kindOf = (row: Row): Exclude<Filter, 'all'> => (row.kind === 'unlinked' ? 'unlinked' : row.item.state)
  const professionalOf = (row: Row) => (row.kind === 'linked' ? row.item.professional : row.course.professional)
  const titleOf = (row: Row) => (row.kind === 'linked' ? row.item : row.course)
  const professionals = [...new Map(rows.flatMap((row) => { const p = professionalOf(row); return p ? [[p.id, p] as const] : [] })).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const needle = normalizeText(query.trim())
  // Busca e profissional recortam a lista; os contadores das abas de situação seguem esse recorte.
  const scoped = rows.filter((row) => {
    if (professionalId !== null && professionalOf(row)?.id !== professionalId) return false
    if (!needle) return true
    const c = titleOf(row)
    const members = row.kind === 'linked' ? row.item.membersTitle ?? '' : ''
    return normalizeText(`${c.title} ${c.slug} ${members}`).includes(needle)
  })
  const count = (kind: Exclude<Filter, 'all'>) => scoped.filter((row) => kindOf(row) === kind).length
  const filtered = filter === 'all' ? scoped : scoped.filter((row) => kindOf(row) === filter)
  const visible = showAll ? filtered : filtered.slice(0, VISIBLE_ROWS)
  const hidden = filtered.length - visible.length
  const filtersActive = Boolean(needle) || professionalId !== null
  const filters: { value: Filter; label: string; count: number; dot: string }[] = [
    { value: 'all', label: 'Todos', count: scoped.length, dot: '' },
    { value: 'changes', label: 'Com alterações', count: count('changes'), dot: 'on' },
    { value: 'up_to_date', label: 'Sem alterações', count: count('up_to_date'), dot: '' },
    ...(count('not_found') || filter === 'not_found' ? [{ value: 'not_found' as const, label: 'ID não encontrado', count: count('not_found'), dot: 'warn' }] : []),
    { value: 'unlinked', label: 'Sem ID da The Members', count: count('unlinked'), dot: 'warn' },
  ]
  // "Selecionar todos" atua sobre o que a lista mostra agora (cursos com alterações dentro dos filtros).
  const selectable = filtered.flatMap((row) => (row.kind === 'linked' && row.item.state === 'changes' ? [row.item.courseId] : []))
  const allSelectableOn = selectable.length > 0 && selectable.every((id) => selected.has(id))
  const toggleCourse = (courseId: number) => setSelected((cur) => { const next = new Set(cur); if (next.has(courseId)) next.delete(courseId); else next.add(courseId); return next })
  const toggleVisible = () => setSelected((cur) => { const next = new Set(cur); for (const id of selectable) { if (allSelectableOn) next.delete(id); else next.add(id) } return next })
  const clearFilters = () => { setQuery(''); setProfessionalId(null); setFilter('all'); setShowAll(false) }

  return (
    <>
      <button type="button" className="admin-button secondary tm-trigger" onClick={() => run()} disabled={loading}>
        <SyncIcon size={18} />
        {loading ? 'Consultando…' : 'Sincronizar The Members'}
      </button>
      <dialog ref={dialog} className="media-dialog tm-dialog" aria-labelledby="tm-sync-title" onClose={() => setPreview(null)} onClick={(e) => { if (e.target === e.currentTarget) close() }}>
        <h2 id="tm-sync-title" className="sr-only">Sincronizar com a The Members</h2>
        {loading && !preview ? <p role="status" className="tm-status">Consultando a The Members…</p> : null}
        {done ? <p role="status" className="tm-done"><span className="tm-icon-box"><CheckCircleIcon /></span>{done}</p> : null}
        {error ? <p role="alert" className="form-error">{error}</p> : null}

        {preview ? (
          <>
            <aside className="tm-note">
              <span className="tm-icon-box"><InfoIcon size={26} /></span>
              <div>
                <b>O que acontecerá?</b>
                <p>Os dados abaixo serão atualizados de acordo com as informações da The Members.</p>
              </div>
            </aside>

            <section className="tm-card" aria-label="Cursos cadastrados">
              <div className="tm-card-head">
                <h3>
                  <span className="tm-icon-box"><BoxIcon /></span>
                  <span>
                    Cursos cadastrados ({filtered.length === rows.length ? rows.length : `${filtered.length} de ${rows.length}`})
                    <small>Vincule cada curso a um produto da The Members. Os cursos sem vínculo não serão atualizados.</small>
                  </span>
                </h3>
                <div className="tm-search-wrap">
                  <label className="tm-search">
                    <SearchIcon />
                    <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setShowAll(false) }} placeholder="Buscar por nome do curso ou endereço" aria-label="Buscar cursos" />
                  </label>
                </div>
                {professionals.length > 1 ? (
                  <div className="tm-pros" role="group" aria-label="Filtrar por profissional">
                    <button type="button" className="tm-pro" aria-pressed={professionalId === null} onClick={() => { setProfessionalId(null); setShowAll(false) }}>
                      <span className="tm-pro-photo all" aria-hidden="true"><UsersIcon /></span>
                      <span className="tm-pro-text"><b>Todos</b><small>{rows.length} curso(s)</small></span>
                    </button>
                    {professionals.map((p) => {
                      const total = rows.filter((row) => professionalOf(row)?.id === p.id).length
                      return (
                        <button key={p.id} type="button" className="tm-pro" aria-pressed={professionalId === p.id} onClick={() => { setProfessionalId(professionalId === p.id ? null : p.id); setShowAll(false) }}>
                          <ProfessionalPhoto professional={p} />
                          <span className="tm-pro-text"><b>{p.name}</b><small>{total} curso(s)</small></span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
                <div className="tm-filters" role="group" aria-label="Filtrar cursos">
                  {filters.map((f) => (
                    <button key={f.value} type="button" className="tm-filter" aria-pressed={filter === f.value} onClick={() => { setFilter(f.value); setShowAll(false) }}>
                      {f.value === 'all' ? null : <i className={`tm-dot ${f.dot}`} />}{f.label} <em>{f.count}</em>
                    </button>
                  ))}
                </div>
              </div>
              {rows.length ? (
                <div className="tm-rows">
                  {selectable.length ? (
                    <label className="tm-selectbar">
                      <input type="checkbox" checked={allSelectableOn} onChange={toggleVisible} />
                      <span>{allSelectableOn ? 'Desmarcar' : 'Selecionar'} todos os cursos com alterações{filtersActive || filter !== 'all' ? ' desta lista' : ''} ({selectable.length})</span>
                    </label>
                  ) : null}
                  {filtered.length ? <div className="tm-row tm-row-head" aria-hidden="true"><span>Curso</span><span>Situação</span><span>O que mudaria</span><span>Vincular a um produto</span></div> : null}
                  {filtered.length === 0 ? (
                    <div className="tm-empty" role="status">
                      <span className="tm-empty-icon"><EmptyIcon kind={filter} /></span>
                      <b>{filtersActive && filter === 'all' ? 'Nenhum curso encontrado' : EMPTY[filter].title}</b>
                      <p>{filtersActive && filter === 'all' ? 'Nenhum curso combina com a busca ou o profissional escolhido.' : EMPTY[filter].text}</p>
                      <button type="button" className="admin-button secondary" onClick={clearFilters}>{filtersActive ? 'Limpar filtros' : 'Ver todos os cursos'}</button>
                    </div>
                  ) : null}
                  {visible.map((row) => {
                    const course = row.kind === 'linked' ? row.item : row.course
                    const id = course.courseId
                    const canLink = row.kind === 'unlinked' && row.course.hasOffer
                    return (
                      <form className={`tm-row${row.kind === 'linked' && row.item.state === 'changes' && selected.has(id) ? ' is-selected' : ''}`} key={id} onSubmit={(e) => { e.preventDefault(); void saveId(id) }}>
                        <div className="tm-course">
                          {row.kind === 'linked' ? (
                            <input type="checkbox" className="tm-check" checked={row.item.state === 'changes' && selected.has(id)} disabled={row.item.state !== 'changes'} onChange={() => toggleCourse(id)} aria-label={row.item.state === 'changes' ? `Sincronizar ${course.title}` : `${course.title}: nada a sincronizar`} title={row.item.state === 'changes' ? 'Incluir na sincronização' : 'Nada a sincronizar'} />
                          ) : <span className="tm-check" aria-hidden="true" />}
                          {course.coverSrc ? <img src={mediaSrc(course.coverSrc, 240)} alt="" width={80} height={60} loading="lazy" /> : <span className="tm-cover-empty" aria-hidden="true" />}
                          <div><b>{course.title}</b><small>/{course.slug}</small></div>
                          {row.kind === 'linked' ? <MembersLink id={row.item.externalCourseId} /> : null}
                        </div>
                        <div>
                          {row.kind === 'linked' ? (
                            <>
                              <span className={`tm-pill ${row.item.state}`}>
                                <i className={`tm-dot ${row.item.state === 'changes' ? 'on' : row.item.state === 'not_found' ? 'warn' : ''}`} />
                                {STATE_LABEL[row.item.state]}
                              </span>
                              {row.item.membersStatus && row.item.membersStatus !== 'active' ? <small className="tm-sub">Produto {row.item.membersStatus}</small> : null}
                            </>
                          ) : <span className="tm-pill not_found"><i className="tm-dot warn" /> Sem ID da The Members</span>}
                        </div>
                        <div className={row.kind === 'linked' && row.item.changes.length ? 'tm-changes' : 'tm-nochange'}>
                          {row.kind === 'linked' && row.item.changes.length ? row.item.changes.map((c) => (
                            <div className="tm-change" key={c.field}>
                              <span className="tm-change-icon">{c.field === 'price' ? <MoneyIcon /> : <TagIcon />}</span>
                              <div>
                                <small>{c.field === 'price' ? 'Valor' : 'Nome do curso'}</small>
                                <p><s>{c.current ?? 'sem valor'}</s><ArrowIcon size={14} /><strong>{c.incoming}</strong></p>
                              </div>
                            </div>
                          )) : (
                            <span className="tm-none">
                              {row.kind === 'unlinked' ? '—' : row.item.state === 'not_found' ? 'Este ID não existe na The Members.' : 'Nada a atualizar.'}
                            </span>
                          )}
                        </div>
                        <div className="tm-idcell">
                          {row.kind === 'linked' ? (
                            <>
                              <div className={`tm-pick-chosen tm-linked${row.item.state === 'not_found' ? ' is-missing' : ''}`}>
                                <span className="tm-pick-text">
                                  <b>{row.item.membersTitle ?? 'Produto não encontrado na The Members'}</b>
                                  <small>{row.item.externalCourseId}</small>
                                </span>
                              </div>
                              <button type="button" className="tm-save tm-unlink" disabled={unlinking === id} onClick={() => void unlink(id, course.title)} aria-label="Remover vínculo com a The Members" title="Remover vínculo">{unlinking === id ? '…' : <UnlinkIcon />}</button>
                            </>
                          ) : canLink ? (
                            <>
                              <ProductPicker
                                products={preview.unlinkedProducts}
                                value={ids[id] ?? ''}
                                onChange={(next) => setIds((cur) => ({ ...cur, [id]: next }))}
                                takenIds={new Set(Object.entries(ids).filter(([k]) => Number(k) !== id).map(([, v]) => v.trim()).filter(Boolean))}
                                disabled={saving === id}
                                label={`ID da The Members para ${course.title}`}
                              />
                              <button type="submit" className="tm-save" disabled={saving === id || !(ids[id] ?? '').trim()} aria-label="Salvar ID" title="Salvar ID">{saving === id ? '…' : <SaveIcon />}</button>
                            </>
                          ) : (
                            <span className="tm-pick-off">Cadastre a oferta para vincular<ChevronIcon /></span>
                          )}
                          {rowError[id] ? <small role="alert" className="tm-rowerror">{rowError[id]}</small> : null}
                        </div>
                      </form>
                    )
                  })}
                  {hidden > 0 || showAll ? (
                    <button type="button" className="tm-more" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                      <span className="tm-icon-box"><span className={showAll ? 'tm-flip' : ''}><ChevronIcon /></span></span>
                      <span>
                        <b>{showAll ? 'Ver menos' : `Ver mais ${hidden} curso(s)`}</b>
                        <small>{showAll ? 'Recolher a lista de cursos.' : 'Expanda para visualizar os demais cursos cadastrados.'}</small>
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        <footer className="tm-foot">
          <button type="button" className="admin-button secondary" onClick={close} disabled={applying}><BackIcon /> Cancelar</button>
          {preview && changed.length ? <span className="tm-foot-count" role="status">{selectedIds.size} de {changed.length} curso(s) com alterações selecionado(s)</span> : null}
          <button type="button" className="admin-button tm-confirm" onClick={apply} disabled={applying || loading || selectedIds.size === 0} title={changed.length === 0 ? 'Não há alterações a aplicar' : selectedIds.size === 0 ? 'Marque ao menos um curso' : undefined}>
            <SyncIcon size={18} /> {applying ? 'Sincronizando…' : selectedIds.size && selectedIds.size < changed.length ? `Sincronizar ${selectedIds.size} selecionado(s)` : 'Confirmar sincronização'} <ArrowIcon />
          </button>
        </footer>
      </dialog>
      {confirmDialog}
    </>
  )
}
