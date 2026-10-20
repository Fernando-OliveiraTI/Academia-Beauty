import Link from 'next/link'
import type { Me } from '@academia/contracts'
import { LogoutButton } from './logout-button'
import { NavLink } from './nav-link'

/**
 * Moldura do painel (menu + usuário). Com `restricted` (troca de senha ou 2FA pendentes) só a conta fica acessível:
 * as demais rotas da API respondem 403 até a pendência ser resolvida.
 */
export function AdminShell({ user, restricted = false, children }: { user: Me; restricted?: boolean; children: React.ReactNode }) {
  const can = (permission: Me['permissions'][number]) => !restricted && user.permissions.includes(permission)
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">ACADEMIA <span>BEAUTY</span></div>
        <nav className="admin-nav" aria-label="Painel">
          {restricted ? null : <NavLink href="/admin">Dashboard</NavLink>}
          {can('professionals.read') ? <NavLink href="/admin/profissionais">Profissionais</NavLink> : null}
          {can('courses.read') ? <NavLink href="/admin/cursos">Cursos</NavLink> : null}
          {can('pages.read') ? <NavLink href="/admin/editor/home">Home</NavLink> : null}
          {can('media.manage') ? <NavLink href="/admin/midia">Mídia</NavLink> : null}
          {can('users.manage') ? <NavLink href="/admin/checkouts">Checkouts</NavLink> : null}
          {can('users.manage') ? <NavLink href="/admin/webhooks/themembers">Webhooks</NavLink> : null}
          {can('users.manage') ? <NavLink href="/admin/usuarios">Usuários</NavLink> : null}
        </nav>
        <div className="admin-user">
          <Link className="admin-user-name" href="/admin/conta" title="Minha conta" aria-label="Minha conta"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.500" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>{user.fullName ?? user.email}</Link>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  )
}
