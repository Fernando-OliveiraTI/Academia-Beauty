import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { publicCourseSchema } from '@academia/contracts'
import { PageRenderer, resolveCourseDocument } from '@academia/page-renderer'
import type { PageDocument } from '@academia/page-schema'
import { publicGet } from '@/lib/api-server'
import { PageTracker } from '@/components/page-tracker'
import '@academia/page-renderer/course.css'

type Params = { params: Promise<{ slug: string }> }

export const viewport: Viewport = { themeColor: '#0b0a09' }

/** Slug fora do formato nunca vai à API nem vira tag/chave de cache. */
const SLUG = /^[a-z0-9-]{3,80}$/

// ISR: a rota é gerada sob demanda e cacheada; a invalidação por tag (publicar) e o prazo abaixo renovam a página.
export const revalidate = 300
export async function generateStaticParams() {
  return []
}

async function load(slug: string) {
  if (!SLUG.test(slug)) return null
  const raw = await publicGet<unknown>(`/courses/${encodeURIComponent(slug)}`, ['courses', `course:${slug}`])
  if (!raw) return null
  return publicCourseSchema.parse(raw)
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const course = await load(slug)
  if (!course) return { title: 'Curso não encontrado' }
  const { title, lead, metaDescription } = course.data
  return { title: `${title} · ${course.professional.data.name}`, description: metaDescription || lead || undefined }
}

// Página servida do snapshot publicado (conteúdo + oferta); atualizada por tag quando o admin publica.
// O preço e o link de checkout vêm do backend; a página nunca os calcula nem os recebe do navegador.
export default async function CoursePage({ params }: Params) {
  const { slug } = await params
  const course = await load(slug)
  if (!course) notFound()
  const document = resolveCourseDocument({ data: course.data, professional: course.professional.data, document: course.document as PageDocument | null })
  return (
    <>
      <PageRenderer document={document} ctx={{ offer: course.offer, year: new Date().getFullYear(), checkout: course.checkout.mode === 'embed' ? { ...course.checkout, statusUrl: '/api/public/checkout-status', sessionUrl: '/api/public/checkout-sessions', courseSlug: course.slug } : course.checkout, professional: { slug: course.professional.slug, name: course.professional.data.name } }} />
      <PageTracker type="course" slug={slug} />
    </>
  )
}
