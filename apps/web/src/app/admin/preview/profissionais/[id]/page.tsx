import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import type { PageDocument } from '@academia/page-schema'
import { courseDataSchema, professionalDataSchema, type AdminCourse, type AdminProfessional, type CourseCard, type DocumentState } from '@academia/contracts'
import { NO_OFFER, PageRenderer, resolveProfessionalDocument } from '@academia/page-renderer'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import '@academia/page-renderer/professional.css'

export const metadata: Metadata = { title: 'Pré-visualização', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** Mostra o rascunho exatamente como o renderer público o exibirá. Exige sessão com leitura. */
export default async function ProfessionalDraftPreview({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('professionals.read')) notFound()
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const { data } = await adminGet<AdminProfessional>(`/admin/professionals/${id}`)
  if (!data) notFound()
  const parsed = professionalDataSchema.parse(data.data)
  const { data: state } = await adminGet<DocumentState>(`/admin/professionals/${id}/document`)
  const draftDocument = (state?.document ?? null) as PageDocument | null
  // Cursos do profissional na vitrine (rascunhos incluídos): a prévia mostra como a página ficará quando forem publicados.
  const { data: list } = await adminGet<{ items: AdminCourse[] }>(`/admin/courses?professionalId=${id}&perPage=100`)
  const courseCards: CourseCard[] = (list?.items ?? [])
    .filter((c) => c.status !== 'archived' && c.showcaseVisible)
    .sort((a, b) => a.showcaseOrder - b.showcaseOrder || a.slug.localeCompare(b.slug))
    .slice(0, 12)
    .map((c) => {
      const course = courseDataSchema.parse(c.data)
      return { slug: c.slug, title: course.title, coverSrc: course.coverSrc, coverAlt: course.coverAlt, discountPct: c.commercial?.discountPct ?? 0 }
    })
  const document = resolveProfessionalDocument({ data: parsed, document: draftDocument, courseCards, templateKey: data.templateKey })
  return <PageRenderer document={document} ctx={{ offer: NO_OFFER, year: new Date().getFullYear() }} />
}
