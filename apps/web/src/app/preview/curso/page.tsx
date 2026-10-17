import type { Metadata, Viewport } from 'next'
import { PageRenderer, courseOriginalTemplate } from '@academia/page-renderer'
import { previewCourseOffer } from '@/lib/fixtures'
import '@academia/page-renderer/course.css'

export const metadata: Metadata = {
  title: 'Morena Iluminada',
  description: 'Curso Morena Iluminada com Lukas Campos: a metodologia de corte que valoriza brilho, contraste e luminosidade da coloração.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: '#0b0a09' }

// Pré-visualização do template "Curso Original" com o conteúdo aprovado. A rota pública vem com o CMS (Fase 3).
export default function CoursePreviewPage() {
  return <PageRenderer document={courseOriginalTemplate} ctx={{ offer: previewCourseOffer, year: new Date().getFullYear() }} />
}
