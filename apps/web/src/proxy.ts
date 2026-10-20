import { NextResponse, type NextRequest } from 'next/server'
import { buildCsp, FRAMED_ADMIN_PATH, hostList } from '@/lib/csp'

/**
 * CSP com nonce por requisição para o painel (/admin/*). O nonce vai no cabeçalho da requisição para o Next marcar os
 * scripts e estilos que gera. O site público não passa por aqui (ver `matcher` e a CSP estática do next.config.ts).
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const framed = FRAMED_ADMIN_PATH.test(request.nextUrl.pathname)
  const csp = buildCsp({
    nonce,
    frameAncestors: framed ? "'self'" : "'none'",
    isDev: process.env.NODE_ENV !== 'production',
    mediaHosts: hostList(process.env.MEDIA_CDN_HOST),
    checkoutHosts: hostList(process.env.CHECKOUT_ALLOWED_HOSTS, true),
  })

  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      source: '/admin/:path*',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
