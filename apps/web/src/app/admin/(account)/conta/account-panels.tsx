'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { Button, Field } from '@academia/design-system'
import { apiSend } from '@/lib/api-client'
import { useConfirm } from '@/components/confirm-dialog'

type ApiMessage = { message?: string; issues?: string[] }

function PasswordPanel({ mustChangePassword }: { mustChangePassword: boolean }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (next !== again) return setError('A confirmação não é igual à senha nova.')
    setBusy(true)
    const res = await apiSend<ApiMessage>('POST', '/auth/password', { currentPassword: current, newPassword: next })
    setBusy(false)
    if (!res.ok) {
      return setError(res.status === 429 ? 'Muitas tentativas. Tente de novo em alguns minutos.' : res.data?.message ?? 'Não foi possível trocar a senha agora.')
    }
    setCurrent(''); setNext(''); setAgain('')
    if (mustChangePassword) return window.location.assign('/admin')
    setDone(true)
  }

  return (
    <section className="admin-panel acct-card" aria-labelledby="acct-pass">
      <h2 id="acct-pass">Senha</h2>
      <p className="wizard-hint">Mínimo de 12 caracteres, sem o seu nome ou e-mail. Ao trocar, as outras sessões abertas são encerradas.</p>
      <form onSubmit={submit} className="acct-form" noValidate>
        <Field label="Senha atual" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        <Field label="Senha nova" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        <Field label="Repita a senha nova" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
        {error ? <p role="alert" className="form-error">{error}</p> : null}
        {done ? <p role="status" className="form-ok">Senha alterada. As outras sessões foram encerradas.</p> : null}
        <div><Button type="submit" disabled={busy || !current || !next || !again}>{busy ? 'Salvando…' : 'Trocar senha'}</Button></div>
      </form>
    </section>
  )
}

function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const { confirm, dialog } = useConfirm()
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null)
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState<string[] | null>(null)
  const [off, setOff] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function begin() {
    setBusy(true); setError(null)
    const res = await apiSend<{ secret: string; otpauthUri: string }>('POST', '/auth/2fa/setup')
    if (!res.ok || !res.data) { setBusy(false); return setError('Não foi possível iniciar agora. Tente novamente.') }
    const qr = await QRCode.toDataURL(res.data.otpauthUri, { margin: 1, width: 192 })
    setBusy(false)
    setSetup({ secret: res.data.secret, qr })
  }

  async function activate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await apiSend<{ recoveryCodes?: string[]; message?: string }>('POST', '/auth/2fa/enable', { code })
    setBusy(false)
    if (!res.ok || !res.data?.recoveryCodes) {
      return setError(res.status === 429 ? 'Muitas tentativas. Tente de novo em alguns minutos.' : res.data?.message ?? 'Não foi possível ativar agora.')
    }
    setSetup(null); setCode('')
    setRecovery(res.data.recoveryCodes)
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault()
    if (!(await confirm({ title: 'Desativar a verificação em duas etapas?', message: 'A conta volta a depender só da senha.', confirmLabel: 'Desativar', tone: 'danger' }))) return
    setBusy(true); setError(null)
    const res = await apiSend<ApiMessage>('POST', '/auth/2fa/disable', { password, code })
    setBusy(false)
    if (!res.ok) return setError(res.status === 429 ? 'Muitas tentativas. Tente de novo em alguns minutos.' : res.data?.message ?? 'Não foi possível desativar agora.')
    setOff(false); setPassword(''); setCode('')
    router.refresh()
  }

  async function copyCodes() {
    try { await navigator.clipboard.writeText((recovery ?? []).join('\n')); setCopied(true) } catch { setCopied(false) }
  }

  return (
    <section className="admin-panel acct-card" aria-labelledby="acct-2fa">
      {dialog}
      <div className="acct-head">
        <h2 id="acct-2fa">Verificação em duas etapas</h2>
        <span className="pay-pill" data-tone={enabled || recovery ? 'ok' : 'neutral'}>{enabled || recovery ? 'Ativa' : 'Desativada'}</span>
      </div>
      <p className="wizard-hint">Além da senha, o login pede um código de 6 dígitos de um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password…).</p>

      {recovery ? (
        <div className="acct-recovery" role="status">
          <p><strong>Guarde estes códigos de recuperação.</strong> Cada um vale uma vez e só aparece agora. Use um deles se perder o celular.</p>
          <ul>{recovery.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
          <div className="acct-actions">
            <Button variant="secondary" onClick={copyCodes}>{copied ? 'Copiado' : 'Copiar códigos'}</Button>
            <Button onClick={() => { setRecovery(null); router.refresh() }}>Já guardei</Button>
          </div>
        </div>
      ) : enabled ? (
        off ? (
          <form onSubmit={disable} className="acct-form" noValidate>
            <Field label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Field label="Código do aplicativo ou de recuperação" inputMode="text" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            {error ? <p role="alert" className="form-error">{error}</p> : null}
            <div className="acct-actions">
              <Button variant="secondary" onClick={() => { setOff(false); setError(null) }}>Cancelar</Button>
              <Button type="submit" disabled={busy || !password || !code}>{busy ? 'Desativando…' : 'Desativar'}</Button>
            </div>
          </form>
        ) : <div><Button variant="secondary" onClick={() => setOff(true)}>Desativar</Button></div>
      ) : setup ? (
        <form onSubmit={activate} className="acct-setup" noValidate>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} width={192} height={192} alt="QR Code para o aplicativo autenticador" />
          <div className="acct-form">
            <p className="wizard-hint">Escaneie o QR Code no aplicativo. Se não conseguir, digite esta chave: <code className="acct-secret">{setup.secret}</code></p>
            <Field label="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
            {error ? <p role="alert" className="form-error">{error}</p> : null}
            <div className="acct-actions">
              <Button variant="secondary" onClick={() => { setSetup(null); setError(null) }}>Cancelar</Button>
              <Button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Ativando…' : 'Ativar'}</Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="acct-form">
          {error ? <p role="alert" className="form-error">{error}</p> : null}
          <div><Button onClick={begin} disabled={busy}>{busy ? 'Preparando…' : 'Ativar'}</Button></div>
        </div>
      )}
    </section>
  )
}

export function AccountPanels({ twoFactorEnabled, mustChangePassword }: { twoFactorEnabled: boolean; mustChangePassword: boolean }) {
  return (
    <div className="acct-grid">
      <PasswordPanel mustChangePassword={mustChangePassword} />
      <TwoFactorPanel enabled={twoFactorEnabled} />
    </div>
  )
}
