'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { OPEN_PREFERENCES_EVENT, readConsent, saveConsent } from '@/lib/consent'

/** Onde o banner não aparece: pré-visualização do editor (iframe) e telas internas do painel (lá o aceite é outro). */
const HIDDEN = /^\/admin\/(?!login(?:\/|$)).+|^\/admin$/

/**
 * Banner de cookies (D-041): primeira visita do site e tela de login do painel. "Aceitar todos" ou "Só essenciais";
 * "Personalizar" mostra as categorias. Links "Preferências de cookies" do rodapé (`[data-cookie-preferences]`) reabrem.
 * Não bloqueia a página (sem fundo escuro): a pessoa pode ler o site antes de escolher.
 */
export function CookieConsent() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    const current = readConsent()
    if (!current) setOpen(true)
    const reopen = () => {
      const c = readConsent()
      setAnalytics(Boolean(c?.analytics)); setMarketing(Boolean(c?.marketing))
      setCustom(true); setOpen(true)
    }
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('[data-cookie-preferences]')
      if (!link) return
      e.preventDefault()
      reopen()
    }
    window.addEventListener(OPEN_PREFERENCES_EVENT, reopen)
    document.addEventListener('click', onClick)
    return () => { window.removeEventListener(OPEN_PREFERENCES_EVENT, reopen); document.removeEventListener('click', onClick) }
  }, [])

  if (!open || HIDDEN.test(pathname ?? '')) return null
  const choose = (choice: { analytics: boolean; marketing: boolean }) => { saveConsent(choice); setOpen(false); setCustom(false) }

  return (
    <section className="ab-cookie" role="region" aria-labelledby="ab-cookie-title">
      <div className="ab-cookie__text">
        <strong id="ab-cookie-title">Cookies e privacidade</strong>
        <p>
          Usamos cookies essenciais para o site funcionar e manter sua sessão segura. Com a sua permissão, também usamos
          cookies de análise e marketing para melhorar a experiência. Saiba mais na{' '}
          <a href="/politica-de-privacidade" target="_blank" rel="noopener">Política de Privacidade</a>.
        </p>
      </div>
      {custom ? (
        <fieldset className="ab-cookie__prefs">
          <legend className="sr-only">Categorias de cookies</legend>
          <label><input type="checkbox" checked disabled /> <span><b>Essenciais</b><small>Sessão, segurança e funcionamento. Sempre ativos.</small></span></label>
          <label><input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> <span><b>Análise</b><small>Estatísticas de uso para melhorar o site.</small></span></label>
          <label><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> <span><b>Marketing</b><small>Anúncios e campanhas mais relevantes.</small></span></label>
        </fieldset>
      ) : null}
      <div className="ab-cookie__actions">
        {custom ? (
          <button type="button" className="ab-cookie__btn ab-cookie__btn--primary" onClick={() => choose({ analytics, marketing })}>Salvar escolhas</button>
        ) : (
          <>
            <button type="button" className="ab-cookie__btn ab-cookie__btn--primary" onClick={() => choose({ analytics: true, marketing: true })}>Aceitar todos</button>
            <button type="button" className="ab-cookie__btn" onClick={() => choose({ analytics: false, marketing: false })}>Só essenciais</button>
            <button type="button" className="ab-cookie__link" onClick={() => setCustom(true)}>Personalizar</button>
          </>
        )}
      </div>
    </section>
  )
}
