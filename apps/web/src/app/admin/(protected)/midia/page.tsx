import { redirect } from 'next/navigation'
import { MediaLibrary } from '@/components/media-library'
import { getCurrentUser } from '@/lib/api-server'

export const metadata = { title: 'Mídia' }
export const dynamic = 'force-dynamic'

export default async function MediaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('media.manage')) {
    return <main><h1>Mídia</h1><p>Você não tem permissão para ver este módulo.</p></main>
  }
  return (
    <main>
      <p className="admin-eyebrow">Arquivos</p>
      <div className="admin-title-row"><h1>Biblioteca de mídia</h1></div>
      <p>Envie imagens e vídeos uma vez e use nas páginas pelo botão “Biblioteca” de cada campo. Arquivos em uso não podem ser excluídos.</p>
      <MediaLibrary mode="manage" />
    </main>
  )
}
