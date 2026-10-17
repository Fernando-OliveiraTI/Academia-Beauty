import type { Metadata, Viewport } from 'next'
import { PageRenderer, professionalOriginalTemplate } from '@academia/page-renderer'
import { previewCourseOffer } from '@/lib/fixtures'
import '@academia/page-renderer/professional.css'

export const metadata: Metadata = {
  title: 'Lukas Campos',
  description: 'Lukas Campos: trajetória, trabalhos em destaque, apresentação em vídeo e cursos.',
  robots: { index: false, follow: false },
}
export const viewport: Viewport = { themeColor: '#050505' }

// Pré-visualização do template "Profissional Original". A rota pública /profissionais/[slug] vem com o CMS (Fase 3).
export default function ProfessionalPreviewPage() {
  return <PageRenderer document={professionalOriginalTemplate} ctx={{ offer: previewCourseOffer, year: new Date().getFullYear() }} />
}
