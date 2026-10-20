import { courseDataSchema, PRICE_MAX_CENTS, PRICE_MIN_CENTS } from '@academia/contracts'
import env from '#start/env'
import Course from '#models/course'
import Professional from '#models/professional'
import CommercialConfig from '#models/commercial_config'
import db from '@adonisjs/lucid/services/db'
import { DomainError } from '#services/domain_error'

const PRODUCTS_URL = 'https://api.themembers.com.br/api/v1/products'
const TIMEOUT_MS = 15_000
const MAX_PAGES = 20

/** Campos de produto da The Members que a sincronização usa. */
export type MembersProduct = {
  id: string
  title: string
  value: string
  status: string
}

export type SyncChange = {
  field: 'title' | 'price'
  label: string
  current: string | null
  incoming: string
}

/** Profissional do curso, para o filtro do modal (foto + nome). */
export type SyncProfessional = { id: number; name: string; photoSrc: string | null }

export type SyncItem = {
  courseId: number
  slug: string
  title: string
  coverSrc: string | null
  professional: SyncProfessional | null
  externalCourseId: string
  /** `not_found`: o ID não existe na The Members. */
  state: 'changes' | 'up_to_date' | 'not_found'
  membersStatus: string | null
  /** Nome do produto na The Members (para o usuário reconhecer o vínculo). */
  membersTitle: string | null
  changes: SyncChange[]
}

export type UnlinkedCourse = {
  courseId: number
  slug: string
  title: string
  coverSrc: string | null
  professional?: SyncProfessional | null
  /** Só quem já tem oferta cadastrada pode receber o ID (a oferta guarda o vínculo). */
  hasOffer: boolean
}

export type SyncPreview = {
  items: SyncItem[]
  /** Cursos da Academia sem ID da The Members (ignorados): o modal deixa preencher o ID. */
  withoutLink: number
  unlinkedCourses: UnlinkedCourse[]
  /** Produtos da The Members que nenhum curso da Academia referencia. */
  unlinkedProducts: { id: string; title: string; coverSrc: string | null }[]
}

/** "500.00" → 50000. Sem float; rejeita formatos inesperados (retorna null). */
export function valueToCents(value: unknown): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? '').trim())
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

export const formatBRL = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

type CourseRow = {
  id: number
  slug: string
  title: string
  coverSrc?: string | null
  professional?: SyncProfessional | null
  listCents: number | null
  externalId: string
}

/** Curso/profissional da Academia usado só para achar uma imagem de apoio de um produto sem vínculo. */
export type CoverCandidate = {
  title: string
  professionalName: string
  coverSrc: string | null
  photoSrc: string | null
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * A The Members não envia imagem do produto. Para dar um rosto à linha, procura na Academia o curso de mesmo
 * nome ("Profissional - Curso" ou só "Curso") e, na falta, a foto do profissional citado no início do título.
 * É só ilustração: nunca vincula nada.
 */
export function coverFor(productTitle: string, candidates: CoverCandidate[]): string | null {
  const wanted = normalize(productTitle)
  if (!wanted) return null
  const byCourse = candidates.find(
    (c) =>
      c.coverSrc &&
      (wanted === normalize(`${c.professionalName} ${c.title}`) || wanted === normalize(c.title))
  )
  if (byCourse) return byCourse.coverSrc
  const byPro = candidates.find(
    (c) =>
      c.photoSrc && c.professionalName && wanted.startsWith(`${normalize(c.professionalName)} `)
  )
  return byPro?.photoSrc ?? null
}

/** Compara os cursos vinculados com os produtos recebidos (puro, sem I/O). */
export function buildPreview(
  rows: CourseRow[],
  products: MembersProduct[],
  unlinkedCourses: UnlinkedCourse[],
  catalog: CoverCandidate[] = []
): SyncPreview {
  const byId = new Map(products.map((p) => [p.id, p] as const))
  const linked = new Set(rows.map((r) => r.externalId))
  const items = rows.map<SyncItem>((row) => {
    const base = {
      courseId: row.id,
      slug: row.slug,
      title: row.title,
      coverSrc: row.coverSrc ?? null,
      professional: row.professional ?? null,
      externalCourseId: row.externalId,
    }
    const product = byId.get(row.externalId)
    if (!product)
      return { ...base, state: 'not_found', membersStatus: null, membersTitle: null, changes: [] }
    const changes: SyncChange[] = []
    if (product.title.trim() !== row.title.trim()) {
      changes.push({
        field: 'title',
        label: 'Nome',
        current: row.title,
        incoming: product.title.trim(),
      })
    }
    const cents = valueToCents(product.value)
    if (cents !== null && cents !== row.listCents) {
      changes.push({
        field: 'price',
        label: 'Valor',
        current: row.listCents === null ? null : formatBRL(row.listCents),
        incoming: formatBRL(cents),
      })
    }
    return {
      ...base,
      state: changes.length ? 'changes' : 'up_to_date',
      membersStatus: product.status,
      membersTitle: product.title.trim(),
      changes,
    }
  })
  return {
    items,
    withoutLink: unlinkedCourses.length,
    unlinkedCourses,
    unlinkedProducts: products
      .filter((p) => !linked.has(p.id))
      .map((p) => ({ id: p.id, title: p.title, coverSrc: coverFor(p.title, catalog) })),
  }
}

/** Lê todos os produtos (paginação por cursor). O token só sai do servidor para a The Members. */
export async function fetchProducts(fetcher: typeof fetch = fetch): Promise<MembersProduct[]> {
  const token = env.get('TOKEN_THE_MEMBERS')
  if (!token) {
    throw new DomainError(503, 'themembers_not_configured', 'Token da The Members não configurado')
  }
  const products: MembersProduct[] = []
  let cursor: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(PRODUCTS_URL)
    if (cursor) url.searchParams.set('cursor', cursor)
    let res: Response
    try {
      res = await fetcher(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new DomainError(
        502,
        'themembers_unreachable',
        'Não foi possível falar com a The Members'
      )
    }
    if (!res.ok) {
      throw new DomainError(502, 'themembers_error', `A The Members respondeu ${res.status}`)
    }
    const body = (await res.json().catch(() => null)) as {
      data?: unknown
      meta?: { next_cursor?: string | null }
    } | null
    if (!body || !Array.isArray(body.data)) {
      throw new DomainError(502, 'themembers_error', 'Resposta inesperada da The Members')
    }
    for (const p of body.data as Record<string, unknown>[]) {
      if (typeof p.id !== 'string') continue
      products.push({
        id: p.id,
        title: String(p.title ?? ''),
        value: String(p.value ?? ''),
        status: String(p.status ?? ''),
      })
    }
    cursor = body.meta?.next_cursor ?? null
    if (!cursor) return products
  }
  throw new DomainError(502, 'themembers_error', 'Paginação da The Members não terminou')
}

export type ApplyResult = {
  courseId: number
  slug: string
  /** Campos gravados (`title`, `price`); vazio = nada mudou ou foi pulado. */
  applied: ('title' | 'price')[]
  skipped: string | null
}

export default class ThemembersSyncService {
  /** Resumo (sem gravar nada) do que mudaria nos cursos que têm ID da The Members. */
  async preview(fetcher?: typeof fetch): Promise<SyncPreview> {
    const courses = await Course.query().whereNot('status', 'archived')
    const configs = await CommercialConfig.query().whereIn(
      'course_id',
      courses.map((c) => c.id)
    )
    const byCourse = new Map(configs.map((c) => [c.courseId, c] as const))
    const proRows = await Professional.query().whereIn('id', [
      ...new Set(courses.map((c) => c.professionalId)),
    ])
    const professionals = new Map(proRows.map((p) => [p.id, p] as const))
    const professionalOf = (id: number): SyncProfessional | null => {
      const pro = professionals.get(id)
      if (!pro) return null
      return {
        id: pro.id,
        name: pro.name,
        photoSrc: pro.data.portraitSrc || pro.data.cardPhotoSrc || null,
      }
    }
    const rows: CourseRow[] = []
    const unlinkedCourses: UnlinkedCourse[] = []
    for (const c of courses) {
      const config = byCourse.get(c.id)
      const externalId = config?.externalCourseId?.trim() ?? ''
      if (!externalId) {
        unlinkedCourses.push({
          courseId: c.id,
          slug: c.slug,
          title: c.data.title,
          coverSrc: c.data.coverSrc ?? null,
          professional: professionalOf(c.professionalId),
          hasOffer: Boolean(config),
        })
        continue
      }
      rows.push({
        id: c.id,
        slug: c.slug,
        title: c.data.title,
        coverSrc: c.data.coverSrc ?? null,
        professional: professionalOf(c.professionalId),
        listCents: config ? config.listCents : null,
        externalId,
      })
    }
    if (!rows.length && !unlinkedCourses.length) {
      return { items: [], withoutLink: 0, unlinkedCourses, unlinkedProducts: [] }
    }
    const catalog = courses.map<CoverCandidate>((c) => {
      const pro = professionals.get(c.professionalId)
      return {
        title: c.data.title,
        professionalName: pro?.name ?? '',
        coverSrc: c.data.coverSrc ?? null,
        photoSrc: pro?.data.portraitSrc ?? null,
      }
    })
    return buildPreview(rows, await fetchProducts(fetcher), unlinkedCourses, catalog)
  }

  /**
   * Grava nome e valor da The Members nos cursos vinculados (os mesmos do resumo). Cada curso é uma transação:
   * um que falhe não desfaz os outros. Curso publicado fica com "alterações não publicadas" até republicar.
   * `courseIds` restringe aos cursos escolhidos no modal; sem ele, todos os vinculados (comportamento anterior).
   */
  async apply(
    actorId: number,
    fetcher?: typeof fetch,
    courseIds?: number[]
  ): Promise<ApplyResult[]> {
    if (courseIds && !courseIds.length) return []
    const query = CommercialConfig.query().whereNot('external_course_id', '')
    if (courseIds) query.whereIn('course_id', courseIds)
    const configs = await query
    if (!configs.length) return []
    const fetched = await fetchProducts(fetcher)
    const products = new Map(fetched.map((p) => [p.id, p] as const))
    const results: ApplyResult[] = []
    for (const linked of configs) {
      const product = products.get(linked.externalCourseId.trim())
      const base = { courseId: linked.courseId, slug: '', applied: [] as ApplyResult['applied'] }
      if (!product) continue
      results.push(
        await db.transaction(async (trx) => {
          const course = await Course.query({ client: trx })
            .where('id', linked.courseId)
            .forUpdate()
            .first()
          if (!course) return { ...base, skipped: 'Curso não encontrado' }
          const result: ApplyResult = { ...base, slug: course.slug, skipped: null }
          if (course.status === 'archived') return { ...result, skipped: 'Curso arquivado' }
          const config = await CommercialConfig.query({ client: trx })
            .where('course_id', course.id)
            .first()
          if (!config) return { ...result, skipped: 'Curso sem oferta' }

          const title = courseDataSchema.shape.title.safeParse(product.title.trim())
          const cents = valueToCents(product.value)
          const problems: string[] = []
          if (!title.success) problems.push('nome inválido na The Members')
          if (cents === null || cents < PRICE_MIN_CENTS || cents > PRICE_MAX_CENTS) {
            problems.push('valor fora do permitido')
          }
          if (title.success && title.data !== course.data.title) {
            course.data = { ...course.data, title: title.data }
            course.title = title.data
            course.revision += 1
            course.updatedBy = actorId
            course.useTransaction(trx)
            await course.save()
            result.applied.push('title')
          }
          if (
            cents !== null &&
            cents >= PRICE_MIN_CENTS &&
            cents <= PRICE_MAX_CENTS &&
            cents !== config.listCents
          ) {
            config.merge({ listCents: cents, revision: config.revision + 1, updatedBy: actorId })
            config.useTransaction(trx)
            await config.save()
            result.applied.push('price')
          }
          if (problems.length) result.skipped = problems.join('; ')
          return result
        })
      )
    }
    return results
  }

  /** Grava só o ID da The Members na oferta do curso (referência; não muda preço nem checkout). */
  async link(courseId: number, externalId: string, actorId: number) {
    return db.transaction(async (trx) => {
      const course = await Course.query({ client: trx }).where('id', courseId).forUpdate().first()
      if (!course) throw new DomainError(404, 'not_found', 'Curso não encontrado')
      if (course.status === 'archived') {
        throw new DomainError(422, 'archived', 'Restaure o curso antes de editar a oferta')
      }
      const config = await CommercialConfig.query({ client: trx })
        .where('course_id', courseId)
        .first()
      if (!config) {
        throw new DomainError(
          422,
          'offer_required',
          'Cadastre a oferta do curso antes de informar o ID'
        )
      }
      const taken = await CommercialConfig.query({ client: trx })
        .where('external_course_id', externalId)
        .whereNot('course_id', courseId)
        .first()
      if (taken) {
        throw new DomainError(409, 'external_id_taken', 'Este ID já está em outro curso')
      }
      const previous = config.externalCourseId ?? ''
      config.merge({
        externalCourseId: externalId,
        revision: config.revision + 1,
        updatedBy: actorId,
      })
      config.useTransaction(trx)
      await config.save()
      return { course, config, previous }
    })
  }

  /** Remove o vínculo (limpa o ID da The Members). Preço, nome e checkout do curso ficam como estão. */
  async unlink(courseId: number, actorId: number) {
    return db.transaction(async (trx) => {
      const course = await Course.query({ client: trx }).where('id', courseId).forUpdate().first()
      if (!course) throw new DomainError(404, 'not_found', 'Curso não encontrado')
      if (course.status === 'archived') {
        throw new DomainError(422, 'archived', 'Restaure o curso antes de editar a oferta')
      }
      const config = await CommercialConfig.query({ client: trx })
        .where('course_id', courseId)
        .first()
      if (!config) throw new DomainError(404, 'not_found', 'Este curso não tem oferta')
      const previous = config.externalCourseId ?? ''
      if (previous) {
        config.merge({ externalCourseId: '', revision: config.revision + 1, updatedBy: actorId })
        config.useTransaction(trx)
        await config.save()
      }
      return { course, config, previous }
    })
  }
}
