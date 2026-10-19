'use client'

import { Button } from '@academia/design-system'
import { apiPost } from '@/lib/api-client'

export function LogoutButton() {
  async function logout() {
    await apiPost('/auth/logout')
    window.location.assign('/admin/login')
  }
  return <Button variant="secondary" onClick={logout}>Sair</Button>
}
