import Link from 'next/link'

/** Períodos oferecidos nas telas de análise do painel (em dias). */
export const PERIOD_DAYS = [7, 30, 90] as const
export type PeriodDays = (typeof PERIOD_DAYS)[number]

/** Lê o `?days=` da URL: valor fora de `PERIOD_DAYS` cai no padrão (30). */
export function parsePeriod(raw: string | number | null | undefined, fallback: PeriodDays = 30): PeriodDays {
  const n = Number(raw)
  return (PERIOD_DAYS as readonly number[]).includes(n) ? (n as PeriodDays) : fallback
}

type Props = {
  value: number
  /** URL do período `days`, preservando o restante da tela. */
  hrefFor: (days: PeriodDays) => string
  options?: readonly PeriodDays[]
}

/** Seletor de período em pílula (dashboard, checkouts): cada opção é um link, o período vive na URL. */
export function PeriodFilter({ value, hrefFor, options = PERIOD_DAYS }: Props) {
  return (
    <nav className="period-filter" aria-label="Período">
      {options.map((d) => <Link key={d} href={hrefFor(d)} aria-current={d === value ? 'page' : undefined}>{d} dias</Link>)}
    </nav>
  )
}
