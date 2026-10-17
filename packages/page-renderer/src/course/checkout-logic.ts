/** Máscaras e validações do formulário de dados do comprador (apenas UX: o servidor revalida). */

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

export const masks = {
  cpf: (v: string) =>
    onlyDigits(v).slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
  phone: (v: string) => {
    const d = onlyDigits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  },
};

export function isValidCPF(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export type BuyerField = 'name' | 'email' | 'cpf' | 'phone';
export const BUYER_FIELDS: readonly BuyerField[] = ['name', 'email', 'cpf', 'phone'];

/** Devolve `true` ou a mensagem de erro, com os mesmos textos do original. */
export const rules: Record<BuyerField, (v: string) => true | string> = {
  name: (v) => v.trim().split(/\s+/).filter((p) => p.length > 1).length >= 2 || 'Digite seu nome e sobrenome.',
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Digite um e-mail válido, como voce@email.com.',
  cpf: (v) => isValidCPF(v) || 'Este CPF não é válido. Confira os números.',
  phone: (v) => {
    const d = onlyDigits(v);
    return d.length === 10 || d.length === 11 || 'Digite o celular com DDD.';
  },
};
