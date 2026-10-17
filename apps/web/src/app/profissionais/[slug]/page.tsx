import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { publicProfessionalSchema } from '@academia/contracts'
import { NO_OFFER, PageRenderer, resolveProfessionalDocument } from '@academia/page-renderer'
import type { PageDocument } from '@academia/page-schema'
import { publicGet } from '@/lib/api-server'
import '@academia/page-renderer/professional.css'

type Params = { params: Promise<{ slug: string }> }

/** Slug fora do formato nunca vai à API nem vira tag/chave de cache. */
const SLUG = /^[a-z0-9-]{3,80}$/

// ISR: a rota é gerada sob demanda e cacheada; a invalidação por tag (publicar) e o prazo abaixo renovam a página.
export const revalidate = 300
export async function generateStaticParams() {
  return []
}

async function load(slug: string) {
  if (!SLUG.test(slug)) return null
  const raw = await publicGet<unknown>(`/professionals/${encodeURIComponent(slug)}`, ['professionals', `professional:${slug}`])
  if (!raw) return null
  return publicProfessionalSchema.parse(raw)
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const professional = await load(slug)
  if (!professional) return { title: 'Profissional não encontrado' }
  const { name, tagline, metaDescription } = professional.data
  return { title: `${name} · Academia Beauty`, description: metaDescription || tagline || undefined }
}

// Página servida do snapshot publicado; atualizada por tag quando o admin publica.
export default async function ProfessionalPage({ params }: Params) {
  const { slug } = await params
  const professional = await load(slug)
  if (!professional) notFound()
  // `document` nulo = página derivada do cadastro; com documento do editor, os cursos publicados são reinjetados.
  const document = resolveProfessionalDocument({ data: professional.data, document: professional.document as PageDocument | null, courseCards: professional.courses })
  return <PageRenderer document={document} ctx={{ offer: NO_OFFER, year: new Date().getFullYear() }} />
}
