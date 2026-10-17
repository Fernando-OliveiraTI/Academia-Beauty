import { getCurrentUser } from '@/lib/api-server'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const user = await getCurrentUser()
  return (
    <main>
      <p className="admin-eyebrow">Dashboard</p>
      <h1>Olá, {user?.fullName ?? user?.email}</h1>
      <section className="admin-card" aria-label="Acesso">
        <p>Papéis: {user?.roles.join(', ')}</p>
        <p>Os indicadores aparecem aqui quando houver dados suficientes.</p>
      </section>
    </main>
  )
}
