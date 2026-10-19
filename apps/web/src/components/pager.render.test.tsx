import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Pager } from './pager'

describe('Pager', () => {
  it('modo URL: links com href e página atual marcada', () => {
    render(<Pager page={2} lastPage={3} total={25} perPage={10} hrefFor={(n) => `?page=${n}`} />)
    expect(screen.getByText('11–20')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Página 3' }).getAttribute('href')).toBe('?page=3')
    expect(screen.getByRole('link', { name: 'Página 2' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Página anterior' }).getAttribute('href')).toBe('?page=1')
  })

  it('modo cliente: botões que chamam onPageChange e sem links', () => {
    const onPageChange = vi.fn()
    render(<Pager page={1} lastPage={3} total={25} perPage={10} onPageChange={onPageChange} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Página 3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(onPageChange.mock.calls).toEqual([[3], [2]])
  })

  it('primeira página: anterior desabilitado; uma só página: sem navegação', () => {
    const { rerender } = render(<Pager page={1} lastPage={2} total={12} perPage={10} onPageChange={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Página anterior' })).toBeNull()
    rerender(<Pager page={1} lastPage={1} total={5} perPage={10} onPageChange={() => {}} />)
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
