import { NextResponse } from 'next/server'

// Sempre fresco: é o alvo do monitor de disponibilidade.
export const dynamic = 'force-dynamic'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3333'
const NO_STORE = { 'cache-control': 'no-store' }

/**
 * Saúde do site, em dois níveis:
 * - `/healthz` (padrão): o processo do site está de pé. É o que o App Service usa para decidir reiniciar a instância:
 *   não pode depender da API, senão uma queda da API faria o Azure reiniciar o site sem necessidade.
 * - `/healthz?deep=1`: também confere a API (e, por ela, o banco). Use em monitores e testes de disponibilidade.
 * Não expõe versões, nomes de host nem detalhes de erro.
 */
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get('deep') !== '1') return NextResponse.json({ status: 'ok' }, { headers: NO_STORE })
  try {
    const res = await fetch(`${API_ORIGIN}/health`, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    if (res.ok) return NextResponse.json({ status: 'ok', api: 'ok' }, { headers: NO_STORE })
  } catch {
    // cai no 503 abaixo
  }
  return NextResponse.json({ status: 'unavailable', api: 'unavailable' }, { status: 503, headers: NO_STORE })
}
