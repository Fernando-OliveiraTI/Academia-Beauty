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

export function LoginForm() {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInputSchema) })

  async function onSubmit(values: LoginInput) {
    setFormError(null)
    try {
      const res = await apiPost('/auth/login', values)
      if (res.ok) {
        window.location.assign('/admin') // navegação completa: o servidor relê a sessão
        return
      }
      setFormError(messageForStatus(res.status))
    } catch {
      setFormError(messageForStatus(0))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="login-card" aria-label="Entrar no painel">
      <Field label="E-mail" type="email" autoComplete="username" error={errors.email ? 'Informe um e-mail válido.' : undefined} {...register('email')} />
      <Field label="Senha" type="password" autoComplete="current-password" error={errors.password ? 'Informe a senha.' : undefined} {...register('password')} />
      {formError ? <p role="alert" className="form-error">{formError}</p> : null}
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : 'Entrar'}</Button>
    </form>
  )
}
