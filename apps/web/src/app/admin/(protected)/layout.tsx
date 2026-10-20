import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/api-server'
import { AdminShell } from '../shell'

export const dynamic = 'force-dynamic'

/** Toda rota sob (protected) exige sessão válida; a verificação é feita no servidor a cada requisição. */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  // Troca de senha ou 2FA pendentes: só a conta funciona (a API recusa o resto com 403).
  if (user.mustChangePassword || user.twoFactorRequired) redirect('/admin/conta')
  return <AdminShell user={user}>{children}</AdminShell>
}
