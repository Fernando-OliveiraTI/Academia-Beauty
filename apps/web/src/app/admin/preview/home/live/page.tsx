import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import type { PageDocument } from '@academia/page-schema'
import type { DocumentState } from '@academia/contracts'
import { LivePreview } from '@/components/live-preview'
import { adminGet, getCurrentUser } from '@/lib/api-server'
import { loadHome } from '@/lib/home-data'
import '@academia/page-renderer/home.css'

export const metadata: Metadata = { title: 'Pré-visualização ao vivo', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** Quadro do editor da Home: renderiza o documento recebido por postMessage com o mesmo renderer do site. */
export default async function HomeLivePreview() {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('pages.read')) notFound()
  const [{ data: state }, home] = await Promise.all([adminGet<DocumentState>('/admin/home/document'), loadHome()])
  if (!state) notFound()
  return <LivePreview kind="home" initial={(state.document ?? null) as PageDocument | null} professionals={home.professionals} courses={home.courses} />
}
