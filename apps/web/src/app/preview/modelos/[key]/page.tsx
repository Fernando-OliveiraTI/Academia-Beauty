import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { PROFESSIONAL_TEMPLATES, PageRenderer, buildProfessionalDocument, isProfessionalTemplate } from '@academia/page-renderer'
import { previewCourseCards, previewCourseOffer, previewProfessional } from '@/lib/fixtures'
import '@academia/page-renderer/professional.css'

export const viewport: Viewport = { themeColor: '#050505' }

export function generateStaticParams() {
  return PROFESSIONAL_TEMPLATES.map((t) => ({ key: t.key }))
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params
  const label = PROFESSIONAL_TEMPLATES.find((t) => t.key === key)?.label ?? 'Modelo'
  return { title: `Modelo ${label}`, robots: { index: false, follow: false } }
}

// Exemplo de cada modelo de página do Profissional, com os dados de Lukas Campos (para escolher o modelo no cadastro).
export default async function TemplatePreviewPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!isProfessionalTemplate(key)) notFound()
  const document = buildProfessionalDocument(previewProfessional, { courseCards: previewCourseCards, templateKey: key })
  return <PageRenderer document={document} ctx={{ offer: previewCourseOffer, year: new Date().getFullYear() }} />
}
