import type { Metadata, Viewport } from 'next'
import { notFound, redirect } from 'next/navigation'
import type { PageDocument } from '@academia/page-schema'
import { computeOffer, courseDataSchema, professionalDataSchema, type AdminCourse, type AdminProfessional, type DocumentState } from '@academia/contracts'
import { LivePreview } from '@/components/live-preview'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { previewCheckout } from '@/lib/preview-checkout'
import '@academia/page-renderer/course.css'

export const metadata: Metadata = { title: 'Pré-visualização ao vivo', robots: { index: false, follow: false } }
export const viewport: Viewport = { themeColor: '#0b0a09' }
export const dynamic = 'force-dynamic'

/** Valores de exemplo só para o quadro do editor enquanto o curso não tem oferta (nada disso é publicado). */
const SAMPLE_OFFER = { listCents: 29700, discountPct: 0, maxInstallments: 1 }

/** Quadro do editor de curso. A oferta vem do backend; os botões de compra ficam desativados. */
export default async function CourseLivePreview({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('courses.read') || !user.permissions.includes('professionals.read')) notFound()
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const { data: course } = await adminGet<AdminCourse>(`/admin/courses/${id}`)
  if (!course) notFound()
  const [{ data: professional }, { data: state }] = await Promise.all([
    adminGet<AdminProfessional>(`/admin/professionals/${course.professionalId}`),
    adminGet<DocumentState>(`/admin/courses/${id}/document`),
  ])
  if (!professional || !state) notFound()
  return (
    <LivePreview
      kind="course"
      initial={(state.document ?? null) as PageDocument | null}
      data={courseDataSchema.parse(course.data)}
      professional={professionalDataSchema.parse(professional.data)}
      offer={computeOffer(course.commercial ?? SAMPLE_OFFER)}
      checkout={previewCheckout(course.commercial)}
    />
  )
}
