import type { Metadata } from 'next'
import './fonts.css'
import './globals.css'
import { indexingEnabled, siteUrl } from '@/lib/site'

// Avaliado a cada requisição das rotas dinâmicas (Home, ISR, painel): `SITE_URL`/`SITE_INDEXING` vêm do ambiente
// de execução. Sem configuração o site inteiro fica `noindex`; o painel e as pré-visualizações são sempre `noindex`.
export function generateMetadata(): Metadata {
  const base = siteUrl()
  const index = indexingEnabled()
  return {
    metadataBase: base ? new URL(base) : undefined,
    title: { default: 'Academia Beauty', template: '%s · Academia Beauty' },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
