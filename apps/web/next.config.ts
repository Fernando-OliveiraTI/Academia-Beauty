import type { NextConfig } from 'next'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3333'
const isDev = process.env.NODE_ENV !== 'production'
// Host(s) de CDN de mídia (vírgula). Vazio = só o próprio site. A API confere o mesmo valor ao validar documentos.
const mediaHosts = (process.env.MEDIA_CDN_HOST ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter((h) => /^[a-z0-9.-]+$/.test(h))
const mediaSources = mediaHosts.map((h) => `https://${h}`).join(' ')
// Domínios de checkout autorizados (mesmo valor da API): só eles podem ser embutidos em iframe (The Members).
const checkoutHosts = (process.env.CHECKOUT_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter((h) => /^(\*\.)?[a-z0-9.-]+$/.test(h))
const frameSources = ["'self'", ...checkoutHosts.map((h) => `https://${h}`)].join(' ')

// CSP do painel e do site. Em dev o Next precisa de 'unsafe-eval' (React refresh); em produção não.
const cspDirectives = (frameAncestors: string) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${mediaSources ? ` ${mediaSources}` : ''}`,
  `media-src 'self' blob:${mediaSources ? ` ${mediaSources}` : ''}`,
  "font-src 'self' data:",
  `frame-src ${frameSources}`,
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
  // O proxy /api repassa o envio de mídia (vídeo até 60 MB): o padrão do Next corta o corpo em 10 MB.
  experimental: { proxyClientMaxBodySize: '70mb' },
  // O navegador lê o hostname do CDN também no cliente (validação do editor).
  env: { NEXT_PUBLIC_MEDIA_CDN_HOST: mediaHosts.join(',') },
  // O navegador fala só com a origem do site; cookies de sessão e CSRF ficam em first-party.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/:path*` },
      // Biblioteca de mídia: entrega pública pela API (cache imutável, Range para vídeo).
      { source: '/media/:id', destination: `${apiOrigin}/media/:id` },
    ]
  },
  async headers() {
    return [
      { source: '/:path((?!admin/preview/[^/]+/[^/]+/live$|admin/preview/home/live$).*)', headers: securityHeaders(csp, 'DENY') },
      { source: '/admin/preview/:kind/:id/live', headers: securityHeaders(framedCsp, 'SAMEORIGIN') },
      { source: '/admin/preview/home/live', headers: securityHeaders(framedCsp, 'SAMEORIGIN') },
    ]
  },
}

export default nextConfig
