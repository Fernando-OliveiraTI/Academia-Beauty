import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import type { PageDocument } from '@academia/page-schema'
import { courseCardSchema, professionalDataSchema, type AdminProfessional, type DocumentState } from '@academia/contracts'
import { z } from 'zod'
import { LivePreview } from '@/components/live-preview'
import { adminGet, getCurrentUser, publicGet } from '@/lib/api-server'
import '@academia/page-renderer/professional.css'

export const metadata: Metadata = { title: 'Pré-visualização ao vivo', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** Quadro do editor: renderiza o documento recebido por postMessage com o mesmo renderer do site. */
export default async function ProfessionalLivePreview({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.permissions.includes('professionals.read')) notFound()
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const [{ data: professional }, { data: state }] = await Promise.all([
    adminGet<AdminProfessional>(`/admin/professionals/${id}`),
    adminGet<DocumentState>(`/admin/professionals/${id}/document`),
  ])
  if (!professional || !state) notFound()
  const published = await publicGet<{ courses?: unknown }>(`/professionals/${encodeURIComponent(professional.slug)}`, ['professionals', `professional:${professional.slug}`])
  const courseCards = z.array(courseCardSchema).catch([]).parse(published?.courses ?? [])
  return <LivePreview kind="professional" initial={(state.document ?? null) as PageDocument | null} data={professionalDataSchema.parse(professional.data)} courseCards={courseCards} templateKey={state.templateKey} />
}
