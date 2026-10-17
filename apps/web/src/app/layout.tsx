import type { Metadata } from 'next'
import './fonts.css'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Academia Beauty', template: '%s · Academia Beauty' },
  robots: { index: false, follow: false }, // o site público assume a indexação na Fase 2
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
