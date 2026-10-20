import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ListEmpty } from './list-empty'

describe('ListEmpty', () => {
  it('mostra título e orientação', () => {
    render(<ListEmpty title="Nenhum curso encontrado">Ajuste a busca.</ListEmpty>)
    expect(screen.getByText('Nenhum curso encontrado')).toBeInTheDocument()
    expect(screen.getByText('Ajuste a busca.')).toBeInTheDocument()
  })
})
