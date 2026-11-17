'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { INSIGHT_DEVICES, INSIGHT_ORIGIN_LABEL, INSIGHT_ORIGINS, type Insights } from '@academia/contracts'
import { ProfessionalFilter } from '@/components/professional-filter'
import { PeriodFilter } from '@/components/period-filter'
import { DEVICE_LABEL, type InsightsFilters as Filters } from '@/lib/insights'

/** Linha de chips de um filtro (estilo `.tm-filter`, com "Todos" primeiro). */
function Chips({ label, value, options, onChoose }: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChoose: (value: string) => void
}) {
  return (
    <div className="ins-filter" role="group" aria-label={label}>
      <span className="ins-filter-label">{label}</span>
      <div className="tm-filters">
        {options.map((o) => (
          <button key={o.value || 'todos'} type="button" className="tm-filter" aria-pressed={value === o.value} onClick={() => onChoose(value === o.value ? '' : o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}

/**
 * Filtros da área Insights: período (atalhos e datas livres), profissional (cartões com foto), curso, aparelho e origem.
 * Tudo fica na URL. Login de profissional não vê o filtro de profissional (o servidor já prende ao dele).
 */
export function InsightsFilters({ filters, options, restricted }: { filters: Filters; options: Insights['options']; restricted: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const [from, setFrom] = useState(filters.from)
  const [to, setTo] = useState(filters.to)

  const apply = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false }))
  }
  const hrefFor = (days: number) => {
    const next = new URLSearchParams(params.toString())
    next.set('days', String(days)); next.delete('from'); next.delete('to')
    return `${pathname}?${next}`
  }
  const courses = options.courses.filter((c) => !filters.professionalId || c.professionalId === filters.professionalId)

  return (
    <section className="ins-filters" aria-label="Filtros" data-pending={pending || undefined}>
      <div className="ins-period">
        <PeriodFilter value={filters.preset} hrefFor={hrefFor} />
        <form className="ins-dates" onSubmit={(e) => { e.preventDefault(); apply({ from, to, days: '' }) }}>
          <label><span className="ds-label">De</span><input className="ds-input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span className="ds-label">Até</span><input className="ds-input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          <button type="submit" className="admin-button secondary" disabled={!from || !to || from > to}>Aplicar datas</button>
        </form>
      </div>
      {restricted ? null : (
        <ProfessionalFilter reset={['courseId']} professionals={options.professionals.map((p) => ({ id: p.id, name: p.name, specialty: p.specialty, photo: p.photo }))} />
      )}
      {courses.length ? (
        <Chips label="Curso" value={String(filters.courseId ?? '')} onChoose={(v) => apply({ courseId: v })}
          options={[{ value: '', label: 'Todos os cursos' }, ...courses.map((c) => ({ value: String(c.id), label: c.title }))]} />
      ) : null}
      <div className="ins-filter-row">
        <Chips label="Aparelho" value={filters.device ?? ''} onChoose={(v) => apply({ device: v })}
          options={[{ value: '', label: 'Todos' }, ...INSIGHT_DEVICES.map((d) => ({ value: d, label: DEVICE_LABEL[d] }))]} />
        <Chips label="Origem" value={filters.origin ?? ''} onChoose={(v) => apply({ origin: v })}
          options={[{ value: '', label: 'Todas' }, ...INSIGHT_ORIGINS.map((o) => ({ value: o, label: INSIGHT_ORIGIN_LABEL[o] }))]} />
      </div>
    </section>
  )
}
