import type { MetadataRoute } from 'next'
import { indexingEnabled, absoluteUrl } from '@/lib/site'

// Depende do ambiente de execução (`SITE_URL`, `SITE_INDEXING`): nunca estático.
export const dynamic = 'force-dynamic'

/** Painel, API, pré-visualizações e rotas internas nunca são rastreados; a mídia (`/media`) fica liberada para as imagens. */
export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled()) return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/preview', '/internal', '/healthz'] },
    sitemap: absoluteUrl('/sitemap.xml') ?? undefined,
  }
}
