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
 * Com o checkout embutido na página, ele conta como checkout quando aparece na tela (uma vez por visita).
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

    // Checkout embutido (The Members): não há saída para outro domínio, o checkout abre na própria página.
    // Conta como chegada ao checkout, uma vez por visita, quando ele aparece na tela.
    let io: IntersectionObserver | undefined
    const embedded = type === 'course' ? document.querySelector('#checkout [data-embed]') : null
    if (embedded && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        send({ kind: 'checkout', type, slug })
        io?.disconnect()
      }, { threshold: 0.05 })
      io.observe(embedded)
    }
    return () => {
      document.removeEventListener('click', onClick)
      io?.disconnect()
    }
  }, [type, slug])

  return null
}
