import { slugify, type ProfessionalData, type ReadinessIssue } from '@academia/contracts'

export const emptyProfessionalData: ProfessionalData = {
  name: '',
  specialty: '',
  tagline: '',
  experienceYears: null,
  instagramHandle: '',
  instagramFollowers: '',
  instagramUrl: '',
  portraitSrc: '',
  cardPhotoSrc: '',
  bio: [],
  works: [],
  videoSrc: '',
  metaDescription: '',
}

export const STEPS = [
  { key: 'identidade', label: 'Identidade' },
  { key: 'apresentacao', label: 'Apresentação' },
  { key: 'midia', label: 'Imagens e vídeo' },
  { key: 'conteudo', label: 'Trajetória e trabalhos' },
  { key: 'publicacao', label: 'Revisão e publicação' },
] as const

export function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2)
}

/** Slug sugerido a partir do nome, enquanto o usuário não editou o campo manualmente. */
export const suggestSlug = (name: string) => slugify(name)

/** { 'data.works.0.title': 'msg' } → { 'works.0.title': 'msg' } (remove o prefixo do envelope da API). */
export function fieldErrors(errors: ReadonlyArray<{ field: string; message: string }> | undefined) {
  const map: Record<string, string> = {}
  for (const e of errors ?? []) {
    const key = e.field.replace(/^data\./, '')
    if (!(key in map)) map[key] = e.message
  }
  return map
}

/** A etapa em que cada campo pendente é preenchido. */
export function stepForField(field: string): number {
  if (field === 'name' || field === 'specialty' || field === 'slug') return 0
  if (['tagline', 'experienceYears', 'instagramHandle', 'instagramFollowers', 'instagramUrl', 'metaDescription'].includes(field)) return 1
  if (['portraitSrc', 'cardPhotoSrc', 'videoSrc'].includes(field)) return 2
  return 3
}

export function groupIssuesByStep(issues: readonly ReadinessIssue[]) {
  return issues.map((issue) => ({ ...issue, step: stepForField(issue.field) }))
}

/** JSON com chaves ordenadas: o MySQL reordena as chaves de colunas JSON, então comparar strings cruas engana. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v
  )
}
