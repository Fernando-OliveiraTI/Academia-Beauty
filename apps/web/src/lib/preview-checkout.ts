import type { CheckoutMode } from '@academia/page-renderer'

type Commercial = { provider?: string; checkoutUrl?: string } | null | undefined

/**
 * Checkout exibido nas pré-visualizações do rascunho. Com a The Members escolhida e uma URL https, mostra o
 * iframe (para conferir o visual); caso contrário os botões ficam desativados, como antes. A autorização do
 * domínio continua valendo no navegador (CSP `frame-src`) e na publicação.
 */
export function previewCheckout(commercial: Commercial): CheckoutMode {
  const url = commercial?.checkoutUrl ?? ''
  if (commercial?.provider === 'themembers' && /^https:\/\//i.test(url)) return { mode: 'embed', url }
  return { mode: 'redirect', url: null }
}
