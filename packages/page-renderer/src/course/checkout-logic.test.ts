import { describe, expect, it } from 'vitest';
import { isValidCPF, masks, rules } from './checkout-logic';

describe('máscaras', () => {
  it('formata CPF progressivamente', () => {
    expect(masks.cpf('12345678901')).toBe('123.456.789-01');
    expect(masks.cpf('1234')).toBe('123.4');
    expect(masks.cpf('abc123456789012345')).toBe('123.456.789-01');
  });
  it('formata celular de 10 e 11 dígitos', () => {
    expect(masks.phone('1')).toBe('(1');
    expect(masks.phone('11987654321')).toBe('(11) 98765-4321');
    expect(masks.phone('1123456789')).toBe('(11) 2345-6789');
    expect(masks.phone('')).toBe('');
  });
});

describe('validações', () => {
  it('valida CPF pelos dígitos verificadores', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
    expect(isValidCPF('529.982.247-24')).toBe(false);
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCPF('123')).toBe(false);
  });
  it('exige nome e sobrenome', () => {
    expect(rules.name('Maria')).toBe('Digite seu nome e sobrenome.');
    expect(rules.name('Maria Souza')).toBe(true);
    expect(rules.name('Maria S')).toBe('Digite seu nome e sobrenome.');
  });
  it('valida e-mail e celular com os textos do original', () => {
    expect(rules.email('x@y')).toBe('Digite um e-mail válido, como voce@email.com.');
    expect(rules.email('maria@email.com')).toBe(true);
    expect(rules.phone('(11) 9')).toBe('Digite o celular com DDD.');
    expect(rules.phone('(11) 98765-4321')).toBe(true);
  });
});
