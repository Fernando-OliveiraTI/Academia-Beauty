import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/api-server'
import { LogoutButton } from './logout-button'

export const dynamic = 'force-dynamic'

/** Toda rota sob (protected) exige sessão válida; a verificação é feita no servidor a cada requisição. */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">ACADEMIA <span>BEAUTY</span></div>
        <nav className="admin-nav" aria-label="Painel">
          <Link href="/admin">Dashboard</Link>
          {user.permissions.includes('professionals.read') ? <Link href="/admin/profissionais">Profissionais</Link> : null}
          {user.permissions.includes('courses.read') ? <Link href="/admin/cursos">Cursos</Link> : null}
        </nav>
        <div className="admin-user">
          <span>{user.fullName ?? user.email}</span>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  )
}
