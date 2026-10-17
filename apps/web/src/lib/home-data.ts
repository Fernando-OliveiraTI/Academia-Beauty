import 'server-only'
import { publicHomeSchema, type PublicHome } from '@academia/contracts'
import type { PageDocument } from '@academia/page-schema'
import { validatePageDocument } from '@academia/section-schemas'
import { publicGet } from '@/lib/api-server'

export type HomeData = Omit<PublicHome, 'document'> & { document: PageDocument | null }

/**
 * Home pública: documento publicado + vitrines atuais. Um documento publicado que deixou de passar na
 * validação (schema evoluiu) não derruba o site: cai no template original e o erro vai para o log.
 */
export async function loadHome(): Promise<HomeData> {
  const raw = await publicGet<unknown>('/home', ['home', 'professionals', 'courses'])
  const home = publicHomeSchema.parse(raw ?? { version: null, document: null, professionals: [], courses: [] })
  let document: PageDocument | null = null
  if (home.document) {
    const result = validatePageDocument(home.document)
    if (result.ok) document = result.document
    else console.error('Home publicada inválida; usando o template original', result.errors.slice(0, 5))
  }
  return { ...home, document }
}
