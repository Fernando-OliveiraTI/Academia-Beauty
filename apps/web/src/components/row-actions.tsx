'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiSend } from '@/lib/api-client'
import { useConfirm } from '@/components/confirm-dialog'

type Props = {
  /** Rota da API do item, sem o final (ex.: `/admin/professionals/3`); arquivar/restaurar são `…/archive` e `…/restore`. */
  apiPath: string
  editHref: string
  name: string
  /** "profissional" ou "curso": só para o texto da confirmação. */
  noun: string
  status: 'draft' | 'published' | 'archived'
  viewHref: string
  canArchive: boolean
  /** Quem pode escrever pode duplicar. */
  canDuplicate?: boolean
  /** Base do editor (ex.: `/admin/editor/cursos`): a cópia abre direto nele. */
  editorBase?: string
}

const EyeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
const PencilIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
const DotsIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>

/** Ações de uma linha da lista: ver página, editar e menu com duplicar, despublicar, arquivar/restaurar e apagar (a API exige a permissão de publicar). */
export function RowActions({ apiPath, editHref, name, noun, status, viewHref, canArchive, canDuplicate, editorBase }: Props) {
  const router = useRouter()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const archived = status === 'archived'

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])

  async function toggleArchive() {
    if (!archived && !(await confirm({ title: `Arquivar ${noun === 'curso' ? 'o curso' : 'o profissional'}?`, message: `“${name}” sai do ar e do site. Você pode restaurar depois.`, confirmLabel: 'Arquivar' }))) return
    setBusy(true)
    setError(null)
    const res = await apiSend('POST', `${apiPath}/${archived ? 'restore' : 'archive'}`)
    setBusy(false)
    if (!res.ok) {
      setError(res.status === 403 ? 'Sem permissão para esta ação.' : 'Não foi possível concluir. Tente novamente.')
      return
    }
    setOpen(false)
    router.refresh()
  }

  async function unpublish() {
    if (!(await confirm({ title: 'Despublicar?', message: `“${name}” sai do site; o conteúdo continua salvo como rascunho.`, confirmLabel: 'Despublicar' }))) return
    await run(`${apiPath}/unpublish`, 'POST')
  }

  async function destroy() {
    if (!(await confirm({ title: `Apagar ${noun === 'curso' ? 'o curso' : 'o profissional'}?`, message: `“${name}” será apagado de vez, junto com o histórico de versões. Isso não pode ser desfeito.`, confirmLabel: 'Apagar', tone: 'danger' }))) return
    await run(apiPath, 'DELETE')
  }

  /** Executa uma ação de linha e atualiza a lista; erros da API (ex.: profissional com cursos) aparecem no menu. */
  async function run(path: string, method: 'POST' | 'DELETE') {
    setBusy(true)
    setError(null)
    const res = await apiSend<{ message?: string }>(method, path)
    setBusy(false)
    if (!res.ok) {
      setError(res.status === 403 ? 'Sem permissão para esta ação.' : (res.data?.message ?? 'Não foi possível concluir. Tente novamente.'))
      return
    }
    setOpen(false)
    router.refresh()
  }

  async function duplicate() {
    setBusy(true)
    setError(null)
    const res = await apiSend<{ id: number }>('POST', `${apiPath}/duplicate`)
    if (!res.ok || !res.data) {
      setBusy(false)
      setError(res.status === 403 ? 'Sem permissão para esta ação.' : 'Não foi possível duplicar. Tente novamente.')
      return
    }
    window.location.assign(`${editorBase ?? ''}/${res.data.id}`)
  }

  return (
    <div className="row-actions" ref={root}>
      {confirmDialog}
      <Link className="icon-button" href={viewHref} aria-label={`Ver página de ${name}`} title="Ver página"><EyeIcon /></Link>
      <Link className="icon-button" href={editHref} aria-label={`Editar ${name}`} title="Editar"><PencilIcon /></Link>
      {canArchive || canDuplicate ? (
        <div className="row-menu">
          <button type="button" className="icon-button" aria-label={`Mais ações para ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}><DotsIcon /></button>
          {open ? (
            <div className="row-menu-list" role="menu">
              {canDuplicate ? <button type="button" role="menuitem" disabled={busy} onClick={duplicate}>Duplicar</button> : null}
              {canArchive && status === 'published' ? <button type="button" role="menuitem" disabled={busy} onClick={unpublish}>Despublicar</button> : null}
              {canArchive ? <button type="button" role="menuitem" disabled={busy} onClick={toggleArchive}>{archived ? 'Restaurar' : 'Arquivar'}</button> : null}
              {canArchive && status !== 'published' ? <button type="button" role="menuitem" className="danger" disabled={busy} onClick={destroy}>Apagar</button> : null}
              {error ? <p role="alert" className="form-error">{error}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
