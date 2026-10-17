import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  commercialReadiness,
  computeOffer,
  courseReadiness,
  parseAllowedHosts,
  validateCheckoutUrl,
  type AdminCourse,
  type CommercialInput,
  type CommercialView,
  type CourseCard,
  type CourseData,
  type PublicCourse,
  type UpdateCommercialInput,
} from '@academia/contracts'
import env from '#start/env'
import CommercialConfig from '#models/commercial_config'
import Course from '#models/course'
import CourseVersion from '#models/course_version'
import Professional from '#models/professional'
import ProfessionalVersion from '#models/professional_version'
import { DomainError } from '#services/domain_error'
import { COURSE_KIND, assertValidDocument } from '#services/document_service'

/** Template usado nas páginas de curso (a composição vive em @academia/page-renderer). */
export const COURSE_TEMPLATE = { key: 'course-original', version: 1 }

export const allowedCheckoutHosts = () => parseAllowedHosts(env.get('CHECKOUT_ALLOWED_HOSTS'))

export const courseTags = (slug: string, professionalSlug: string) => [
  'courses',
  `course:${slug}`,
  `professional:${professionalSlug}`,
]

export function toCommercialView(c: CommercialConfig | null): CommercialView | null {
  if (!c) return null
  return {
    revision: c.revision,
    mode: 'redirect',
    currency: 'BRL',
    listCents: c.listCents,
    discountPct: c.discountPct,
    maxInstallments: c.maxInstallments,
    checkoutUrl: c.checkoutUrl,
    environment: c.environment,
    active: c.active,
  }
}

export function commercialInput(view: CommercialView | CommercialConfig): CommercialInput {
  return {
    listCents: view.listCents,
    discountPct: view.discountPct,
    maxInstallments: view.maxInstallments,
    checkoutUrl: view.checkoutUrl,
    environment: view.environment,
    active: view.active,
  }
}

export function toAdmin(
  course: Course,
  professionalName: string,
  commercial: CommercialConfig | null
): AdminCourse {
  return {
    id: course.id,
    professionalId: course.professionalId,
    professionalName,
    slug: course.slug,
    status: course.status,
    revision: course.revision,
    data: course.data,
    commercial: toCommercialView(commercial),
    showcaseVisible: course.showcaseVisible,
    showcaseOrder: course.showcaseOrder,
    featured: course.featured,
    publishedVersion: course.publishedVersion,
    publishedAt: course.publishedAt?.toISO() ?? null,
    hasUnpublishedChanges:
      course.status === 'published' &&
      (course.publishedRevision !== course.revision ||
        course.publishedCommercialRevision !== (commercial?.revision ?? 0) ||
        (course.publishedDocumentRevision ?? 0) !== course.documentRevision),
    documentRevision: course.documentRevision,
    updatedAt: (course.updatedAt ?? course.createdAt).toISO()!,
  }
}

async function slugTaken(slug: string, exceptId?: number) {
  const query = Course.query().where('slug', slug)
  if (exceptId) query.whereNot('id', exceptId)
  return (await query.first()) !== null
}

async function hasVersions(courseId: number, trx: TransactionClientContract) {
  const row = await trx.from('course_versions').where('course_id', courseId).first()
  return row !== undefined && row !== null
}

export default class CourseService {
  /** Carrega o curso com o nome do profissional e a oferta (para respostas administrativas). */
  static async load(id: number) {
    const course = await Course.find(id)
    if (!course) return null
    return CourseService.hydrate(course)
  }

  static async hydrate(course: Course) {
    const professional = await Professional.find(course.professionalId)
    const commercial = await CommercialConfig.findBy('courseId', course.id)
    return { course, professional: professional!, commercial }
  }

  static async create(professionalId: number, slug: string, data: CourseData, actorId: number) {
    const professional = await Professional.find(professionalId)
    if (!professional)
      throw new DomainError(404, 'professional_not_found', 'Profissional não encontrado')
    if (professional.status === 'archived') {
      throw new DomainError(422, 'professional_archived', 'O profissional está arquivado')
    }
    if (await slugTaken(slug)) throw new DomainError(409, 'slug_taken', 'Este slug já está em uso')
    return Course.create({
      professionalId,
      slug,
      data,
      title: data.title,
      status: 'draft',
      revision: 1,
      createdBy: actorId,
      updatedBy: actorId,
    })
  }

  static async update(
    id: number,
    input: { slug?: string; data: CourseData; revision: number },
    actorId: number
  ) {
    return db.transaction(async (trx) => {
      const current = await Course.query({ client: trx }).where('id', id).forUpdate().first()
      if (!current) throw new DomainError(404, 'not_found', 'Curso não encontrado')
      if (current.status === 'archived') {
        throw new DomainError(422, 'archived', 'Restaure o curso antes de editar')
      }
      if (current.revision !== input.revision) {
        throw new DomainError(
          409,
          'revision_conflict',
          'Outra pessoa alterou este curso. Recarregue para continuar.'
        )
      }
      if (input.slug && input.slug !== current.slug) {
        if (current.publishedVersion !== null || (await hasVersions(id, trx))) {
          throw new DomainError(422, 'slug_locked', 'O slug não muda depois da primeira publicação')
        }
        if (await slugTaken(input.slug, id)) {
          throw new DomainError(409, 'slug_taken', 'Este slug já está em uso')
        }
        current.slug = input.slug
      }
      current.data = input.data
      current.title = input.data.title
      current.revision += 1
      current.updatedBy = actorId
      current.useTransaction(trx)
      await current.save()
      return current
    })
  }

  /**
   * Grava a oferta (Modo A). O link precisa ser https de domínio autorizado; o preço é sempre
   * definido aqui, nunca pela página ou pelo navegador do comprador.
   */
  static async saveCommercial(courseId: number, input: UpdateCommercialInput, actorId: number) {
    return db.transaction(async (trx) => {
      const course = await Course.query({ client: trx }).where('id', courseId).forUpdate().first()
      if (!course) throw new DomainError(404, 'not_found', 'Curso não encontrado')
      if (course.status === 'archived') {
        throw new DomainError(422, 'archived', 'Restaure o curso antes de editar a oferta')
      }
      const current = await CommercialConfig.query({ client: trx })
        .where('course_id', courseId)
        .first()
      if ((current?.revision ?? 0) !== input.revision) {
        throw new DomainError(
          409,
          'revision_conflict',
          'Outra pessoa alterou a oferta. Recarregue para continuar.'
        )
      }
      let checkoutUrl = ''
      if (input.checkoutUrl) {
        const check = validateCheckoutUrl(input.checkoutUrl, allowedCheckoutHosts())
        if (!check.ok) {
          throw new DomainError(422, 'checkout_url_invalid', check.reason, [
            { field: 'checkoutUrl', message: check.reason },
          ])
        }
        checkoutUrl = check.url
      }
      if (input.active && !checkoutUrl) {
        throw new DomainError(
          422,
          'checkout_url_required',
          'Informe o link de checkout para ativar a oferta',
          [{ field: 'checkoutUrl', message: 'Informe o link de checkout para ativar a oferta' }]
        )
      }
      const values = {
        listCents: input.listCents,
        discountPct: input.discountPct,
        maxInstallments: input.maxInstallments,
        checkoutUrl,
        environment: input.environment,
        active: input.active,
        provider: 'redirect',
        currency: 'BRL',
        updatedBy: actorId,
      }
      if (current) {
        const previous = commercialInput(current)
        current.merge({ ...values, revision: current.revision + 1 })
        current.useTransaction(trx)
        await current.save()
        return { config: current, previous }
      }
      const config = await CommercialConfig.create(
        { courseId, revision: 1, ...values },
        { client: trx }
      )
      return { config, previous: null }
    })
  }

  /** Publica: conteúdo e oferta completos, profissional publicado; grava snapshot imutável. */
  static async publish(id: number, actorId: number) {
    return db.transaction(async (trx) => {
      const current = await Course.query({ client: trx }).where('id', id).forUpdate().first()
      if (!current) throw new DomainError(404, 'not_found', 'Curso não encontrado')
      if (current.status === 'archived') {
        throw new DomainError(422, 'archived', 'Restaure o curso antes de publicar')
      }
      const professional = await Professional.query({ client: trx })
        .where('id', current.professionalId)
        .first()
      if (!professional || professional.status !== 'published') {
        throw new DomainError(
          422,
          'professional_not_published',
          'Publique o profissional antes de publicar o curso',
          [{ field: 'professionalId', message: 'O profissional ainda não está publicado' }]
        )
      }
      const config = await CommercialConfig.query({ client: trx }).where('course_id', id).first()
      const issues = [
        ...courseReadiness(current.data),
        ...commercialReadiness(config ? commercialInput(config) : null, allowedCheckoutHosts()),
      ]
      if (issues.length) {
        throw new DomainError(422, 'not_ready', 'O curso está incompleto para publicar', issues)
      }
      // O documento do editor é revalidado na publicação (o schema pode ter mudado desde o salvamento).
      if (current.document) assertValidDocument(COURSE_KIND, current.document)
      // Oferta de teste (sandbox) não vai ao ar em produção.
      if (config!.environment === 'sandbox' && env.get('NODE_ENV') === 'production') {
        throw new DomainError(422, 'not_ready', 'A oferta está em ambiente de teste (sandbox)', [
          { field: 'environment', message: 'Use o ambiente de produção para publicar' },
        ])
      }

      const last = await trx
        .from('course_versions')
        .where('course_id', id)
        .max('version as v')
        .first()
      const version = Number(last?.v ?? 0) + 1
      await CourseVersion.create(
        {
          courseId: id,
          version,
          data: current.data,
          document: current.document,
          commercial: commercialInput(config!),
          templateKey: COURSE_TEMPLATE.key,
          templateVersion: COURSE_TEMPLATE.version,
          publishedBy: actorId,
        },
        { client: trx }
      )
      current.status = 'published'
      current.publishedVersion = version
      current.publishedRevision = current.revision
      current.publishedDocumentRevision = current.documentRevision
      current.publishedCommercialRevision = config!.revision
      current.publishedAt = DateTime.now()
      current.updatedBy = actorId
      current.useTransaction(trx)
      await current.save()
      return current
    })
  }

  static async transition(
    id: number,
    action: 'unpublish' | 'archive' | 'restore',
    actorId: number
  ) {
    return db.transaction(async (trx) => {
      const current = await Course.query({ client: trx }).where('id', id).forUpdate().first()
      if (!current) throw new DomainError(404, 'not_found', 'Curso não encontrado')

      if (action === 'restore') {
        if (current.status !== 'archived') {
          throw new DomainError(422, 'invalid_state', 'O curso não está arquivado')
        }
        current.status = 'draft'
      } else if (action === 'unpublish') {
        if (current.status !== 'published') {
          throw new DomainError(422, 'invalid_state', 'O curso não está publicado')
        }
        current.status = 'draft'
      } else {
        if (current.status === 'archived') {
          throw new DomainError(422, 'invalid_state', 'O curso já está arquivado')
        }
        current.status = 'archived'
      }
      if (action !== 'restore') {
        current.publishedVersion = null
        current.publishedRevision = null
        current.publishedDocumentRevision = null
        current.publishedCommercialRevision = null
        current.publishedAt = null
      }
      current.updatedBy = actorId
      current.useTransaction(trx)
      await current.save()
      return current
    })
  }

  static async setShowcase(
    id: number,
    input: { showcaseVisible: boolean; showcaseOrder: number; featured: boolean },
    actorId: number
  ) {
    const current = await Course.find(id)
    if (!current) throw new DomainError(404, 'not_found', 'Curso não encontrado')
    if (current.status === 'archived') {
      throw new DomainError(422, 'archived', 'Restaure o curso primeiro')
    }
    current.merge({ ...input, updatedBy: actorId })
    await current.save()
    return current
  }

  /** Slugs dos cursos publicados de um profissional (para invalidar o cache em cascata). */
  static async publishedSlugsOf(professionalId: number): Promise<string[]> {
    const rows = await Course.query()
      .where('professional_id', professionalId)
      .where('status', 'published')
      .select('slug')
    return rows.map((r) => r.slug)
  }

  /** Cursos publicados na vitrine do profissional, na ordem definida. Lê só os snapshots. */
  static async cardsFor(professionalId: number): Promise<CourseCard[]> {
    const rows = await db
      .from('courses as c')
      .join('course_versions as v', (join) =>
        join.on('v.course_id', 'c.id').andOn('v.version', 'c.published_version')
      )
      .where('c.professional_id', professionalId)
      .where('c.status', 'published')
      .where('c.showcase_visible', true)
      .orderBy([{ column: 'c.showcase_order' }, { column: 'c.title' }])
      .limit(12)
      .select('c.slug', 'v.data', 'v.commercial')
    return rows.map((row) => {
      const data = parse<CourseData>(row.data)
      const commercial = parse<CommercialInput>(row.commercial)
      return {
        slug: row.slug as string,
        title: data.title,
        coverSrc: data.coverSrc,
        coverAlt: data.coverAlt,
        discountPct: commercial.discountPct,
      }
    })
  }

  /**
   * Curso publicado, só se o profissional também estiver publicado. A oferta é calculada aqui,
   * a partir do snapshot, e o link de checkout é revalidado contra a lista de domínios atual.
   */
  static async published(slug: string): Promise<PublicCourse | null> {
    const course = await Course.query().where('slug', slug).where('status', 'published').first()
    if (!course || course.publishedVersion === null) return null
    const professional = await Professional.find(course.professionalId)
    if (
      !professional ||
      professional.status !== 'published' ||
      professional.publishedVersion === null
    ) {
      return null
    }
    const [version, professionalVersion] = await Promise.all([
      CourseVersion.query()
        .where('course_id', course.id)
        .where('version', course.publishedVersion)
        .first(),
      ProfessionalVersion.query()
        .where('professional_id', professional.id)
        .where('version', professional.publishedVersion)
        .first(),
    ])
    if (!version || !professionalVersion) return null
    const commercial = version.commercial
    // "Pausar vendas": desativar a oferta vale na hora, sem republicar (o preço continua o do snapshot).
    const live = await CommercialConfig.findBy('courseId', course.id)
    const check =
      commercial.active && live?.active
        ? validateCheckoutUrl(commercial.checkoutUrl, allowedCheckoutHosts())
        : null
    return {
      slug: course.slug,
      version: version.version,
      publishedAt: version.createdAt.toISO()!,
      templateKey: version.templateKey,
      templateVersion: version.templateVersion,
      data: version.data,
      document: version.document ?? null,
      offer: computeOffer(commercial),
      checkout: { mode: 'redirect', url: check?.ok ? check.url : null },
      professional: { slug: professional.slug, data: professionalVersion.data },
    }
  }
}

function parse<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T
}
