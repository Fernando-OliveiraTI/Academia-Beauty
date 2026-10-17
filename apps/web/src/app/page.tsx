import type { Metadata } from 'next'
import { showcaseItemSchema } from '@academia/contracts'
import { NO_OFFER, PageRenderer, buildHomeDocument } from '@academia/page-renderer'
import { z } from 'zod'
import { publicGet } from '@/lib/api-server'
import '@academia/page-renderer/home.css'

export const metadata: Metadata = {
  title: 'Academia Beauty',
  description: 'Aprenda e cresça com os melhores: cursos online com grandes profissionais da beleza.',
}

// Renderizada por requisição (não no build, que não tem API); os dados vêm do cache de fetch por tag.
export const dynamic = 'force-dynamic'

const showcaseResponse = z.object({ items: z.array(showcaseItemSchema) })

// Home com a vitrine de profissionais publicados (atualizada por tag ao publicar).
// Cursos seguem estáticos do template até a Fase 4.
export default async function HomePage() {
  const raw = await publicGet<unknown>('/professionals', ['professionals'])
  const { items } = showcaseResponse.parse(raw ?? { items: [] })
  return <PageRenderer document={buildHomeDocument(items)} ctx={{ offer: NO_OFFER, year: new Date().getFullYear() }} />
}
