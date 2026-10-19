import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { AdminProfessional, ReadinessIssue } from '@academia/contracts'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { WizardHeader } from '@/components/wizard-ui'
import { ProfessionalWizard } from '../wizard'

export const metadata = { title: 'Editar profissional' }
export const dynamic = 'force-dynamic'

export default async function EditProfessionalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pendencias?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  const { id } = await params
  const pendencias = (await searchParams).pendencias === '1'
  if (!/^\d+$/.test(id)) notFound()
  const { data, status } = await adminGet<AdminProfessional & { readiness: ReadinessIssue[] }>(`/admin/professionals/${id}`)
  if (status === 404) notFound()
  if (!data) return <main><p role="alert" className="form-error">Não foi possível carregar o cadastro (código {status}).</p></main>
  return (
    <main>
      <WizardHeader
        backHref="/admin/profissionais" backLabel="Profissionais" title={data.data.name}
        subtitle="Configurações do profissional. O conteúdo da página é editado no editor visual."
        action={<Link className="admin-button" href={`/admin/editor/profissionais/${id}`}>Abrir no editor visual</Link>}
      />
      {pendencias ? <p role="alert" className="wz-alert">Faltam informações para publicar. Complete os itens abaixo e volte ao editor para publicar.</p> : null}
      <ProfessionalWizard initial={data} permissions={user.permissions} initialStep={pendencias ? 4 : 0} />
    </main>
  )
}
