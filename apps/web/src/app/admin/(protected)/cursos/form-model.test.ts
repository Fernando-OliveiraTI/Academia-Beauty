import { describe, expect, it } from 'vitest'
import { centsToInput, emptyLines, groupIssuesByStep, parseBRLToCents, stepForField } from './form-model'

describe('parseBRLToCents', () => {
  it.each([
    ['250', 25000],
    ['250,00', 25000],
    ['250,5', 25050],
    ['1.250,99', 125099],
    ['R$ 1.250,00', 125000],
    ['0,99', 99],
    ['1250.50', 125050],
    ['1.250', 125000],
  ])('%s → %d', (input, cents) => expect(parseBRLToCents(input)).toBe(cents))

  it.each(['', 'abc', '12,345', '-5', '1,2,3', '10,'])('recusa %j', (input) => expect(parseBRLToCents(input)).toBeNull())

  it('ida e volta sem erro de ponto flutuante', () => {
    for (const cents of [1, 99, 100, 12345, 99999999]) expect(parseBRLToCents(centsToInput(cents))).toBe(cents)
    expect(parseBRLToCents('19,90')).toBe(1990)
    expect(parseBRLToCents('0,29')).toBe(29)
  })
})

describe('etapas e linhas', () => {
  it('mapeia pendências para a etapa certa', () => {
    expect(stepForField('title')).toBe(0)
    expect(stepForField('coverSrc')).toBe(1)
    expect(stepForField('checkoutUrl')).toBe(3)
    expect(stepForField('professionalId')).toBe(0)
    expect(groupIssuesByStep([{ field: 'modules', message: 'x' }])[0]!.step).toBe(1)
  })
  it('emptyLines ignora linhas vazias', () => {
    expect(emptyLines('a\n\n  b  \n')).toEqual(['a', 'b'])
  })
})
