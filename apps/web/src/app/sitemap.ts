import type { MetadataRoute } from 'next'
import { publicGet } from '@/lib/api-server'
import { absoluteUrl, indexingEnabled } from '@/lib/site'

export const dynamic = 'force-dynamic'

type SitemapResponse = { professionals: { slug: string; lastmod: string }[]; courses: { slug: string; lastmod: string }[] }

/** Home, profissionais publicados e cursos publicados. Vazio enquanto a indexação estiver desligada. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingEnabled()) return []
  const data = await publicGet<SitemapResponse>('/sitemap', ['sitemap', 'professionals', 'courses'])
  const entry = (path: string, lastModified?: string) => ({ url: absoluteUrl(path)!, lastModified })
  return [
    entry('/'),
    ...(data?.professionals ?? []).map((p) => entry(`/profissionais/${p.slug}`, p.lastmod)),
    ...(data?.courses ?? []).map((c) => entry(`/cursos/${c.slug}`, c.lastmod)),
  ]
}
