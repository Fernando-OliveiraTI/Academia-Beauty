'use client'

import { useEffect, useRef } from 'react'

export type PublishPhase = 'saving' | 'publishing' | 'done' | null

/**
 * Retorno visual da publicação no editor: enquanto acontece, um cartão com o anel girando (mesmo visual do antigo
 * assistente, `.wz-publishing`) e a etapa atual; ao terminar, um ✓ animado com o link para a página no ar.
 * Esc, o botão ou clicar fora fecham o aviso de sucesso; durante a publicação nada fecha.
 */
export function PublishOverlay({ phase, publicHref, onClose }: { phase: PublishPhase; publicHref: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (phase !== 'done') return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, onClose])

  if (!phase) return null

  if (phase !== 'done') {
    return (
      <div className="wz-publishing" role="status" aria-live="polite">
        <div className="wz-publishing-card">
          <span className="wz-spinner" aria-hidden="true" />
          <strong>{phase === 'saving' ? 'Salvando alterações…' : 'Publicando…'}</strong>
          <small>{phase === 'saving' ? 'Garantindo que o servidor tem exatamente o que está na tela.' : 'Colocando a página no ar. Isso leva só um instante.'}</small>
        </div>
      </div>
    )
  }

  return (
    <div className="wz-publishing ed-published" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wz-publishing-card ed-published-card" role="dialog" aria-modal="true" aria-labelledby="ed-published-title">
        <svg className="ed-published-check" viewBox="0 0 64 64" aria-hidden="true">
          <circle className="ed-published-ring" cx="32" cy="32" r="29" />
          <path className="ed-published-tick" d="M19 33.5 28 42l17-19" />
        </svg>
        <strong id="ed-published-title">Publicado!</strong>
        <small>A página já está no ar. O site é atualizado em instantes.</small>
        <span className="ed-actions ed-published-actions">
          <a className="admin-button" href={publicHref} target="_blank" rel="noreferrer">Ver página no site</a>
          <button ref={closeRef} type="button" className="admin-button secondary" onClick={onClose}>Continuar editando</button>
        </span>
      </div>
    </div>
  )
}
