// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { LEGAL_VERSION } from '@academia/contracts'
import { CONSENT_EVENT, hasConsent, readConsent, saveConsent } from './consent'

beforeEach(() => window.localStorage.clear())

describe('consentimento de cookies', () => {
  it('sem escolha: nada consentido', () => {
    expect(readConsent()).toBeNull()
    expect(hasConsent('analytics')).toBe(false)
  })
  it('salva a escolha com a versão vigente e avisa a página', () => {
    let fired = false
    window.addEventListener(CONSENT_EVENT, () => { fired = true }, { once: true })
    saveConsent({ analytics: true, marketing: false })
    expect(readConsent()).toMatchObject({ version: LEGAL_VERSION, analytics: true, marketing: false })
    expect(hasConsent('analytics')).toBe(true)
    expect(hasConsent('marketing')).toBe(false)
    expect(fired).toBe(true)
  })
  it('escolha de outra versão da Política não vale (o banner pergunta de novo)', () => {
    window.localStorage.setItem('ab-cookie-consent', JSON.stringify({ version: '2020-01-01', analytics: true, marketing: true, at: '' }))
    expect(readConsent()).toBeNull()
    expect(hasConsent('analytics')).toBe(false)
  })
})
