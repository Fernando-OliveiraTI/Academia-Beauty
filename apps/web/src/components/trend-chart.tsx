'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtInt, niceScale, shortDate, type DashboardDay } from '@/lib/dashboard'

const HEIGHT = 300
const PAD = { top: 16, right: 16, bottom: 30, left: 44 }

/**
 * Acessos × visitantes únicos por dia. Duas séries na mesma escala (nunca eixo duplo), legenda sempre visível,
 * cursor com dica ao passar o mouse ou usar as setas, e a mesma série em tabela para quem não enxerga cores.
 */
export function TrendChart({ series }: { series: DashboardDay[] }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const update = () => setWidth(Math.max(280, Math.floor(el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const g = useMemo(() => {
    const max = Math.max(0, ...series.map((d) => Math.max(d.views, d.visitors)))
    const scale = niceScale(max)
    const innerW = width - PAD.left - PAD.right
    const innerH = HEIGHT - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
    const y = (v: number) => PAD.top + innerH - (v / scale.top) * innerH
    const line = (key: 'views' | 'visitors') => series.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ')
    // O último dia ainda está em andamento: o trecho final vai tracejado para não parecer queda real.
    const tail = (key: 'views' | 'visitors') => (series.length > 1 ? `M${x(series.length - 2).toFixed(1)} ${y(series[series.length - 2]![key]).toFixed(1)} L${x(series.length - 1).toFixed(1)} ${y(series[series.length - 1]![key]).toFixed(1)}` : '')
    const head = (key: 'views' | 'visitors') => series.slice(0, -1).map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ')
    const area = `${line('views')} L${x(series.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`
    const every = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(innerW / 64))))
    return { scale, x, y, line, head, tail, area, every, innerH, empty: max === 0 }
  }, [series, width])

  const move = (clientX: number) => {
    const rect = wrap.current?.getBoundingClientRect()
    if (!rect || series.length === 0) return
    const rel = clientX - rect.left - PAD.left
    const step = (width - PAD.left - PAD.right) / Math.max(1, series.length - 1)
    setActive(Math.min(series.length - 1, Math.max(0, Math.round(rel / step))))
  }

  const day = active === null ? null : series[active]
  const tipLeft = day && active !== null ? Math.min(width - 190, Math.max(8, g.x(active) + 14)) : 0

  return (
    <div className="trend">
      <ul className="dash-legend" aria-label="Legenda">
        <li><i style={{ background: 'var(--viz-1)' }} />Acessos</li>
        <li><i style={{ background: 'var(--viz-2)' }} />Visitantes únicos</li>
      </ul>

      <div
        ref={wrap}
        className="trend-plot"
        tabIndex={0}
        role="img"
        aria-label={`Gráfico de acessos e visitantes únicos por dia, ${series.length} dias`}
        onPointerMove={(e) => move(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((a) => a ?? series.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? series.length) - 1))
          if (e.key === 'ArrowRight') setActive((a) => Math.min(series.length - 1, (a ?? -1) + 1))
        }}
      >
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--viz-1)" stopOpacity=".28" />
              <stop offset="100%" stopColor="var(--viz-1)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {g.scale.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={g.y(t)} y2={g.y(t)} className="trend-grid" />
              <text x={PAD.left - 10} y={g.y(t) + 4} textAnchor="end" className="trend-axis">{fmtInt(t)}</text>
            </g>
          ))}
          {series.map((d, i) => (i % g.every === 0 || i === series.length - 1) && (series.length - 1 - i >= g.every || i === series.length - 1) ? (
            <text key={d.date} x={g.x(i)} y={HEIGHT - 8} textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'} className="trend-axis">{shortDate(d.date)}</text>
          ) : null)}

          {!g.empty ? (
            <>
              <path d={g.area} fill="url(#trend-fill)" />
              <path d={g.head('visitors')} className="trend-line" stroke="var(--viz-2)" />
              <path d={g.tail('visitors')} className="trend-line trend-line-partial" stroke="var(--viz-2)" />
              <path d={g.head('views')} className="trend-line" stroke="var(--viz-1)" />
              <path d={g.tail('views')} className="trend-line trend-line-partial" stroke="var(--viz-1)" />
            </>
          ) : null}

          {day && active !== null ? (
            <g>
              <line x1={g.x(active)} x2={g.x(active)} y1={PAD.top} y2={PAD.top + g.innerH} className="trend-cursor" />
              <circle cx={g.x(active)} cy={g.y(day.visitors)} r="5" fill="var(--viz-2)" className="trend-dot" />
              <circle cx={g.x(active)} cy={g.y(day.views)} r="5" fill="var(--viz-1)" className="trend-dot" />
            </g>
          ) : null}
        </svg>

        {g.empty ? (
          <div className="trend-empty">
            <strong>Ainda sem acessos neste período</strong>
            <span>Os números aparecem assim que as páginas públicas forem visitadas.</span>
          </div>
        ) : null}

        {day ? (
          <div className="trend-tip" style={{ left: tipLeft, top: 12 }} role="status">
            <b>{shortDate(day.date)}{active === series.length - 1 ? ' · hoje (parcial)' : ''}</b>
            <span><i style={{ background: 'var(--viz-1)' }} />Acessos<em>{fmtInt(day.views)}</em></span>
            <span><i style={{ background: 'var(--viz-2)' }} />Visitantes<em>{fmtInt(day.visitors)}</em></span>
          </div>
        ) : null}
      </div>

      <details className="dash-table-toggle">
        <summary>Ver como tabela</summary>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Dia</th><th>Acessos</th><th>Visitantes</th><th>Cliques em comprar</th><th>Checkout</th></tr></thead>
            <tbody>
              {[...series].reverse().map((d) => (
                <tr key={d.date}><td>{shortDate(d.date)}</td><td>{fmtInt(d.views)}</td><td>{fmtInt(d.visitors)}</td><td>{fmtInt(d.cta)}</td><td>{fmtInt(d.checkout)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
