import Link from 'next/link'

type Props = {
  page: number
  lastPage: number
  total: number
  perPage: number
  /** URL da página n, preservando filtros e ordenação. */
  hrefFor: (page: number) => string
}

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
export function Pager({ page, lastPage, total, perPage, hrefFor }: Props) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(total, page * perPage)
  return (
    <footer className="pager">
      <p className="pager-sum">Mostrando <b>{from}–{to}</b> de <b>{total}</b></p>
      {lastPage > 1 ? (
        <nav className="pager-nav" aria-label="Paginação">
          {page > 1 ? <Link className="pager-btn" href={hrefFor(page - 1)} aria-label="Página anterior" rel="prev"><Chevron dir="left" /></Link> : <span className="pager-btn" aria-disabled="true"><Chevron dir="left" /></span>}
          {pageWindow(page, lastPage).map((n, i) => n === 'gap'
            ? <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">…</span>
            : <Link key={n} className="pager-btn" href={hrefFor(n)} aria-label={`Página ${n}`} aria-current={n === page ? 'page' : undefined}>{n}</Link>)}
          {page < lastPage ? <Link className="pager-btn" href={hrefFor(page + 1)} aria-label="Próxima página" rel="next"><Chevron dir="right" /></Link> : <span className="pager-btn" aria-disabled="true"><Chevron dir="right" /></span>}
        </nav>
      ) : null}
    </footer>
  )
}
