import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RowActions } from './row-actions'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/api-client', () => ({ apiSend: vi.fn() }))
import { apiSend } from '@/lib/api-client'

afterEach(() => vi.clearAllMocks())

const base = { apiPath: '/admin/courses/7', editHref: '/admin/editor/cursos/7', name: 'Curso X', noun: 'curso', viewHref: '/cursos/x', canArchive: true } as const

describe('RowActions', () => {
  it('mostra Despublicar só para publicados e Apagar só para não publicados', async () => {
    const { unmount } = render(<RowActions {...base} status="published" />)
    await userEvent.click(screen.getByRole('button', { name: /Mais ações/ }))
    expect(screen.getByRole('menuitem', { name: 'Despublicar' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Apagar' })).toBeNull()
    unmount()
    render(<RowActions {...base} status="draft" />)
    await userEvent.click(screen.getByRole('button', { name: /Mais ações/ }))
    expect(screen.getByRole('menuitem', { name: 'Apagar' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Despublicar' })).toBeNull()
  })

  it('apagar pede confirmação e só chama a API depois de confirmar', async () => {
    vi.mocked(apiSend).mockResolvedValue({ ok: true, status: 204, data: null })
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    render(<RowActions {...base} status="draft" />)
    await userEvent.click(screen.getByRole('button', { name: /Mais ações/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Apagar' }))
    expect(apiSend).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar' }))
    await waitFor(() => expect(apiSend).toHaveBeenCalledWith('DELETE', '/admin/courses/7'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('erro da API aparece no menu e não atualiza a lista', async () => {
    vi.mocked(apiSend).mockResolvedValue({ ok: false, status: 409, data: { message: 'Profissional com cursos.' } })
    render(<RowActions {...base} status="published" />)
    await userEvent.click(screen.getByRole('button', { name: /Mais ações/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Arquivar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Arquivar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível|Profissional/)
    expect(refresh).not.toHaveBeenCalled()
  })
})
