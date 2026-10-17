import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginForm, messageForStatus } from './login-form'

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
