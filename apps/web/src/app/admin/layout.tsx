// Todo o painel é renderizado a cada requisição: o CSP com nonce (src/proxy.ts) só funciona em páginas dinâmicas.
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
