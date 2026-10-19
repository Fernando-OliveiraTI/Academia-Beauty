import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  page: number
  lastPage: number
  total: number
  perPage: number
  /** URL da página n, preservando filtros e ordenação (listas paginadas pela URL). */
  hrefFor?: (page: number) => string
  /** Para listas paginadas no cliente (sem URL): chamado com o número da página escolhida. Use `hrefFor` OU `onPageChange`. */
  onPageChange?: (page: number) => void
}

/** Última página de uma lista: nunca menor que 1, mesmo vazia. */
export const lastPageOf = (total: number, perPage: number) => Math.max(1, Math.ceil(total / perPage))

/** 1 … 4 5 [6] 7 8 … 20: sempre a primeira, a última e a vizinhança da atual. */
export function pageWindow(page: number, last: number): (number | 'gap')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const wanted = new Set([1, 2, last - 1, last, page - 1, page, page + 1])
  const sorted = [...wanted].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push('gap')
    out.push(n)
  })
  return out
}

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'left' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
  </svg>
)

/** Rodapé das listas: resumo "Mostrando 21–40 de 52" e paginação numerada com setas em ícone. */
export function Pager({ page, lastPage, total, perPage, hrefFor, onPageChange }: Props) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(total, page * perPage)
  const item = (n: number, props: { label: string; current?: boolean; rel?: 'prev' | 'next' }, children: ReactNode) => hrefFor
    ? <Link key={props.label} className="pager-btn" href={hrefFor(n)} aria-label={props.label} aria-current={props.current ? 'page' : undefined} rel={props.rel}>{children}</Link>
    : <button key={props.label} type="button" className="pager-btn" aria-label={props.label} aria-current={props.current ? 'page' : undefined} onClick={() => onPageChange?.(n)}>{children}</button>
  return (
    <footer className="pager">
      <p className="pager-sum">Mostrando <b>{from}–{to}</b> de <b>{total}</b></p>
      {lastPage > 1 ? (
        <nav className="pager-nav" aria-label="Paginação">
          {page > 1 ? item(page - 1, { label: 'Página anterior', rel: 'prev' }, <Chevron dir="left" />) : <span className="pager-btn" aria-disabled="true"><Chevron dir="left" /></span>}
          {pageWindow(page, lastPage).map((n, i) => n === 'gap'
            ? <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">…</span>
            : item(n, { label: `Página ${n}`, current: n === page }, n))}
          {page < lastPage ? item(page + 1, { label: 'Próxima página', rel: 'next' }, <Chevron dir="right" />) : <span className="pager-btn" aria-disabled="true"><Chevron dir="right" /></span>}
        </nav>
      ) : null}
    </footer>
  )
}
