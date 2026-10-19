import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { SECTION_META } from '@academia/section-schemas'
import { buildProfessionalDocument, courseOriginalTemplate, homeOriginalTemplate, professionalOriginalTemplate } from '@academia/page-renderer'
import { SchemaForm, defaultFor, type JsonSchema } from './schema-form'

const jsonOf = (schema: z.ZodType) => z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) as JsonSchema

// Números e Chamada só existem nos modelos novos de Profissional: vêm de um deles, montado com dados de exemplo.
const sample = { name: 'Ana Souza', specialty: 'Hair', tagline: 'Técnica.', experienceYears: 10, instagramHandle: '@ana', instagramFollowers: '10 mil', instagramUrl: 'https://instagram.com/ana', portraitSrc: '/site/a.png', cardPhotoSrc: '/site/b.png', bio: ['Dez anos.'], works: [], videoSrc: '', metaDescription: '' }
const premium = buildProfessionalDocument(sample, { templateKey: 'professional-premium' })
const templateSections = [...courseOriginalTemplate.sections, ...professionalOriginalTemplate.sections, ...homeOriginalTemplate.sections, ...premium.sections.filter((s) => s.id === 'stats' || s.id === 'cta')]

describe('SchemaForm com as seções reais', () => {
  it('toda seção do catálogo converte para JSON Schema e renderiza com o conteúdo do template, sem quebrar', () => {
    for (const meta of SECTION_META) {
      const section = templateSections.find((s) => s.type === meta.type)
      expect(section, meta.type).toBeDefined()
      const { unmount, container } = render(<SchemaForm schema={jsonOf(meta.schema)} value={section!.content} onChange={() => {}} />)
      expect(container.querySelectorAll('input, textarea, select').length, meta.type).toBeGreaterThan(0)
      unmount()
    }
  })

  it('o conteúdo do template permanece válido depois de passar pelo formulário sem edição', () => {
    for (const meta of SECTION_META) {
      const section = templateSections.find((s) => s.type === meta.type)!
      expect(meta.schema.safeParse(section.content).success, meta.type).toBe(true)
    }
  })
})

describe('SchemaForm · comportamento', () => {
  const schema = jsonOf(z.object({ title: z.string().max(40), href: z.string().max(100), long: z.string().max(400), on: z.boolean().optional(), tags: z.array(z.string().max(10)).max(3), links: z.array(z.object({ label: z.string().max(20) })).max(2), level: z.enum(['a', 'b']) }))
  const value = { title: 'Oi', href: '/x', long: 'texto', on: false, tags: ['um'], links: [{ label: 'A' }], level: 'a' }

  it('edita campos de texto, caixa, enum e devolve um objeto novo sem mutar o original', async () => {
    const onChange = vi.fn()
    const snapshot = structuredClone(value)
    render(<SchemaForm schema={schema} value={value} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Título'), '!')
    expect(onChange).toHaveBeenLastCalledWith({ ...value, title: 'Oi!' })
    await userEvent.click(screen.getByLabelText('On'))
    expect(onChange).toHaveBeenLastCalledWith({ ...value, on: true })
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'b')
    expect(onChange).toHaveBeenLastCalledWith({ ...value, level: 'b' })
    expect(value).toEqual(snapshot)
  })

  it('campos longos viram textarea e respeitam maxLength', () => {
    render(<SchemaForm schema={schema} value={value} onChange={() => {}} />)
    expect(screen.getByLabelText('Long').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('Título')).toHaveAttribute('maxlength', '40')
  })

  it('listas: adicionar respeita o máximo, remover e mover', async () => {
    const onChange = vi.fn()
    const many = { ...value, tags: ['a', 'b', 'c'], links: [{ label: 'A' }, { label: 'B' }] }
    render(<SchemaForm schema={schema} value={many} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Adicionar etiquetas' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Adicionar links' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Mover Etiquetas 1 para baixo' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...many, tags: ['b', 'a', 'c'] })
    await userEvent.click(screen.getByRole('button', { name: 'Remover Links 2' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...many, links: [{ label: 'A' }] })
    expect(screen.getByRole('button', { name: 'Mover Etiquetas 1 para cima' })).toBeDisabled()
  })

  it('adicionar item cria o valor padrão do tipo do item', async () => {
    const onChange = vi.fn()
    render(<SchemaForm schema={schema} value={value} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar links' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...value, links: [{ label: 'A' }, { label: '' }] })
    const group = screen.getByRole('group', { name: /Etiquetas/ })
    expect(within(group).getByLabelText('Conteúdo de Etiquetas 1')).toHaveValue('um')
  })

  it('defaultFor cobre objeto, lista com mínimo, enum, número e booleano', () => {
    expect(defaultFor(jsonOf(z.object({ a: z.string(), n: z.number(), b: z.boolean(), e: z.enum(['x', 'y']), l: z.array(z.string()).min(2) })))).toEqual({ a: '', n: 0, b: false, e: 'x', l: ['', ''] })
  })
})

describe('SchemaForm · campos opcionais e números', () => {
  const schema = jsonOf(z.object({
    title: z.string().max(40),
    note: z.string().max(40).optional(),
    photo: z.object({ src: z.string().max(100), alt: z.string().max(100) }).optional(),
    value: z.number().nonnegative(),
    bonus: z.number().int().min(1).max(9).optional(),
  }))

  it('limpar texto opcional remove a chave (não grava string vazia)', async () => {
    const onChange = vi.fn()
    render(<SchemaForm schema={schema} value={{ title: 'T', note: 'x', value: 1 }} onChange={onChange} />)
    await userEvent.clear(screen.getByLabelText('Observação'))
    const last = onChange.mock.calls.at(-1)![0] as Record<string, unknown>
    expect('note' in last).toBe(false)
    expect(last.title).toBe('T')
  })

  it('objeto opcional: adicionar cria só os campos obrigatórios e remover apaga a chave', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<SchemaForm schema={schema} value={{ title: 'T', value: 1 }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar foto' }))
    expect(onChange).toHaveBeenLastCalledWith({ title: 'T', value: 1, photo: { src: '', alt: '' } })
    rerender(<SchemaForm schema={schema} value={{ title: 'T', value: 1, photo: { src: 'a', alt: 'b' } }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remover foto' }))
    const last = onChange.mock.calls.at(-1)![0] as Record<string, unknown>
    expect('photo' in last).toBe(false)
  })

  it('número obrigatório limpo não vira 0; opcional limpo some; limites do schema chegam ao campo', async () => {
    const onChange = vi.fn()
    render(<SchemaForm schema={schema} value={{ title: 'T', value: 5, bonus: 3 }} onChange={onChange} />)
    await userEvent.clear(screen.getByLabelText('Valor'))
    expect((onChange.mock.calls.at(-1)![0] as { value: unknown }).value).toBe('')
    await userEvent.clear(screen.getByLabelText('Bonus'))
    expect('bonus' in (onChange.mock.calls.at(-1)![0] as object)).toBe(false)
    const bonus = screen.getByLabelText('Bonus')
    expect(bonus).toHaveAttribute('min', '1')
    expect(bonus).toHaveAttribute('max', '9')
  })
})
