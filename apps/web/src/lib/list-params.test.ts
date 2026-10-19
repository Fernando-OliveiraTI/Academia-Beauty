import { describe, expect, it } from 'vitest'
import { isPerPage, listHref, pageOf } from './list-params'

describe('list-params', () => {
  it('pageOf ignora valores inválidos', () => {
    expect(pageOf('3')).toBe(3)
    expect(pageOf('0')).toBe(1)
    expect(pageOf('-2')).toBe(1)
    expect(pageOf('x')).toBe(1)
    expect(pageOf(undefined)).toBe(1)
  })

  it('isPerPage só aceita as opções oferecidas', () => {
    expect(isPerPage('20')).toBe(true)
    expect(isPerPage('15')).toBe(false)
    expect(isPerPage(undefined)).toBe(false)
  })

  it('listHref omite filtros vazios e põe a página no fim', () => {
    expect(listHref('/admin/x', { status: 'ok', q: '', sort: undefined, perPage: '20' }, 2)).toBe('/admin/x?status=ok&perPage=20&page=2')
    expect(listHref('/admin/x', {}, 1)).toBe('/admin/x?page=1')
  })
})
