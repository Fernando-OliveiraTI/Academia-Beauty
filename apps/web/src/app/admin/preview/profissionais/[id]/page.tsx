import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import type { PageDocument } from '@academia/page-schema'
import { professionalDataSchema, publishReadiness, type AdminProfessional, type DocumentState } from '@academia/contracts'
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
  // Com documento do editor a página não depende do cadastro estar completo; sem ele, o renderer exige.
  const missing = draftDocument ? [] : publishReadiness(parsed)
  if (missing.length) {
    // O renderer recusa documentos incompletos; a pré-visualização explica o que falta.
    return (
      <main className="admin-shell">
        <p className="admin-eyebrow">Pré-visualização indisponível</p>
        <h1>Complete o cadastro para visualizar</h1>
        <ul>{missing.map((m) => <li key={m.field}>{m.message}</li>)}</ul>
      </main>
    )
  }
  const document = resolveProfessionalDocument({ data: parsed, document: draftDocument })
  return <PageRenderer document={document} ctx={{ offer: NO_OFFER, year: new Date().getFullYear() }} />
}
