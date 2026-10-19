/** Formatação de valores do painel (pt-BR). Fonte única: não recrie `Intl.NumberFormat` nas telas. */

/** Centavos em reais: `29700` → `R$ 297,00`. */
export const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

/** Como `brl`, na moeda informada; `null` (valor ausente) vira "—". */
export const money = (cents: number | null, currency: string | null = 'BRL') =>
  cents === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency ?? 'BRL' }).format(cents / 100)
