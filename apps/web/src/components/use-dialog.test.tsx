import { render } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { useDialogSync } from './use-dialog'

function Probe({ open }: { open: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useDialogSync(ref, open)
  return <dialog ref={ref} data-testid="d">conteúdo</dialog>
}

describe('useDialogSync', () => {
  it('abre e fecha o <dialog> conforme o estado (mesmo sem showModal, como no jsdom)', () => {
    const { rerender, getByTestId } = render(<Probe open={false} />)
    expect((getByTestId('d') as HTMLDialogElement).open).toBe(false)
    rerender(<Probe open />)
    expect((getByTestId('d') as HTMLDialogElement).open).toBe(true)
    rerender(<Probe open={false} />)
    expect((getByTestId('d') as HTMLDialogElement).open).toBe(false)
  })
})
