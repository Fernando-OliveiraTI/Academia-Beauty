import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'

const TAG = /^[a-z0-9:_-]{1,100}$/

function secretMatches(received: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET
  if (!expected || expected.length < 24 || !received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Chamado pela API depois de publicar/despublicar. Protegido por segredo compartilhado. */
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get('x-revalidate-secret'))) {
    return Response.json({ message: 'Não autorizado' }, { status: 401 })
  }
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null
  const tags = Array.isArray(body?.tags) ? body.tags : []
  if (tags.length === 0 || tags.length > 20 || !tags.every((t) => typeof t === 'string' && TAG.test(t))) {
    return Response.json({ message: 'Tags inválidas' }, { status: 400 })
  }
  for (const tag of tags as string[]) revalidateTag(tag, { expire: 0 }) // expira já: 'max' serviria o conteúdo antigo enquanto revalida
  return Response.json({ revalidated: tags })
}
