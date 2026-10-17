import { describe, expect, it } from 'vitest'
import { stableStringify } from './stable'

describe('stableStringify', () => {
  it('ignora a ordem das chaves em qualquer profundidade e preserva a ordem de listas', () => {
    expect(stableStringify({ b: 1, a: { d: [1, 2], c: null } })).toBe(stableStringify({ a: { c: null, d: [1, 2] }, b: 1 }))
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]))

  })
  it('diferencia valores distintos', () => {
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: '1' }))
  })
})
