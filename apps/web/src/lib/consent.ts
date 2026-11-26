import { LEGAL_VERSION } from '@academia/contracts'

/**
 * Consentimento de cookies do site (D-041). Fica no navegador (`localStorage`), com a versão da Política: se a versão
 * mudar, o banner pergunta de novo. Hoje o site só usa cookies essenciais; quem adicionar análise ou marketing
 * (pixel, Analytics) deve carregar o script só se `hasConsent(...)` for verdadeiro e ouvir `CONSENT_EVENT`.
 */
export type CookieConsent = { version: string; analytics: boolean; marketing: boolean; at: string }

const KEY = 'ab-cookie-consent'
export const CONSENT_EVENT = 'ab:cookie-consent'
export const OPEN_PREFERENCES_EVENT = 'ab:cookie-preferences'

export function readConsent(): CookieConsent | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CookieConsent
    return parsed?.version === LEGAL_VERSION ? parsed : null
  } catch {
    return null
  }
}

export function saveConsent(choice: { analytics: boolean; marketing: boolean }): CookieConsent {
  const consent: CookieConsent = { version: LEGAL_VERSION, ...choice, at: new Date().toISOString() }
  try { window.localStorage.setItem(KEY, JSON.stringify(consent)) } catch { /* navegador sem armazenamento: vale só nesta visita */ }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }))
  return consent
}

/** Uso por scripts opcionais: só com o consentimento da categoria, na versão vigente. */
export function hasConsent(kind: 'analytics' | 'marketing'): boolean {
  return Boolean(readConsent()?.[kind])
}
