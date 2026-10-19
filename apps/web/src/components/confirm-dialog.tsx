'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export type ConfirmOptions = {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` pinta a confirmação de vermelho (apagar, remover) e foca o Cancelar. */
  tone?: 'default' | 'danger'
}

const Icon = ({ danger }: { danger: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {danger ? <><path d="M12 3.500 2.500 20h19z" /><path d="M12 10v4.500M12 17.500h.01" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>}
  </svg>
)

/**
 * Confirmação padrão do painel (no lugar do `window.confirm`): `const { confirm, dialog } = useConfirm()`,
 * renderize `{dialog}` uma vez e use `if (!(await confirm({ title, message }))) return`.
 * Esc, clique fora e Cancelar resolvem `false`.
 */
export function useConfirm() {
  const ref = useRef<HTMLDialogElement>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)

  const finish = useCallback((ok: boolean) => {
    const resolve = resolver.current
    resolver.current = null
    ref.current?.close()
    setOptions(null)
    resolve?.(ok)
  }, [])

  const confirm = useCallback((next: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false)
    resolver.current = resolve
    setOptions(next)
  }), [])

  useEffect(() => { if (options && !ref.current?.open) ref.current?.showModal() }, [options])
  useEffect(() => () => { resolver.current?.(false) }, [])

  const danger = options?.tone === 'danger'
  const dialog = (
    <dialog
      ref={ref}
      className="cf-dialog"
      aria-labelledby="cf-title"
      onCancel={(e) => { e.preventDefault(); finish(false) }}
      onClick={(e) => { if (e.target === e.currentTarget) finish(false) }}
    >
      {options ? (
        <div className={`cf-body${danger ? ' danger' : ''}`}>
          <span className="cf-icon"><Icon danger={danger} /></span>
          <div>
            <h2 id="cf-title">{options.title}</h2>
            {options.message ? <p>{options.message}</p> : null}
          </div>
          <div className="cf-actions">
            <button type="button" className="admin-button secondary" onClick={() => finish(false)} autoFocus={danger}>{options.cancelLabel ?? 'Cancelar'}</button>
            <button type="button" className={`admin-button${danger ? ' cf-danger' : ''}`} onClick={() => finish(true)} autoFocus={!danger}>{options.confirmLabel ?? 'Confirmar'}</button>
          </div>
        </div>
      ) : null}
    </dialog>
  )
  return { confirm, dialog }
}
