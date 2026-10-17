import { describe, expect, it } from 'vitest'
import { canonical, fieldErrors, groupIssuesByStep, parseTags, stepForField, suggestSlug } from './form-model'

describe('form-model', () => {
  it('parseTags limpa, remove vazios e limita a 2', () => {
    expect(parseTags(' mechas , , loiro, extra ')).toEqual(['mechas', 'loiro'])
    expect(parseTags('')).toEqual([])
  })
  it('suggestSlug normaliza acentos', () => {
    expect(suggestSlug('Cleber Venâncio')).toBe('cleber-venancio')
  })
  it('fieldErrors remove o prefixo data. e mantém o primeiro erro por campo', () => {
    expect(
      fieldErrors([
        { field: 'data.portraitSrc', message: 'a' },
        { field: 'data.portraitSrc', message: 'b' },
        { field: 'slug', message: 'c' },
      ])
    ).toEqual({ portraitSrc: 'a', slug: 'c' })
  })
  it('liga cada pendência à etapa que a resolve', () => {
    expect(stepForField('name')).toBe(0)
    expect(stepForField('tagline')).toBe(1)
    expect(stepForField('cardPhotoSrc')).toBe(2)
    expect(stepForField('bio')).toBe(3)
    expect(groupIssuesByStep([{ field: 'bio', message: 'x' }])[0]?.step).toBe(3)
  })
  it('canonical ignora a ordem das chaves, mas não a dos itens de lista', () => {
    expect(canonical({ a: 1, b: { d: 1, c: 2 } })).toBe(canonical({ b: { c: 2, d: 1 }, a: 1 }))
    expect(canonical({ l: [1, 2] })).not.toBe(canonical({ l: [2, 1] }))
  })
})
