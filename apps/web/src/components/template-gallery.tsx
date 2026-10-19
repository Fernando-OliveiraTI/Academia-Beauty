'use client'

import { useState } from 'react'

export type TemplateCard = { key: string; label: string; description: string; kind: string; available?: boolean }

/** Resultado de criar o rascunho: caminho do editor ou a mensagem de erro. */
export type PickResult = { href: string } | { error: string }

/**
 * Galeria "Escolha um template": cada cartão cria o rascunho com o template e leva direto ao editor.
 * `onPick` faz a criação; `disabled` (ex.: falta escolher o profissional) bloqueia os botões.
 */
export function TemplateGallery({ templates, onPick, disabled, hint }: {
  templates: readonly TemplateCard[]
  onPick: (key: string) => Promise<PickResult>
  disabled?: boolean
  hint?: string
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(key: string) {
    if (busyKey) return
    setBusyKey(key)
    setError(null)
    const result = await onPick(key)
    if ('href' in result) {
      window.location.assign(result.href)
      return // mantém o estado "criando" até a navegação
    }
    setError(result.error)
    setBusyKey(null)
  }

  return (
    <>
      <p role="alert" className="field-error" hidden={!error}>{error}</p>
      <div className="tpl-grid">
        {templates.map((t) => {
          const available = t.available !== false
          const busy = busyKey === t.key
          return (
            <article className="tpl-card" key={t.key} data-soon={!available || undefined} data-tpl={t.key}>
              <div className="tpl-thumb" aria-hidden="true">
                <i className="tpl-bar" />
                <i className="tpl-line tpl-line--accent" />
                <i className="tpl-line tpl-line--title" />
                <i className="tpl-line tpl-line--title tpl-line--short" />
                <i className="tpl-line tpl-line--text" />
                <span className="tpl-blocks"><i /><i /><i /></span>
              </div>
              <div className="tpl-body">
                <div className="tpl-meta">
                  <span className="admin-eyebrow tpl-kind">{t.kind}</span>
                  <span className="admin-badge published">{available ? 'Disponível' : 'Em breve'}</span>
                </div>
                <h2>{t.label}</h2>
                <p>{t.description}</p>
                {available && t.key.startsWith('professional-') ? (
                  <a className="link-button" href={`/preview/modelos/${t.key}`} target="_blank" rel="noopener" aria-label={`Ver exemplo do modelo ${t.label} (abre em nova aba)`}>
                    Ver exemplo
                  </a>
                ) : null}
                <button
                  type="button"
                  className="tpl-use"
                  disabled={!available || disabled || busyKey !== null}
                  aria-busy={busy || undefined}
                  onClick={() => pick(t.key)}
                >
                  {!available ? 'Em preparação' : busy ? 'Criando…' : 'Usar este template →'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
      {hint ? <p className="tpl-note"><b>Templates seguros por padrão.</b> {hint}</p> : null}
    </>
  )
}
