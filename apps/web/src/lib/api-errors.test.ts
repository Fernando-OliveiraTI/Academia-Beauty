import { describe, expect, it } from 'vitest'
import { describeApiError } from './api-errors'

describe('describeApiError', () => {
  it('a mensagem específica da tela vence', () => {
    expect(describeApiError(409, { code: 'slug_taken' }, 'Este endereço já está em uso.')).toBe('Este endereço já está em uso.')
  })
  it('mensagens padrão por status', () => {
    expect(describeApiError(0, null)).toMatch(/Sem conexão/)
    expect(describeApiError(401, null)).toMatch(/sessão expirou/)
    expect(describeApiError(403, null)).toMatch(/permissão/)
  })
  it('422 usa a mensagem da API; sem ela, o texto genérico', () => {
    expect(describeApiError(422, { message: 'Campo inválido' })).toBe('Campo inválido')
    expect(describeApiError(422, null)).toMatch(/Não foi possível concluir/)
    expect(describeApiError(500, { message: 'x' })).toMatch(/Não foi possível concluir/)
  })
})
