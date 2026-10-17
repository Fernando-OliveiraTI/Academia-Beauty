import type { NextConfig } from 'next'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3333'
const isDev = process.env.NODE_ENV !== 'production'

// CSP do painel e do site. Em dev o Next precisa de 'unsafe-eval' (React refresh); em produção não.
const cspDirectives = (frameAncestors: string) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  `frame-ancestors ${frameAncestors}`,
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const csp = cspDirectives("'none'")
// Só o quadro de pré-visualização do editor pode ser embutido, e apenas pelo próprio site.
const framedCsp = cspDirectives("'self'")
const securityHeaders = (policy: string, frameOptions: string) => [
  { key: 'Content-Security-Policy', value: policy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: frameOptions },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  transpilePackages: ['@academia/editor-core', '@academia/design-system', '@academia/page-renderer', '@academia/page-schema'],
  poweredByHeader: false,
  // O navegador fala só com a origem do site; cookies de sessão e CSRF ficam em first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }]
  },
  async headers() {
    return [
      { source: '/:path((?!admin/preview/[^/]+/[^/]+/live$).*)', headers: securityHeaders(csp, 'DENY') },
      { source: '/admin/preview/:kind/:id/live', headers: securityHeaders(framedCsp, 'SAMEORIGIN') },
    ]
  },
}

export default nextConfig
