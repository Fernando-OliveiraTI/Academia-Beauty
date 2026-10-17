import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { meSchema, type Me } from '@academia/contracts'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3333'

/** Consulta a sessão atual na API repassando o cookie do navegador. Retorna null se não autenticado. */
export const getCurrentUser = cache(async (): Promise<Me | null> => {
  const jar = await cookies()
  const cookieHeader = jar.getAll().map((c) => `${c.name}=${c.value}`).join('; ')
  if (!cookieHeader) return null
  try {
    const res = await fetch(`${API_ORIGIN}/auth/me`, { headers: { cookie: cookieHeader }, cache: 'no-store' })
    if (!res.ok) return null
    return meSchema.parse(await res.json())
  } catch {
    return null
  }
})

/** GET autenticado no admin da API repassando o cookie da sessão. Nunca cacheado. */
export async function adminGet<T>(path: string): Promise<{ status: number; data: T | null }> {
  const jar = await cookies()
  const cookieHeader = jar.getAll().map((c) => `${c.name}=${c.value}`).join('; ')
  if (!cookieHeader) return { status: 401, data: null }
  try {
    const res = await fetch(`${API_ORIGIN}${path}`, { headers: { cookie: cookieHeader, accept: 'application/json' }, cache: 'no-store' })
    return { status: res.status, data: res.ok ? ((await res.json()) as T) : null }
  } catch {
    return { status: 0, data: null }
  }
}

/** Revalidação por tempo como rede de segurança caso a invalidação por tag falhe. */
export const PUBLIC_REVALIDATE_SECONDS = 300

/**
 * GET público com cache por tag (invalidado pela API ao publicar). 404 → null; outros erros lançam.
 * `force-cache` é obrigatório: sem ele, páginas dinâmicas não cacheiam o fetch (Next 16) e a tag não tem efeito.
 */
export async function publicGet<T>(path: string, tags: string[]): Promise<T | null> {
  const res = await fetch(`${API_ORIGIN}/public${path}`, { cache: 'force-cache', next: { tags, revalidate: PUBLIC_REVALIDATE_SECONDS }, headers: { accept: 'application/json' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`API pública respondeu ${res.status} em ${path}`)
  return (await res.json()) as T
}
