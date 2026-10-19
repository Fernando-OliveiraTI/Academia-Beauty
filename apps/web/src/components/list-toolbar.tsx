'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Option = { value: string; label: string }
export type StatusTab = { value: string; label: string; count: number; icon?: ReactNode }

type Props = {
  searchPlaceholder: string
  tabs: StatusTab[]
  sorts: Option[]
  perPageOptions?: number[]
  /** Mostra também um seletor "Status" (usa o mesmo parâmetro das abas). O valor vazio é a lista padrão. */
  statusOptions?: Option[]
  /** Filtro extra por lista (ex.: profissional do curso). `value` vazio = todos. */
  extra?: { name: string; label: string; options: Option[] }
}

const SearchIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
const SortIcon = () => <svg className="lt-lead" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4m0 16-3-3m3 3 3-3" /></svg>
const ChevronIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>

/**
 * Barra de filtros das listas do painel. Tudo vive na URL (compartilhável e com voltar do navegador):
 * a busca aplica depois de uma pausa na digitação e os demais controles aplicam na hora, sempre voltando à página 1.
 */
export function ListToolbar({ searchPlaceholder, tabs, sorts, perPageOptions = [10, 20, 50], statusOptions, extra }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const [q, setQ] = useState(params.get('q') ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const status = params.get('status') ?? ''
  const sort = params.get('sort') ?? sorts[0]!.value
  const perPage = params.get('perPage') ?? String(perPageOptions[1] ?? perPageOptions[0])

  const apply = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('page')
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false }))
  }

  // Mantém o campo em sincronia quando a URL muda por fora (voltar do navegador, "limpar filtros").
  useEffect(() => { setQ(params.get('q') ?? '') }, [params])
  useEffect(() => () => clearTimeout(timer.current), [])

  const onSearch = (value: string) => {
    setQ(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => apply({ q: value.trim() }), 350)
  }

  const dirty = Boolean(q || status || params.get('sort') || params.get('perPage') || (extra && params.get(extra.name)))

  return (
    <div className="lt" data-pending={pending ? '' : undefined}>
      <div className="lt-row">
        <label className="lt-search">
          <span className="sr-only">Buscar</span>
          <SearchIcon />
          <input type="search" value={q} maxLength={80} placeholder={searchPlaceholder} onChange={(e) => onSearch(e.target.value)} />
        </label>

        {extra ? (
          <label className="lt-select">
            <span>{extra.label}</span>
            <select value={params.get(extra.name) ?? ''} onChange={(e) => apply({ [extra.name]: e.target.value })}>
              <option value="">Todos</option>
              {extra.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronIcon />
          </label>
        ) : null}

        {statusOptions ? (
          <label className="lt-select">
            <span>Status</span>
            <select value={status} onChange={(e) => apply({ status: e.target.value })}>
              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronIcon />
          </label>
        ) : null}

        <label className="lt-select lt-select-icon">
          <span>Ordenar por</span>
          <SortIcon />
          <select value={sort} onChange={(e) => apply({ sort: e.target.value === sorts[0]!.value ? '' : e.target.value })}>
            {sorts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronIcon />
        </label>

        <label className="lt-select lt-select-pages">
          <span>Itens por página</span>
          <select value={perPage} onChange={(e) => apply({ perPage: e.target.value === String(perPageOptions[1] ?? perPageOptions[0]) ? '' : e.target.value })}>
            {perPageOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <ChevronIcon />
        </label>
      </div>

      <div className="lt-row lt-row-tabs">
        <div className="lt-tabs" role="tablist" aria-label="Situação">
          {tabs.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={status === t.value} onClick={() => apply({ status: t.value })}>
              {t.icon}{t.label}<em>{t.count}</em>
            </button>
          ))}
        </div>
        {dirty ? <button type="button" className="lt-clear" onClick={() => { setQ(''); start(() => router.replace(pathname, { scroll: false })) }}>Limpar filtros</button> : null}
      </div>
    </div>
  )
}
