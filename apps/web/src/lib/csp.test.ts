import { describe, expect, it } from 'vitest'
import { buildCsp, FRAMED_ADMIN_PATH, hostList } from './csp'

const base = { frameAncestors: "'none'" as const, isDev: false, mediaHosts: ['cdn.exemplo.com'], checkoutHosts: ['pay.exemplo.com'] }

describe('buildCsp', () => {
  it('painel: scripts só com nonce, sem unsafe-inline', () => {
    const csp = buildCsp({ ...base, nonce: 'abc123' })
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'")
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).toContain("style-src 'self' 'nonce-abc123'; style-src-attr 'unsafe-inline'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('site público: sem nonce, usa unsafe-inline (páginas estáticas)', () => {
    const csp = buildCsp(base)
    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
    expect(csp).toContain('img-src \'self\' data: blob: https://cdn.exemplo.com')
    expect(csp).toContain("frame-src 'self' https://pay.exemplo.com")
  })

  it('só em desenvolvimento libera unsafe-eval; quadro do editor aceita o próprio site', () => {
    expect(buildCsp({ ...base, isDev: true, nonce: 'x' })).toContain("'unsafe-eval'")
    expect(buildCsp({ ...base, frameAncestors: "'self'" })).toContain("frame-ancestors 'self'")
  })
})

describe('hostList', () => {
  it('filtra valores inválidos e só aceita curinga quando pedido', () => {
    expect(hostList('a.com, B.com ,; drop table,*.c.com')).toEqual(['a.com', 'b.com'])
    expect(hostList('a.com,*.c.com', true)).toEqual(['a.com', '*.c.com'])
    expect(hostList(undefined)).toEqual([])
  })
})

describe('FRAMED_ADMIN_PATH', () => {
  it('só os quadros de pré-visualização ao vivo podem ser embutidos', () => {
    expect(FRAMED_ADMIN_PATH.test('/admin/preview/home/live')).toBe(true)
    expect(FRAMED_ADMIN_PATH.test('/admin/preview/cursos/12/live')).toBe(true)
    expect(FRAMED_ADMIN_PATH.test('/admin/preview/cursos/12')).toBe(false)
    expect(FRAMED_ADMIN_PATH.test('/admin/cursos')).toBe(false)
  })
})
