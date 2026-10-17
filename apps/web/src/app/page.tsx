import type { Metadata } from 'next'
import { NO_OFFER, PageRenderer, resolveHomeDocument } from '@academia/page-renderer'
import { loadHome } from '@/lib/home-data'
import '@academia/page-renderer/home.css'

export const metadata: Metadata = {
  title: 'Academia Beauty',
  description: 'Aprenda e cresça com os melhores: cursos online com grandes profissionais da beleza.',
}

// Renderizada por requisição (não no build, que não tem API); os dados vêm do cache de fetch por tag.
export const dynamic = 'force-dynamic'

// Home publicada no editor (ou o template original) com as vitrines de profissionais e cursos sempre do catálogo.
export default async function HomePage() {
  const home = await loadHome()
  const document = resolveHomeDocument({ document: home.document, professionals: home.professionals, courses: home.courses })
  return <PageRenderer document={document} ctx={{ offer: NO_OFFER, year: new Date().getFullYear() }} />
}
