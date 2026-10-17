import type { Metadata, Viewport } from 'next'
import { notFound, redirect } from 'next/navigation'
import { computeOffer, courseDataSchema, courseReadiness, professionalDataSchema, type AdminCourse, type AdminProfessional, type DocumentState } from '@academia/contracts'
import type { PageDocument } from '@academia/page-schema'
import { PageRenderer, resolveCourseDocument } from '@academia/page-renderer'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import '@academia/page-renderer/course.css'

export const metadata: Metadata = { title: 'Pré-visualização', robots: { index: false, follow: false } }
export const viewport: Viewport = { themeColor: '#0b0a09' }
export const dynamic = 'force-dynamic'

/** Mostra o rascunho como o renderer público o exibirá. Os botões de compra ficam desativados. */
export default async function CourseDraftPreview({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('courses.read') || !user.permissions.includes('professionals.read')) notFound()
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const { data: course } = await adminGet<AdminCourse>(`/admin/courses/${id}`)
  if (!course) notFound()
  const { data: professional } = await adminGet<AdminProfessional>(`/admin/professionals/${course.professionalId}`)
  if (!professional) notFound()

  const data = courseDataSchema.parse(course.data)
  const { data: state } = await adminGet<DocumentState>(`/admin/courses/${id}/document`)
  const draftDocument = (state?.document ?? null) as PageDocument | null
  const missing = draftDocument ? [] : courseReadiness(data)
  if (missing.length || !course.commercial) {
    // O renderer recusa documentos incompletos; a pré-visualização explica o que falta.
    return (
      <main className="admin-shell">
        <p className="admin-eyebrow">Pré-visualização indisponível</p>
        <h1>Complete o curso para visualizar</h1>
        <ul>
          {missing.map((m) => <li key={m.field}>{m.message}</li>)}
          {!course.commercial ? <li>Configure a oferta (preço) na etapa “Oferta e checkout”</li> : null}
        </ul>
      </main>
    )
  }
  const document = resolveCourseDocument({ data, professional: professionalDataSchema.parse(professional.data), document: draftDocument })
  return (
    <>
      <p role="status" style={{ margin: 0, padding: '8px 16px', background: '#e3c98a', color: '#0b0a09', textAlign: 'center', position: 'relative', zIndex: 100 }}>
        Pré-visualização do rascunho: os botões de compra ficam desativados.
      </p>
      <PageRenderer document={document} ctx={{ offer: computeOffer(course.commercial), year: new Date().getFullYear(), checkout: { mode: 'redirect', url: null } }} />
    </>
  )
}
