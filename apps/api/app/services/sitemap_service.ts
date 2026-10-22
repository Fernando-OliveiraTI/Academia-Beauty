import db from '@adonisjs/lucid/services/db'

export type SitemapEntry = { slug: string; lastmod: string }
export type SitemapData = { professionals: SitemapEntry[]; courses: SitemapEntry[] }

const iso = (value: unknown): string => new Date(value as string | Date).toISOString()

/**
 * URLs indexáveis do site: só profissionais publicados e cursos publicados de profissional publicado.
 * Rascunhos nunca entram, nem com `PUBLIC_SHOW_DRAFTS` (que vale só fora de produção).
 */
export default class SitemapService {
  static async entries(): Promise<SitemapData> {
    const professionals = await db
      .from('professionals')
      .where('status', 'published')
      .orderBy('slug')
      .select('slug', 'published_at', 'updated_at')
    const courses = await db
      .from('courses as c')
      .join('professionals as p', 'p.id', 'c.professional_id')
      .where('c.status', 'published')
      .where('p.status', 'published')
      .orderBy('c.slug')
      .select('c.slug', 'c.published_at', 'c.updated_at')
    const toEntry = (row: Record<string, unknown>): SitemapEntry => ({
      slug: row.slug as string,
      lastmod: iso(row.updated_at ?? row.published_at),
    })
    return { professionals: professionals.map(toEntry), courses: courses.map(toEntry) }
  }
}
