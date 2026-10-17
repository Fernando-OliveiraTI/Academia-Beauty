import type { Metadata } from 'next'
import { PageRenderer, homeOriginalTemplate } from '@academia/page-renderer'
import { previewCourseOffer } from '@/lib/fixtures'
import '@academia/page-renderer/home.css'

export const metadata: Metadata = {
  title: 'Academia Beauty',
  description: 'Aprenda e cresça com os melhores: cursos online com grandes profissionais da beleza.',
  robots: { index: false, follow: false },
}

// Pré-visualização do template "Home Original". A rota pública "/" vem com o CMS (Fase 7).
export default function HomePreviewPage() {
  return <PageRenderer document={homeOriginalTemplate} ctx={{ offer: previewCourseOffer, year: new Date().getFullYear() }} />
}
