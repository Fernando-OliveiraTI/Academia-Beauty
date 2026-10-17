import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/api-server'
import { LoginForm } from './login-form'

export const metadata = { title: 'Entrar' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/admin')
  return (
    <main className="login-wrap">
      <div className="login-card">
        <div>
          <p className="admin-eyebrow">Academia Beauty</p>
          <h1>Painel administrativo</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
