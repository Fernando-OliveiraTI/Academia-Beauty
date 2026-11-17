import { redirect } from 'next/navigation'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { UsersManager, type UserRow } from './users-manager'

export const metadata = { title: 'Usuários' }

export default async function UsersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('users.manage')) {
    return <main><h1>Usuários</h1><p>Só administradores gerenciam usuários.</p></main>
  }
  const [{ data, status }, { data: pros }] = await Promise.all([
    adminGet<{ items: UserRow[] }>('/admin/users'),
    adminGet<{ items: { id: number; data: { name: string; specialty?: string; cardPhotoSrc?: string; portraitSrc?: string } }[] }>('/admin/professionals?perPage=100&sort=name'),
  ])
  const professionals = (pros?.items ?? []).map((p) => ({ id: p.id, name: p.data.name, specialty: p.data.specialty ?? '', photo: p.data.cardPhotoSrc || p.data.portraitSrc || '' }))
  return (
    <main>
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Acesso</p>
          <h1>Usuários</h1>
          <p>Quem entra no painel, com qual papel e se a verificação em duas etapas está ativa. Toda alteração fica registrada na auditoria.</p>
        </div>
      </section>
      {data
        ? <UsersManager items={data.items} currentUserId={user.id} professionals={professionals} />
        : <p role="alert" className="form-error">Não foi possível carregar os usuários (código {status}). Tente recarregar a página.</p>}
    </main>
  )
}
