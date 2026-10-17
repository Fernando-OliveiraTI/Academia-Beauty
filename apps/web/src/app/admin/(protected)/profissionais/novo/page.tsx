import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/api-server'
import { ProfessionalWizard } from '../wizard'

export const metadata = { title: 'Novo profissional' }
export const dynamic = 'force-dynamic'

export default async function NewProfessionalPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('professionals.write')) redirect('/admin/profissionais')
  return (
    <main>
      <p className="admin-eyebrow">Novo profissional</p>
      <h1>Cadastrar profissional</h1>
      <ProfessionalWizard permissions={user.permissions} />
    </main>
  )
}
