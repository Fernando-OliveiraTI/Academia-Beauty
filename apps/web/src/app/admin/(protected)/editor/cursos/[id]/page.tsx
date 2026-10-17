import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { PageDocument } from '@academia/page-schema'
import { validatePageDocument } from '@academia/section-schemas'
import { courseDataSchema, courseReadiness, professionalDataSchema, type AdminCourse, type AdminProfessional, type DocumentState, type DocumentVersion } from '@academia/contracts'
import { resolveCourseDocument } from '@academia/page-renderer'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { Editor } from '../../editor'

export const metadata = { title: 'Editor visual' }
export const dynamic = 'force-dynamic'

export default async function CourseEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('courses.read') || !user.permissions.includes('professionals.read')) return <main><h1>Editor visual</h1><p>Você não tem permissão para ver este módulo.</p></main>
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const { data: course, status } = await adminGet<AdminCourse>(`/admin/courses/${id}`)
  if (status === 404) notFound()
  if (!course) return <main><p role="alert" className="form-error">Não foi possível carregar o editor (código {status}).</p></main>
  const [{ data: professional }, { data: state }, { data: versions }] = await Promise.all([
    adminGet<AdminProfessional>(`/admin/professionals/${course.professionalId}`),
    adminGet<DocumentState>(`/admin/courses/${id}/document`),
    adminGet<{ items: DocumentVersion[] }>(`/admin/courses/${id}/document/versions`),
  ])
  if (!professional || !state) return <main><p role="alert" className="form-error">Não foi possível carregar o editor.</p></main>

  const data = courseDataSchema.parse(course.data)
  const back = `/admin/cursos/${id}`
  const issues = courseReadiness(data)
  if (!state.document && issues.length) {
    return (
      <main>
        <h1>Complete o curso para abrir o editor</h1>
        <ul>{issues.map((m) => <li key={m.field}>{m.message}</li>)}</ul>
        <Link className="admin-button secondary" href={back}>Voltar ao cadastro</Link>
      </main>
    )
  }
  const pro = professionalDataSchema.parse(professional.data)
  const library = resolveCourseDocument({ data, professional: pro })
  const initial = resolveCourseDocument({ data, professional: pro, document: state.document as PageDocument | null })
  if (!validatePageDocument(initial).ok) {
    return <main><p role="alert" className="form-error">O documento salvo desta página está inválido. Use “Restaurar do cadastro”.</p><Link href={back}>Voltar</Link></main>
  }
  return (
    <Editor
      kind="course" id={Number(id)} title={data.title} status={course.status}
      initial={initial} library={library} documentRevision={state.documentRevision} cadastroRevision={state.revision} templateKey={state.templateKey}
      canWrite={user.permissions.includes('courses.write')} canPublish={user.permissions.includes('courses.publish')}
      versions={versions?.items ?? []} dynamicTypes={[]} backHref={back}
    />
  )
}
