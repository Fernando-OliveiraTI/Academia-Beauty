import { afterEach, describe, expect, it, vi } from 'vitest'
import { absoluteUrl, indexingEnabled, parseSiteUrl, siteUrl } from './site'

afterEach(() => vi.unstubAllEnvs())

describe('parseSiteUrl', () => {
  it('normaliza para a origem, sem barra final nem caminho', () => {
    expect(parseSiteUrl('https://academiabeauty.com.br/')).toBe('https://academiabeauty.com.br')
    expect(parseSiteUrl(' https://exemplo.com/algum/caminho?x=1 ')).toBe('https://exemplo.com')
  })
  it('recusa vazio, inválido, outros protocolos e credenciais', () => {
    for (const bad of [undefined, '', '   ', 'academiabeauty.com.br', 'javascript:alert(1)', 'ftp://exemplo.com', 'https://user:senha@exemplo.com']) {
      expect(parseSiteUrl(bad)).toBeNull()
    }
  })
})

describe('indexingEnabled', () => {
  const env = (vars: Record<string, string>) => Object.entries(vars).forEach(([k, v]) => vi.stubEnv(k, v))

  it('só liga em produção, com SITE_INDEXING=true e SITE_URL válido', () => {
    env({ NODE_ENV: 'production', SITE_INDEXING: 'true', SITE_URL: 'https://academiabeauty.com.br' })
    expect(indexingEnabled()).toBe(true)
  })
  it('desligado por padrão (sem configuração)', () => {
    env({ NODE_ENV: 'production', SITE_INDEXING: '', SITE_URL: '' })
    expect(indexingEnabled()).toBe(false)
  })
  it('SITE_INDEXING sem SITE_URL válido continua desligado', () => {
    env({ NODE_ENV: 'production', SITE_INDEXING: 'true', SITE_URL: 'nao-e-url' })
    expect(indexingEnabled()).toBe(false)
  })
  it('fora de produção nunca indexa', () => {
    env({ NODE_ENV: 'development', SITE_INDEXING: 'true', SITE_URL: 'https://academiabeauty.com.br' })
    expect(indexingEnabled()).toBe(false)
  })
  it('qualquer valor diferente de "true" não liga', () => {
    env({ NODE_ENV: 'production', SITE_INDEXING: '1', SITE_URL: 'https://academiabeauty.com.br' })
    expect(indexingEnabled()).toBe(false)
  })
})

describe('absoluteUrl', () => {
  it('monta a URL absoluta ou devolve null sem SITE_URL', () => {
    vi.stubEnv('SITE_URL', 'https://academiabeauty.com.br')
    expect(siteUrl()).toBe('https://academiabeauty.com.br')
    expect(absoluteUrl('/cursos/morena')).toBe('https://academiabeauty.com.br/cursos/morena')
    vi.stubEnv('SITE_URL', '')
    expect(absoluteUrl('/cursos/morena')).toBeNull()
  })
})
