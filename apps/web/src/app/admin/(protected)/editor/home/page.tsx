import { redirect } from 'next/navigation'
import type { PageDocument } from '@academia/page-schema'
import { validatePageDocument } from '@academia/section-schemas'
import type { AdminHome, DocumentState, DocumentVersion } from '@academia/contracts'
import { resolveHomeDocument } from '@academia/page-renderer'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { loadHome } from '@/lib/home-data'
import { Editor } from '../editor'

export const metadata = { title: 'Editor da Home' }
export const dynamic = 'force-dynamic'

export default async function HomeEditorPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('pages.read')) return <main><h1>Editor da Home</h1><p>Você não tem permissão para ver este módulo.</p></main>
  const [{ data: admin, status }, { data: state }, { data: versions }, home] = await Promise.all([
    adminGet<AdminHome>('/admin/home'),
    adminGet<DocumentState>('/admin/home/document'),
    adminGet<{ items: DocumentVersion[] }>('/admin/home/document/versions'),
    loadHome(),
  ])
  if (!admin || !state) return <main><p role="alert" className="form-error">Não foi possível carregar o editor (código {status}).</p></main>

  const library = resolveHomeDocument({ professionals: home.professionals, courses: home.courses })
  const initial = resolveHomeDocument({ document: state.document as PageDocument | null, professionals: home.professionals, courses: home.courses })
  if (!validatePageDocument(initial).ok) {
    return <main><p role="alert" className="form-error">O documento salvo da Home está inválido. Use “Restaurar padrão” (pelo histórico) ou contate o suporte.</p></main>
  }
  return (
    <Editor
      kind="home" id={1} title="Home" status={admin.status}
      initial={initial} library={library} documentRevision={state.documentRevision} cadastroRevision={state.revision} templateKey={state.templateKey}
      canWrite={user.permissions.includes('pages.write')} canPublish={user.permissions.includes('pages.publish')}
      versions={versions?.items ?? []} dynamicTypes={['home.professionals', 'home.courses']} backHref="/admin"
    />
  )
}
