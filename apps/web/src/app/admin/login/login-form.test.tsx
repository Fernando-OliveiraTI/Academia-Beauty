import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginForm, messageForStatus, secondFactorMessage } from './login-form'

vi.mock('@/lib/api-client', () => ({ apiPost: vi.fn() }))
import { apiPost } from '@/lib/api-client'

afterEach(() => vi.clearAllMocks())

describe('messageForStatus', () => {
  it.each([
    [401, 'E-mail ou senha inválidos.'],
    [429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'],
    [403, 'Sessão expirada. Recarregue a página e tente novamente.'],
  ])('status %i', (status, message) => expect(messageForStatus(status)).toBe(message))
})

describe('LoginForm', () => {
  it('valida os campos antes de chamar a API', async () => {
    render(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findAllByRole('alert')).toHaveLength(2)
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('mostra erro genérico quando as credenciais são recusadas', async () => {
    vi.mocked(apiPost).mockResolvedValue({ ok: false, status: 401, data: null })
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'qualquer')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.'))
    expect(apiPost).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'qualquer' })
  })
})

describe('LoginForm · segundo fator', () => {
  it('pede o código quando a API exige o segundo fator e envia ao endpoint certo', async () => {
    vi.mocked(apiPost)
      .mockResolvedValueOnce({ ok: true, status: 200, data: { secondFactorRequired: true } })
      .mockResolvedValueOnce({ ok: false, status: 401, data: { code: 'invalid_code' } })
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'qualquer')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    const input = await screen.findByLabelText('Código de 6 dígitos')
    await userEvent.type(input, '12a3456')
    expect((input as HTMLInputElement).value).toBe('123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Código inválido'))
    expect(apiPost).toHaveBeenLastCalledWith('/auth/login/2fa', { code: '123456' })
  })

  it('alterna para o código de recuperação', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({ ok: true, status: 200, data: { secondFactorRequired: true } })
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'qualquer')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Usar um código de recuperação' }))
    expect(screen.getByLabelText('Código de recuperação')).toBeInTheDocument()
  })
})

describe('LoginForm · administrador que ainda precisa ativar o 2FA', () => {
  it('login concluído com twoFactorRequired nos dados do usuário NÃO abre o campo de código', async () => {
    const assign = vi.fn()
    Object.defineProperty(window, 'location', { value: { assign }, writable: true })
    vi.mocked(apiPost).mockResolvedValueOnce({ ok: true, status: 200, data: { id: 1, email: 'a@b.com', twoFactorRequired: true } })
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'qualquer')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin'))
    expect(screen.queryByLabelText('Código de 6 dígitos')).toBeNull()
  })
})

describe('secondFactorMessage', () => {
  it('trata bloqueio, expiração e código errado', () => {
    expect(secondFactorMessage(429)).toMatch(/Muitas tentativas/)
    expect(secondFactorMessage(401, 'pending_expired')).toMatch(/expirou/)
    expect(secondFactorMessage(401, 'invalid_code')).toMatch(/Código inválido/)
  })
})
