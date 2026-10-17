import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { PageDocument } from '@academia/page-schema'
import { validatePageDocument } from '@academia/section-schemas'
import { courseCardSchema, professionalDataSchema, publishReadiness, type AdminProfessional, type DocumentState, type DocumentVersion } from '@academia/contracts'
import { resolveProfessionalDocument } from '@academia/page-renderer'
import { z } from 'zod'
import { adminGet, getCurrentUser, publicGet } from '@/lib/api-server'
import { Editor } from '../../editor'

export const metadata = { title: 'Editor visual' }
export const dynamic = 'force-dynamic'

export default async function ProfessionalEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('professionals.read')) return <main><h1>Editor visual</h1><p>Você não tem permissão para ver este módulo.</p></main>
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const [{ data: professional, status }, { data: state }, { data: versions }] = await Promise.all([
    adminGet<AdminProfessional>(`/admin/professionals/${id}`),
    adminGet<DocumentState>(`/admin/professionals/${id}/document`),
    adminGet<{ items: DocumentVersion[] }>(`/admin/professionals/${id}/document/versions`),
  ])
  if (status === 404) notFound()
  if (!professional || !state) return <main><p role="alert" className="form-error">Não foi possível carregar o editor (código {status}).</p></main>

  const data = professionalDataSchema.parse(professional.data)
  const back = `/admin/profissionais/${id}`
  const issues = publishReadiness(data)
  if (!state.document && issues.length) {
    return (
      <main>
        <h1>Complete o cadastro para abrir o editor</h1>
        <ul>{issues.map((m) => <li key={m.field}>{m.message}</li>)}</ul>
        <Link className="admin-button secondary" href={back}>Voltar ao cadastro</Link>
      </main>
    )
  }
  const published = await publicGet<{ courses?: unknown }>(`/professionals/${encodeURIComponent(professional.slug)}`, ['professionals', `professional:${professional.slug}`])
  const courseCards = z.array(courseCardSchema).catch([]).parse(published?.courses ?? [])

  const library = resolveProfessionalDocument({ data, courseCards, templateKey: state.templateKey })
  const initial = resolveProfessionalDocument({ data, document: state.document as PageDocument | null, courseCards, templateKey: state.templateKey })
  if (!validatePageDocument(initial).ok) {
    return <main><p role="alert" className="form-error">O documento salvo desta página está inválido. Use “Restaurar do cadastro” pelo painel ou contate o suporte.</p><Link href={back}>Voltar</Link></main>
  }
  return (
    <Editor
      kind="professional" id={Number(id)} title={data.name} status={professional.status}
      initial={initial} library={library} documentRevision={state.documentRevision} cadastroRevision={state.revision} templateKey={state.templateKey}
      canWrite={user.permissions.includes('professionals.write')} canPublish={user.permissions.includes('professionals.publish')}
      versions={versions?.items ?? []} dynamicTypes={['professional.courses']} backHref={back}
    />
  )
}
