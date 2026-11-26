import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/api-server'
import { LEGAL_VERSION } from '@academia/contracts'
import { AdminShell } from '../shell'
import { TermsGate } from '../terms-gate'

export const dynamic = 'force-dynamic'

/** Toda rota sob (protected) exige sessão válida; a verificação é feita no servidor a cada requisição. */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  // Troca de senha ou 2FA pendentes: só a conta funciona (a API recusa o resto com 403).
  if (user.mustChangePassword || user.twoFactorRequired) redirect('/admin/conta')
  // Termos e Política (D-041): até aceitar a versão vigente, o aceite aparece no lugar das telas.
  if (user.termsAcceptedVersion !== LEGAL_VERSION) {
    return <AdminShell user={user} restricted><TermsGate firstName={(user.fullName ?? '').split(' ')[0] ?? ''} /></AdminShell>
  }
  return <AdminShell user={user}>{children}</AdminShell>
}
