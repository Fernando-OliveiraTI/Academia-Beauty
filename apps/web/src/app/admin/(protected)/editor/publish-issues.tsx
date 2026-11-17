'use client'

import { useEffect, useRef } from 'react'
import type { PageDocument } from '@academia/page-schema'
import { locateField } from '@academia/contracts'
import { metaFor } from '@academia/section-schemas'

export type PublishIssue = { field: string; message: string; resolved: boolean }

/** Onde a pendência se resolve, em palavras: a seção da página (e se está oculta/ausente) ou o painel Configurações. */
export function issuePlace(kind: 'professional' | 'course', field: string, doc: PageDocument) {
  const loc = locateField(kind, field)
  if ('settings' in loc) return { label: 'Configurações', state: 'settings' as const }
  const section = doc.sections.find((s) => s.type === loc.section)
  const label = metaFor(loc.section)?.label ?? 'Seção'
  if (!section) return { label, state: 'missing' as const }
  return { label, state: section.visibility.enabled ? ('visible' as const) : ('hidden' as const) }
}

const GO_LABEL = { settings: 'Abrir nas Configurações', visible: 'Ir para o campo', hidden: 'Mostrar e preencher', missing: 'Adicionar seção' } as const

/**
 * Pendências da última tentativa de publicar. Cada item leva à seção (e ao campo) da página ou ao painel
 * Configurações. Itens resolvidos aqui no editor ficam marcados até a próxima tentativa.
 */
export function PublishIssues({ kind, issues, doc, busy, canPublish, onGo, onPublish, onClose }: {
  kind: 'professional' | 'course'
  issues: readonly PublishIssue[]
  doc: PageDocument
  busy: boolean
  canPublish: boolean
  onGo: (field: string) => void
  onPublish: () => void
  onClose: () => void
}) {
  const open = issues.filter((i) => !i.resolved)
  return (
    <section className="ed-issues" aria-labelledby="ed-issues-title">
      <div className="ed-issues-head">
        <span className="ed-issues-icon" data-ok={open.length === 0 || undefined} aria-hidden="true">{open.length ? '!' : '✓'}</span>
        <div>
          <h2 id="ed-issues-title" className="ed-h2">{open.length ? `Falta${open.length > 1 ? 'm' : ''} ${open.length} ${open.length > 1 ? 'itens' : 'item'} para publicar` : 'Tudo preenchido'}</h2>
          <p className="ed-cfg-desc">{open.length ? 'Preencha cada item na própria página ou nas Configurações.' : 'Publique de novo para colocar a página no ar.'}</p>
        </div>
      </div>
      <ul className="ed-issues-list">
        {issues.map((issue) => {
          const place = issuePlace(kind, issue.field, doc)
          return (
            <li key={issue.field} data-resolved={issue.resolved || undefined}>
              <div className="ed-issues-text">
                <strong>{issue.message}</strong>
                <small>{place.label}{place.state === 'hidden' ? ' · seção oculta' : place.state === 'missing' ? ' · seção removida' : ''}{issue.resolved ? ' · resolvido' : ''}</small>
              </div>
              {issue.resolved ? null : <button type="button" className="link-button" onClick={() => onGo(issue.field)}>{GO_LABEL[place.state]} →</button>}
            </li>
          )
        })}
      </ul>
      <div className="ed-actions">
        {canPublish && open.length === 0 ? <button type="button" className="admin-button" disabled={busy} onClick={onPublish}>{busy ? 'Aguarde…' : 'Publicar'}</button> : null}
        <button type="button" className="admin-button secondary" onClick={onClose}>Voltar às seções</button>
      </div>
    </section>
  )
}

/**
 * Aviso ao tentar publicar com pendências: a página NÃO foi publicada. Só informa; a lista continua no painel lateral.
 * "Ver pendências" fecha o aviso (o painel já está aberto). Esc ou clique fora também fecham.
 */
export function PublishBlockedNotice({ count, onClose }: { count: number; onClose: () => void }) {
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    button.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="wz-publishing" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wz-publishing-card ed-blocked-card" role="dialog" aria-modal="true" aria-labelledby="ed-blocked-title">
        <span className="ed-issues-icon" aria-hidden="true">!</span>
        <strong id="ed-blocked-title">Não publicado</strong>
        <small>{count === 1 ? 'Existe 1 pendência' : `Existem ${count} pendências`} que impede{count === 1 ? '' : 'm'} a publicação. A página continua como estava no site.</small>
        <button ref={button} type="button" className="admin-button" onClick={onClose}>Ver pendências</button>
      </div>
    </div>
  )
}
