/** Parâmetros de URL compartilhados pelas listas do painel (busca, ordenação, itens por página, página). */

/** Opções de "Itens por página" (valores aceitos no `?perPage=`). */
export const PER_PAGE_VALUES = ['10', '20', '50']

/** `?page=` como número inteiro ≥ 1 (qualquer valor inválido vira 1). */
export const pageOf = (raw: string | undefined) => Math.max(1, Number(raw) || 1)

/** `?perPage=` só vale se for uma das opções oferecidas. */
export const isPerPage = (raw: string | undefined): raw is string => PER_PAGE_VALUES.includes(raw ?? '')

/**
 * URL de uma página da lista: mantém os filtros preenchidos (valor vazio é omitido) e põe `page` por último.
 * `listHref('/admin/x', { q: 'ana', sort: '' }, 2)` → `/admin/x?q=ana&page=2`.
 */
export function listHref(base: string, filters: Record<string, string | undefined>, page: number) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) next.set(key, value)
  next.set('page', String(page))
  return `${base}?${next}`
}
