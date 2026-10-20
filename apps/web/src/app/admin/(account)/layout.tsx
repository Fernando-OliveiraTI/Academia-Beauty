import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/api-server'
import { AdminShell } from '../shell'

export const dynamic = 'force-dynamic'

/** Conta do próprio usuário: acessível mesmo com troca de senha ou 2FA pendentes. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} restricted={user.mustChangePassword || user.twoFactorRequired}>{children}</AdminShell>
}
