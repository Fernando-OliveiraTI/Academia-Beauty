'use client'

import { useEffect } from 'react'

type Props = { type: 'home' | 'professional' | 'course'; slug?: string }

/** Intervalo dos envios parciais de tempo enquanto a página está visível. */
export const HEARTBEAT_MS = 15_000

function send(payload: Record<string, string | number | undefined>) {
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
 * Tempo na página (Insights): soma só o tempo com a aba visível e envia o acumulado sempre que a aba fica oculta, a
 * página é fechada e, enquanto visível, a cada 15 s (o envio da saída pode se perder em alguns navegadores; assim
 * perde-se no máximo o último trecho). O servidor soma os envios e descarta os menores que 1 s.
 * Não grava cookie nem identificador no navegador; o servidor guarda só um resumo diário anônimo.
 */
export function PageTracker({ type, slug }: Props) {
  useEffect(() => {
    const referrer = document.referrer || undefined
    send({ kind: 'view', type, slug, referrer })

    // Tempo visível: conta desde que a aba ficou visível; envia ao ocultar/sair (o envio leva a mesma origem da visita).
    let visibleSince: number | null = document.visibilityState === 'visible' ? performance.now() : null
    const flush = () => {
      if (visibleSince === null) return
      const ms = Math.round(performance.now() - visibleSince)
      visibleSince = null
      if (ms >= 1000) send({ kind: 'time', type, slug, referrer, durationMs: ms })
    }
    // Envio parcial periódico: fecha o trecho atual e começa outro (só com a aba visível).
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || visibleSince === null) return
      flush()
      visibleSince = performance.now()
    }, HEARTBEAT_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
      else if (visibleSince === null) visibleSince = performance.now()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)

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
      window.clearInterval(heartbeat)
      flush() // navegação interna (sem pagehide) também fecha a contagem
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('click', onClick)
      io?.disconnect()
    }
  }, [type, slug])

  return null
}
