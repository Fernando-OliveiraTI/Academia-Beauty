import type { Metadata } from 'next'

// Todo o painel é renderizado a cada requisição: o CSP com nonce (src/proxy.ts) só funciona em páginas dinâmicas.
export const dynamic = 'force-dynamic'

// O painel nunca é indexado, mesmo com a indexação do site liberada (as páginas filhas herdam).
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
