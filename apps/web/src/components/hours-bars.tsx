'use client'

import { useEffect, useState } from 'react'

/** Visitas por hora do dia, convertidas do horário do servidor (UTC) para o fuso do navegador de quem está vendo. */
export function HoursBars({ hoursUtc }: { hoursUtc: number[] }) {
  const [offsetH, setOffsetH] = useState(0)
  useEffect(() => { setOffsetH(-new Date().getTimezoneOffset() / 60) }, [])
  const hours = Array.from({ length: 24 }, (_, h) => hoursUtc[(((h - offsetH) % 24) + 24) % 24] ?? 0)
  const max = Math.max(1, ...hours)
  return (
    <div>
      <div className="ai-hours" role="img" aria-label={`Visitas por hora: ${hours.map((n, h) => `${h}h ${n}`).join(', ')}`}>
        {hours.map((n, h) => (
          <div key={h} className="ai-hour" title={`${String(h).padStart(2, '0')}h: ${n} visitas`}>
            <span style={{ height: `${Math.max((n / max) * 100, n ? 6 : 0)}%` }} />
          </div>
        ))}
      </div>
      <div className="ai-axis"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
    </div>
  )
}
