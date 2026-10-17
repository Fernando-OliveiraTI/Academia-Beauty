import { notFound, redirect } from 'next/navigation'
import type { AdminProfessional, ReadinessIssue } from '@academia/contracts'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { ProfessionalWizard } from '../wizard'

export const metadata = { title: 'Editar profissional' }
export const dynamic = 'force-dynamic'

export default async function EditProfessionalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const { data, status } = await adminGet<AdminProfessional & { readiness: ReadinessIssue[] }>(`/admin/professionals/${id}`)
  if (status === 404) notFound()
  if (!data) return <main><p role="alert" className="form-error">Não foi possível carregar o cadastro (código {status}).</p></main>
  return (
    <main>
      <p className="admin-eyebrow">Profissional</p>
      <h1>{data.data.name}</h1>
      <ProfessionalWizard initial={data} permissions={user.permissions} />
    </main>
  )
}
