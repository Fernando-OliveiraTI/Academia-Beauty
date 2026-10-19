const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'always' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "há 2 horas", "há 3 dias"… Abaixo de 1 minuto (ou data no futuro) vira "agora". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000)
  if (!Number.isFinite(seconds) || seconds < 60) return 'agora'
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit)
  }
  return 'agora'
}
