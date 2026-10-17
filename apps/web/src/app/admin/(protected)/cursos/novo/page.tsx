import { redirect } from 'next/navigation'
import type { AdminProfessional } from '@academia/contracts'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { CourseWizard } from '../wizard'

export const metadata = { title: 'Novo curso' }
export const dynamic = 'force-dynamic'

export default async function NewCoursePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('courses.write')) redirect('/admin/cursos')
  const { data } = await adminGet<{ items: AdminProfessional[] }>('/admin/professionals?perPage=100')
  const professionals = (data?.items ?? []).map((p) => ({ id: p.id, name: p.data.name }))
  return (
    <main>
      <p className="admin-eyebrow">Novo curso</p>
      <h1>Cadastrar curso</h1>
      {professionals.length === 0 ? <p role="status">Cadastre um profissional antes de criar um curso.</p> : null}
      <CourseWizard professionals={professionals} permissions={user.permissions} />
    </main>
  )
}
