/**
 * Endereço público do site e interruptor de indexação (lidos em tempo de execução).
 *
 * - `SITE_URL`: origem pública (ex.: `https://academiabeauty.com.br`), sem caminho. Base de canonical,
 *   Open Graph, sitemap e dados estruturados.
 * - `SITE_INDEXING=true`: libera os buscadores. Só vale em produção e com `SITE_URL` válido; em qualquer
 *   outro caso o site inteiro continua `noindex` (padrão seguro: um deploy sem configuração não é indexado).
 */

/** Origem normalizada (sem barra final), ou null se ausente/inválida. Só http(s) e sem credenciais. */
export function parseSiteUrl(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  return url.origin
}

export function siteUrl(): string | null {
  return parseSiteUrl(process.env.SITE_URL)
}

export function indexingEnabled(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.SITE_INDEXING === 'true' && siteUrl() !== null
}

/** URL absoluta de um caminho do site (ou null sem `SITE_URL`). */
export function absoluteUrl(path: string): string | null {
  const base = siteUrl()
  if (!base) return null
  return new URL(path, base).toString()
}
