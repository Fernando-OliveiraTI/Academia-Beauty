/**
 * Content-Security-Policy do site e do painel. Duas variantes:
 * - painel (`nonce`): sem 'unsafe-inline' em scripts; só roda o que o servidor marcou com o nonce da requisição
 *   ('strict-dynamic' propaga a confiança aos módulos carregados por eles). Exige renderização dinâmica (o painel já é);
 * - site público (sem `nonce`): as páginas são estáticas/ISR e não têm nonce por requisição, então os scripts inline do
 *   Next precisam de 'unsafe-inline'. Decisão registrada em docs/features/active/security-hardening/decisions.md (S-002).
 */
export type CspOptions = {
  /** Nonce da requisição (painel). Sem ele, usa a variante do site público. */
  nonce?: string
  /** `'self'` deixa o próprio site embutir a página (quadro de pré-visualização do editor); senão `'none'`. */
  frameAncestors: "'self'" | "'none'"
  isDev: boolean
  /** Hosts https de CDN de mídia. */
  mediaHosts: string[]
  /** Hosts de checkout autorizados (embutidos em iframe). */
  checkoutHosts: string[]
}

export function buildCsp({ nonce, frameAncestors, isDev, mediaHosts, checkoutHosts }: CspOptions): string {
  const media = mediaHosts.map((h) => `https://${h}`).join(' ')
  const frames = ["'self'", ...checkoutHosts.map((h) => `https://${h}`)].join(' ')
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`
    : `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`
  // Atributos style="" (React) não aceitam nonce: ficam liberados só neles; <style> e <link> seguem o nonce.
  const styleSrc = nonce ? `style-src 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-inline'` : "style-src 'self' 'unsafe-inline'"
  return [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    `img-src 'self' data: blob:${media ? ` ${media}` : ''}`,
    `media-src 'self' blob:${media ? ` ${media}` : ''}`,
    "font-src 'self' data:",
    `frame-src ${frames}`,
    "connect-src 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/** Lista de hosts de uma variável de ambiente (vírgula), já validados. */
export function hostList(raw: string | undefined, allowWildcard = false): string[] {
  const pattern = allowWildcard ? /^(\*\.)?[a-z0-9.-]+$/ : /^[a-z0-9.-]+$/
  return (raw ?? '').split(',').map((h) => h.trim().toLowerCase()).filter((h) => pattern.test(h))
}

/** Rotas do painel que só o próprio site pode embutir (quadro de pré-visualização do editor). */
export const FRAMED_ADMIN_PATH = /^\/admin\/preview\/(?:home|[^/]+\/[^/]+)\/live$|^\/admin\/preview\/home\/live$/
