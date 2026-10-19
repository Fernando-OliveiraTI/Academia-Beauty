import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MediaInput } from './media-input'
import { ImageField } from './image-field'
import { SchemaForm, type JsonSchema } from './schema-form'

const id = 'c'.repeat(32)
const asset = (over: Record<string, unknown> = {}) => ({
  id, kind: 'image', name: 'foto.png', mime: 'image/png', size: 2048, width: 800, height: 600, path: `/media/${id}`, createdAt: '2026-10-17T10:00:00Z', inUse: false, ...over,
})

const api = vi.hoisted(() => ({ apiGet: vi.fn(), apiSend: vi.fn(), apiUpload: vi.fn() }))
vi.mock('@/lib/api-client', () => api)

beforeEach(() => {
  api.apiGet.mockResolvedValue({ ok: true, status: 200, data: { items: [asset(), asset({ id: 'd'.repeat(32), name: 'outra.png', path: `/media/${'d'.repeat(32)}` })], page: 1, perPage: 12, total: 2 } })
})
afterEach(() => vi.clearAllMocks())

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <MediaInput label="Retrato" kind="image" value={value} onChange={setValue} />
}

describe('MediaInput', () => {
  it('mantém o campo de texto editável e mostra miniatura para arquivo da biblioteca', async () => {
    render(<Harness initial={`/media/${id}`} />)
    expect(screen.getByLabelText('Retrato')).toHaveValue(`/media/${id}`)
    expect(document.querySelector('img.media-input-preview')?.getAttribute('src')).toBe(`/media/${id}?w=320`)
  })

  it('abre a biblioteca, lista os arquivos e preenche o campo ao escolher', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /Biblioteca.*Retrato/ }))
    const use = await screen.findByRole('button', { name: /Usar\s*outra\.png/ })
    expect(api.apiGet).toHaveBeenCalledWith(expect.stringContaining('/admin/media?'))
    await user.click(use)
    expect(screen.getByLabelText('Retrato')).toHaveValue(`/media/${'d'.repeat(32)}`)
  })

  it('envia arquivo pelo seletor e usa o arquivo enviado', async () => {
    const user = userEvent.setup()
    api.apiUpload.mockResolvedValue({ ok: true, status: 201, data: asset({ id: 'e'.repeat(32), name: 'nova.png', path: `/media/${'e'.repeat(32)}` }) })
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /^Biblioteca/ }))
    await waitFor(() => expect(screen.getByLabelText('Enviar arquivos')).toBeInTheDocument())
    await user.upload(screen.getByLabelText('Enviar arquivos'), new File(['x'], 'nova.png', { type: 'image/png' }))
    await waitFor(() => expect(screen.getByLabelText('Retrato')).toHaveValue(`/media/${'e'.repeat(32)}`))
    expect(api.apiUpload).toHaveBeenCalledWith('/admin/media', expect.any(File))
  })

  it('mostra o motivo quando o envio é recusado', async () => {
    const user = userEvent.setup({ applyAccept: false })
    api.apiUpload.mockResolvedValue({ ok: false, status: 422, data: { message: 'Tipo de arquivo não aceito.' } })
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /^Biblioteca/ }))
    await waitFor(() => expect(screen.getByLabelText('Enviar arquivos')).toBeInTheDocument())
    await user.upload(screen.getByLabelText('Enviar arquivos'), new File(['x'], 'x.png', { type: 'image/png' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('x.png: Tipo de arquivo não aceito.')
  })

  it('sem permissão, a biblioteca explica em vez de quebrar', async () => {
    const user = userEvent.setup()
    api.apiGet.mockResolvedValue({ ok: false, status: 403, data: null })
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /^Biblioteca/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('permissão')
  })
})

describe('SchemaForm: campos de arquivo', () => {
  const schema: JsonSchema = {
    type: 'object', required: ['video'],
    properties: { video: { type: 'object', required: ['src', 'type'], properties: { src: { type: 'string', maxLength: 2048 }, type: { type: 'string', maxLength: 40 } } } },
  }
  it('o campo src escolhe da biblioteca e, para vídeo, ajusta o tipo MIME junto', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    api.apiGet.mockResolvedValue({ ok: true, status: 200, data: { items: [asset({ kind: 'video', name: 'clip.mp4', mime: 'video/mp4' })], page: 1, perPage: 12, total: 1 } })
    render(<SchemaForm schema={schema} value={{ video: { src: '', type: '' } }} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /^Editar/ }))
    await user.click(await screen.findByRole('button', { name: /Usar\s*clip\.mp4/ }))
    expect(onChange).toHaveBeenLastCalledWith({ video: { src: `/media/${id}`, type: 'video/mp4' } })
    expect(api.apiGet).toHaveBeenCalledWith(expect.stringContaining('kind=video'))
  })
})


describe('ImageField', () => {
  function Field({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial)
    return <><ImageField label="Foto" value={value} onChange={setValue} /><output data-testid="value" data-value={value} /></>
  }

  it('mostra a imagem atual e nenhum texto de caminho', () => {
    render(<Field initial="/site/home/lukas-campos.png" />)
    expect(screen.getByAltText('Foto atual')).toHaveAttribute('src', '/site/home/lukas-campos.png')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText(/lukas-campos\.png/)).toBeNull()
  })

  it('arquivo da biblioteca usa a miniatura pelo tamanho, sem mostrar o caminho', () => {
    render(<Field initial={`/media/${id}`} />)
    expect(screen.getByAltText('Foto atual')).toHaveAttribute('src', `/media/${id}?w=480`)
  })

  it('o botão Editar abre a janela, e escolher um arquivo envia e troca a imagem', async () => {
    const user = userEvent.setup({ applyAccept: false })
    api.apiUpload.mockResolvedValue({ ok: true, status: 201, data: asset({ id: 'f'.repeat(32), path: `/media/${'f'.repeat(32)}` }) })
    render(<Field initial="/site/home/lukas-campos.png" />)
    await user.click(screen.getByRole('button', { name: 'Editar Foto' }))
    expect(await screen.findByRole('button', { name: 'Selecionar arquivo' })).toBeInTheDocument()
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'nova.png', { type: 'image/png' }))
    await waitFor(() => expect(screen.getByTestId('value')).toHaveAttribute('data-value', `/media/${'f'.repeat(32)}`))
    expect(api.apiUpload).toHaveBeenCalledWith('/admin/media', expect.any(File))
  })

  it('soltar um arquivo sobre a miniatura envia direto', async () => {
    api.apiUpload.mockResolvedValue({ ok: true, status: 201, data: asset({ id: 'a'.repeat(32), path: `/media/${'a'.repeat(32)}` }) })
    render(<Field />)
    const box = document.querySelector('.img-preview') as HTMLElement
    const file = new File(['x'], 'solta.png', { type: 'image/png' })
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.drop(box, { dataTransfer: { files: [file] } })
    await waitFor(() => expect(screen.getByTestId('value')).toHaveAttribute('data-value', `/media/${'a'.repeat(32)}`))
  })

  it('recusa arquivo de tipo errado antes de enviar e explica', async () => {
    render(<Field />)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.drop(document.querySelector('.img-preview') as HTMLElement, { dataTransfer: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Envie uma imagem')
    expect(api.apiUpload).not.toHaveBeenCalled()
  })
})
