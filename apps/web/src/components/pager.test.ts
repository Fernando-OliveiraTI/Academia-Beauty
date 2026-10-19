import { describe, expect, it } from 'vitest'
import { pageWindow } from './pager'

describe('pageWindow', () => {
  it('lista tudo quando são poucas páginas', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5])
  })
  it('abrevia com reticências mantendo primeira, última e vizinhança', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 'gap', 19, 20])
    expect(pageWindow(10, 20)).toEqual([1, 2, 'gap', 9, 10, 11, 'gap', 19, 20])
    expect(pageWindow(20, 20)).toEqual([1, 2, 'gap', 19, 20])
  })
  it('não deixa reticências no lugar de uma única página', () => {
    expect(pageWindow(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 9, 10])
  })
})

import { lastPageOf } from './pager'

describe('lastPageOf', () => {
  it('nunca é menor que 1 e arredonda para cima', () => {
    expect(lastPageOf(0, 20)).toBe(1)
    expect(lastPageOf(20, 20)).toBe(1)
    expect(lastPageOf(21, 20)).toBe(2)
  })
})
