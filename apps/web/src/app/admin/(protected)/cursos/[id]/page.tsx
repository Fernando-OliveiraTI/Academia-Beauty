import { notFound, redirect } from 'next/navigation'
import type { AdminCourse, ReadinessIssue } from '@academia/contracts'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { CourseWizard } from '../wizard'

export const metadata = { title: 'Editar curso' }
export const dynamic = 'force-dynamic'

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const { data, status } = await adminGet<AdminCourse & { readiness: ReadinessIssue[] }>(`/admin/courses/${id}`)
  if (status === 404) notFound()
  if (!data) return <main><p role="alert" className="form-error">Não foi possível carregar o curso (código {status}).</p></main>
  return (
    <main>
      <p className="admin-eyebrow">Curso · {data.professionalName}</p>
      <h1>{data.data.title}</h1>
      <CourseWizard initial={data} professionals={[{ id: data.professionalId, name: data.professionalName }]} permissions={user.permissions} />
    </main>
  )
}
