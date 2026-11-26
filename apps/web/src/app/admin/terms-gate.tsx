'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LEGAL_VERSION } from '@academia/contracts'
import { Button } from '@academia/design-system'
import { apiSend } from '@/lib/api-client'
import { LogoutButton } from './logout-button'

const DocIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>

/**
 * Aceite dos Termos de Uso e da Política de Privacidade no painel (D-041): aparece no lugar das telas até o usuário
 * aceitar a versão vigente (`LEGAL_VERSION`). Os documentos abrem em outra aba para leitura; o aceite fica gravado na API.
 */
export function TermsGate({ firstName }: { firstName: string }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setBusy(true); setError(null)
    const res = await apiSend<{ message?: string }>('POST', '/auth/terms', { version: LEGAL_VERSION })
    setBusy(false)
    if (!res.ok) return setError(res.data?.message ?? (res.status === 0 ? 'Sem conexão com o servidor. Tente novamente.' : 'Não foi possível registrar o aceite. Tente novamente.'))
    router.refresh()
  }

  return (
    <section className="terms-gate" aria-labelledby="terms-gate-title">
      <p className="admin-eyebrow">Antes de continuar</p>
      <h1 id="terms-gate-title">{firstName ? `${firstName}, leia e aceite os termos` : 'Leia e aceite os termos'}</h1>
      <p className="terms-gate-lead">Para usar o painel da Academia Beauty, confirme que leu e concorda com os documentos abaixo. Eles abrem em outra aba.</p>
      <div className="terms-gate-docs">
        <a href="/termos-de-uso" target="_blank" rel="noopener"><DocIcon /><span><b>Termos de Uso</b><small>Cadastro, compras, propriedade intelectual e responsabilidades</small></span></a>
        <a href="/politica-de-privacidade" target="_blank" rel="noopener"><DocIcon /><span><b>Política de Privacidade</b><small>Dados que tratamos, finalidades, seus direitos e cookies</small></span></a>
      </div>
      <p className="terms-gate-cookies">
        <b>Cookies:</b> o painel usa apenas cookies essenciais, para manter sua sessão e proteger a conta (não podem ser desativados).
      </p>
      <label className="terms-gate-check">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>Li e aceito os Termos de Uso e a Política de Privacidade, inclusive o uso de cookies essenciais.</span>
      </label>
      {error ? <p role="alert" className="form-error">{error}</p> : null}
      <div className="terms-gate-actions">
        <LogoutButton />
        <Button disabled={!checked || busy} onClick={() => void accept()}>{busy ? 'Registrando…' : 'Aceitar e continuar'}</Button>
      </div>
      <p className="terms-gate-version">Versão de {LEGAL_VERSION.split('-').reverse().join('/')}</p>
    </section>
  )
}
