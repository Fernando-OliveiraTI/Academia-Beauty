'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginInputSchema, type LoginInput } from '@academia/contracts'
import { Button, Field } from '@academia/design-system'
import { apiPost } from '@/lib/api-client'

export function messageForStatus(status: number): string {
  if (status === 401) return 'E-mail ou senha inválidos.'
  if (status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (status === 403) return 'Sessão expirada. Recarregue a página e tente novamente.'
  return 'Não foi possível entrar agora. Tente novamente.'
}

/** Mensagem do segundo passo (código do aplicativo ou de recuperação). */
export function secondFactorMessage(status: number, code?: string): string {
  if (status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (code === 'pending_expired') return 'A verificação expirou. Volte e entre de novo com e-mail e senha.'
  if (status === 401) return 'Código inválido. Confira o aplicativo e tente de novo.'
  return 'Não foi possível verificar agora. Tente novamente.'
}

function SecondFactor({ onBack }: { onBack: () => void }) {
  const [recovery, setRecovery] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = await apiPost<{ code?: string }>('/auth/login/2fa', recovery ? { recoveryCode: value } : { code: value })
    if (res.ok) {
      window.location.assign('/admin')
      return
    }
    setBusy(false)
    setError(secondFactorMessage(res.status, res.data?.code))
  }

  return (
    <form onSubmit={submit} noValidate className="login-card" aria-label="Verificação em duas etapas">
      <p className="wizard-hint">{recovery ? 'Digite um dos códigos de recuperação que você guardou.' : 'Digite o código de 6 dígitos do seu aplicativo autenticador.'}</p>
      <Field
        label={recovery ? 'Código de recuperação' : 'Código de 6 dígitos'}
        inputMode={recovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        autoFocus
        maxLength={recovery ? 12 : 6}
        value={value}
        onChange={(e) => setValue(recovery ? e.target.value : e.target.value.replace(/\D/g, ''))}
      />
      {error ? <p role="alert" className="form-error">{error}</p> : null}
      <Button type="submit" disabled={busy || value.length < (recovery ? 11 : 6)}>{busy ? 'Verificando…' : 'Verificar'}</Button>
      <button type="button" className="link-button" onClick={() => { setRecovery((v) => !v); setValue(''); setError(null) }}>{recovery ? 'Usar o código do aplicativo' : 'Usar um código de recuperação'}</button>
      <button type="button" className="link-button" onClick={onBack}>Voltar</button>
    </form>
  )
}

export function LoginForm() {
  const [secondFactor, setSecondFactor] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInputSchema) })

  async function onSubmit(values: LoginInput) {
    setFormError(null)
    try {
      const res = await apiPost<{ secondFactorRequired?: boolean }>('/auth/login', values)
      if (res.ok && res.data?.secondFactorRequired) {
        setSecondFactor(true)
        return
      }
      if (res.ok) {
        window.location.assign('/admin') // navegação completa: o servidor relê a sessão
        return
      }
      setFormError(messageForStatus(res.status))
    } catch {
      setFormError(messageForStatus(0))
    }
  }

  if (secondFactor) return <SecondFactor onBack={() => setSecondFactor(false)} />

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="login-card" aria-label="Entrar no painel">
      <Field label="E-mail" type="email" autoComplete="username" error={errors.email ? 'Informe um e-mail válido.' : undefined} {...register('email')} />
      <Field label="Senha" type="password" autoComplete="current-password" error={errors.password ? 'Informe a senha.' : undefined} {...register('password')} />
      {formError ? <p role="alert" className="form-error">{formError}</p> : null}
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : 'Entrar'}</Button>
    </form>
  )
}
