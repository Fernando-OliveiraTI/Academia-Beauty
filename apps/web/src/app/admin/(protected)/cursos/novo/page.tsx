import { redirect } from 'next/navigation'
import type { AdminProfessional } from '@academia/contracts'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { CourseTemplateGallery } from './gallery'

export const metadata = { title: 'Novo curso' }
export const dynamic = 'force-dynamic'

export default async function NewCoursePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('courses.write')) redirect('/admin/cursos')
  const { data } = await adminGet<{ items: AdminProfessional[] }>('/admin/professionals?perPage=100')
  const professionals = (data?.items ?? []).map((p) => ({ id: p.id, name: p.data.name, photo: p.data.cardPhotoSrc || p.data.portraitSrc, specialty: p.data.specialty }))
  return (
    <main>
      <p className="admin-eyebrow">Novo curso</p>
      <h1>Escolha um template.</h1>
      <p className="tpl-lead">Os templates preservam a identidade da Academia e limitam alterações que comprometeriam a responsividade. Ao escolher, você segue direto para o editor.</p>
      {professionals.length === 0 ? (
        <p role="status">Cadastre um profissional antes de criar um curso.</p>
      ) : (
        <CourseTemplateGallery professionals={professionals} />
      )}
    </main>
  )
}
