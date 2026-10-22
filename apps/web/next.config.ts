import path from 'node:path'
import type { NextConfig } from 'next'
import { buildCsp, hostList } from './src/lib/csp'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3333'
const isDev = process.env.NODE_ENV !== 'production'
// Host(s) de CDN de mídia (vírgula). Vazio = só o próprio site. A API confere o mesmo valor ao validar documentos.
const mediaHosts = hostList(process.env.MEDIA_CDN_HOST)
// Domínios de checkout autorizados (mesmo valor da API): só eles podem ser embutidos em iframe (The Members).
const checkoutHosts = hostList(process.env.CHECKOUT_ALLOWED_HOSTS, true)

// CSP estática do site público (páginas estáticas/ISR, sem nonce). O painel (/admin) recebe a CSP com nonce em src/proxy.ts.
const csp = buildCsp({ frameAncestors: "'none'", isDev, mediaHosts, checkoutHosts })
const securityHeaders = (frameOptions: string, withCsp: boolean) => [
  ...(withCsp ? [{ key: 'Content-Security-Policy', value: csp }] : []),
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: frameOptions },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HTTPS por 180 dias (o navegador ignora o cabeçalho em HTTP). Sem includeSubDomains/preload de propósito.
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=15552000' }]),
]

const nextConfig: NextConfig = {
  // Imagem Docker: saída autônoma (`NEXT_OUTPUT=standalone`), com a raiz do monorepo para incluir os pacotes do workspace.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const, outputFileTracingRoot: path.join(__dirname, '../..') } : {}),
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
      // Site público: CSP estática. O painel recebe a CSP com nonce no proxy (aqui só os demais cabeçalhos).
      { source: '/:path((?!admin).*)', headers: securityHeaders('DENY', true) },
      { source: '/admin/:path((?!preview/[^/]+/[^/]+/live$|preview/home/live$).*)', headers: securityHeaders('DENY', false) },
      { source: '/admin/preview/:kind/:id/live', headers: securityHeaders('SAMEORIGIN', false) },
      { source: '/admin/preview/home/live', headers: securityHeaders('SAMEORIGIN', false) },
      // Painel, pré-visualizações e rotas internas nunca entram em buscadores, mesmo com a indexação do site ligada
      // (a API é um proxy externo: fica de fora por robots.txt).
      { source: '/:area(admin|preview|internal|healthz)/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ]
  },
}

export default nextConfig
