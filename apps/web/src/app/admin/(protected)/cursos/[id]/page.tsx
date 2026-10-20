import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { AdminCourse, ReadinessIssue } from '@academia/contracts'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { WizardHeader } from '@/components/wizard-ui'
import { CourseWizard } from '../wizard'

export const metadata = { title: 'Editar curso' }
export const dynamic = 'force-dynamic'

export default async function EditCoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pendencias?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  const { id } = await params
  const pendencias = (await searchParams).pendencias === '1'
  if (!/^\d+$/.test(id)) notFound()
  const { data, status } = await adminGet<AdminCourse & { readiness: ReadinessIssue[] }>(`/admin/courses/${id}`)
  if (status === 404) notFound()
  if (!data) return <main><p role="alert" className="form-error">Não foi possível carregar o curso (código {status}).</p></main>
  return (
    <main>
      <WizardHeader
        backHref="/admin/cursos" backLabel="Cursos" title={data.data.title}
        subtitle={`Configurações do curso · ${data.professionalName}. O conteúdo da página é editado no editor visual.`}
        action={<Link className="admin-button" href={`/admin/editor/cursos/${id}`}>Abrir no editor visual</Link>}
      />
      <CourseWizard initial={data} professionals={[{ id: data.professionalId, name: data.professionalName }]} permissions={user.permissions} initialStep={pendencias ? 4 : 0} showPending={pendencias} />
    </main>
  )
}
