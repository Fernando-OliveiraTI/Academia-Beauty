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
  { key: 'basico', label: 'Dados básicos', hint: 'Informações principais', desc: 'Defina as informações principais do seu curso.' },
  { key: 'conteudo', label: 'Conteúdo', hint: 'Aulas, módulos e materiais', desc: 'Descrição, capa, benefícios, módulos e o que o aluno recebe.' },
  { key: 'confianca', label: 'Dúvidas e garantia', hint: 'Suporte e políticas', desc: 'Garantia, perguntas frequentes e depoimentos reais.' },
  { key: 'oferta', label: 'Oferta e checkout', hint: 'Preço, pagamento e acesso', desc: 'Preço, desconto, parcelas e o link de pagamento.' },
  { key: 'publicacao', label: 'Revisão e publicação', hint: 'Verifique e publique', desc: 'Confira as pendências e publique quando estiver tudo certo.' },
] as const

/** A etapa em que cada pendência é resolvida. */
export function stepForField(field: string): number {
  if (['title', 'slug', 'professionalId', 'audience', 'modality', 'level', 'workloadHours'].includes(field)) return 0
  if (['lead', 'coverSrc', 'coverAlt', 'benefits', 'modules', 'deliverables'].includes(field)) return 1
  if (['commercial', 'active', 'checkoutUrl', 'environment'].includes(field)) return 3
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

export const emptyLines = (value: string) => value.split('\n').map((l) => l.trim()).filter(Boolean)
