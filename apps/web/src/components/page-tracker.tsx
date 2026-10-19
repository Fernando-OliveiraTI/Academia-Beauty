'use client'

import { useEffect } from 'react'

type Props = { type: 'home' | 'professional' | 'course'; slug?: string }

function send(payload: Record<string, string | undefined>) {
  try {
    const body = JSON.stringify(payload)
    const url = '/api/public/track'
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return
    void fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
  } catch {
    // métrica nunca pode quebrar a página
  }
}

/**
 * Medição das páginas públicas (alimenta o dashboard): uma visualização por abertura e os cliques de compra.
 * Cliques em `[data-cta]` contam como interesse; se o clique sai para outro domínio (checkout do provedor) conta como checkout.
 * Não grava cookie nem identificador no navegador; o servidor guarda só um resumo diário anônimo.
 */
export function PageTracker({ type, slug }: Props) {
  useEffect(() => {
    send({ kind: 'view', type, slug, referrer: document.referrer || undefined })

    const onClick = (ev: MouseEvent) => {
      const anchor = (ev.target as Element | null)?.closest?.('a') as HTMLAnchorElement | null
      if (!anchor) return
      const external = /^https:\/\//i.test(anchor.href) && new URL(anchor.href).origin !== location.origin
      const isCta = anchor.hasAttribute('data-cta') || Boolean(anchor.closest('#checkout'))
      if (!isCta) return
      // Rolar até o formulário (defaultPrevented) é interesse; seguir para o provedor é a saída para o checkout.
      send({ kind: external && !ev.defaultPrevented ? 'checkout' : 'cta', type, slug })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [type, slug])

  return null
}
