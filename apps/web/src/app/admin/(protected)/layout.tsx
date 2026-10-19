import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/api-server'
import { LogoutButton } from './logout-button'
import { NavLink } from './nav-link'

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
          <NavLink href="/admin">Dashboard</NavLink>
          {user.permissions.includes('professionals.read') ? <NavLink href="/admin/profissionais">Profissionais</NavLink> : null}
          {user.permissions.includes('courses.read') ? <NavLink href="/admin/cursos">Cursos</NavLink> : null}
          {user.permissions.includes('pages.read') ? <NavLink href="/admin/editor/home">Home</NavLink> : null}
          {user.permissions.includes('media.manage') ? <NavLink href="/admin/midia">Mídia</NavLink> : null}
        </nav>
        <div className="admin-user">
          <span className="admin-user-name"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.500" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>{user.fullName ?? user.email}</span>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  )
}
