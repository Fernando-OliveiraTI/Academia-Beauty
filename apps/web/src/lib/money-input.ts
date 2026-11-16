/** Máscaras e conversões dos campos de dinheiro e porcentagem do painel (sem ponto flutuante). */

/** "250,00" / "1.250,5" / "250" → centavos; vazio ou inválido → null. Nunca usa ponto flutuante. */
export function parseBRLToCents(input: string): number | null {
  const raw = input.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/\.(?=\d{3}(\D|$))/g, '')
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized)
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0')
  return Number.isSafeInteger(cents) ? cents : null
}

/** Máscara de reais enquanto digita: só os dígitos contam e entram como centavos ("25000" → "250,00", "1234567" → "12.345,67"). */
export function maskBRL(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 8) // até R$ 999.999,99
  if (!digits) return ''
  const padded = digits.padStart(3, '0')
  const whole = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${whole},${padded.slice(-2)}`
}

/** Máscara de porcentagem: só dígitos, até 2 casas, limitado ao máximo permitido (o símbolo % fica fora do valor). */
export function maskPercent(input: string, max = 90): string {
  const digits = input.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 3)
  if (!digits) return ''
  return String(Math.min(Number(digits), max))
}

/** 25000 → "250,00"; 123456 → "1.234,56" (campo de edição, sem símbolo). */
export function centsToInput(cents: number): string {
  return maskBRL(String(Math.max(0, Math.round(cents))))
}
