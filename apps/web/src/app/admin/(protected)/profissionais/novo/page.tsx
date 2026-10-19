import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/api-server'
import { ProfessionalTemplateGallery } from './gallery'

export const metadata = { title: 'Novo profissional' }
export const dynamic = 'force-dynamic'

export default async function NewProfessionalPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('professionals.write')) redirect('/admin/profissionais')
  return (
    <main>
      <p className="admin-eyebrow">Novo profissional</p>
      <h1>Escolha um template.</h1>
      <p className="tpl-lead">Os templates preservam a identidade da Academia e limitam alterações que comprometeriam a responsividade. Ao escolher, você segue direto para o editor.</p>
      <ProfessionalTemplateGallery />
    </main>
  )
}
