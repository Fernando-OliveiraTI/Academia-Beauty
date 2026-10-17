import type { CourseData, ReadinessIssue } from '@academia/contracts'

export { canonical, fieldErrors, suggestSlug } from '../profissionais/form-model'

export const emptyCourseData: CourseData = {
  title: '',
  lead: '',
  modality: 'online',
  level: 'profissional',
  workloadHours: null,
  audience: '',
  coverSrc: '',
  coverAlt: '',
  benefits: [],
  modules: [],
  deliverables: [],
  faq: [],
  testimonials: [],
  guaranteeDays: null,
  metaDescription: '',
}

export const STEPS = [
  { key: 'basico', label: 'Dados básicos' },
  { key: 'conteudo', label: 'Conteúdo' },
  { key: 'confianca', label: 'Dúvidas e garantia' },
  { key: 'oferta', label: 'Oferta e checkout' },
  { key: 'publicacao', label: 'Revisão e publicação' },
] as const

/** A etapa em que cada pendência é resolvida. */
export function stepForField(field: string): number {
  if (['title', 'slug', 'professionalId', 'audience', 'modality', 'level', 'workloadHours'].includes(field)) return 0
  if (['lead', 'coverSrc', 'coverAlt', 'benefits', 'modules', 'deliverables'].includes(field)) return 1
  if (['commercial', 'active', 'checkoutUrl'].includes(field)) return 3
  return 2
}

export function groupIssuesByStep(issues: readonly ReadinessIssue[]) {
  return issues.map((issue) => ({ ...issue, step: stepForField(issue.field) }))
}

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

/** 25000 → "250,00" (campo de edição, sem símbolo). */
export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100)
  const frac = String(cents % 100).padStart(2, '0')
  return `${whole},${frac}`
}

export const emptyLines = (value: string) => value.split('\n').map((l) => l.trim()).filter(Boolean)
