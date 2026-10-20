import { getCurrentUser } from '@/lib/api-server'
import { AccountPanels } from './account-panels'

export const metadata = { title: 'Minha conta' }

export default async function AccountPage() {
  const user = (await getCurrentUser())!
  return (
    <main>
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Segurança</p>
          <h1>Minha conta</h1>
          <p>{user.fullName ? `${user.fullName} · ` : ''}{user.email}</p>
        </div>
      </section>
      {user.mustChangePassword ? <p role="alert" className="wz-alert">Defina uma senha nova para liberar o painel.</p> : null}
      {user.twoFactorRequired ? <p role="alert" className="wz-alert">Este painel exige a verificação em duas etapas: ative-a abaixo para continuar.</p> : null}
      <AccountPanels twoFactorEnabled={user.twoFactorEnabled} mustChangePassword={user.mustChangePassword} />
    </main>
  )
}
