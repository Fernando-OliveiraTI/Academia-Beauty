import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import {
  publishReadiness,
  type AdminProfessional,
  type ProfessionalData,
  type PublicProfessional,
  type ShowcaseItem,
} from '@academia/contracts'
import Professional from '#models/professional'
import ProfessionalVersion from '#models/professional_version'
import CourseService from '#services/course_service'
import { DomainError, toDomainError } from '#services/domain_error'
import { PROFESSIONAL_KIND, assertValidDocument } from '#services/document_service'
import { publicStatuses, showDraftsPublicly } from '#services/public_visibility'

/** Template usado nas páginas de profissional (a composição vive em @academia/page-renderer). */
export const PROFESSIONAL_TEMPLATE = { key: 'professional-original', version: 1 }

export { DomainError, toDomainError }

export const professionalTags = (slug: string) => ['professionals', `professional:${slug}`]

export function toAdmin(p: Professional): AdminProfessional {
  return {
    id: p.id,
    slug: p.slug,
    status: p.status,
    revision: p.revision,
    data: p.data,
    templateKey: p.templateKey,
    homeVisible: p.homeVisible,
    homeOrder: p.homeOrder,
    featured: p.featured,
    publishedVersion: p.publishedVersion,
    publishedAt: p.publishedAt?.toISO() ?? null,
    hasUnpublishedChanges:
      p.status === 'published' &&
      (p.publishedRevision !== p.revision ||
        (p.publishedDocumentRevision ?? 0) !== p.documentRevision),
    documentRevision: p.documentRevision,
    updatedAt: (p.updatedAt ?? p.createdAt).toISO()!,
  }
}

async function slugTaken(slug: string, exceptId?: number) {
  const query = Professional.query().where('slug', slug)
  if (exceptId) query.whereNot('id', exceptId)
  return (await query.first()) !== null
}

/** Slug livre para a cópia: `<slug>-copia`, `<slug>-copia-2`… (respeita o limite de 80 caracteres). */
async function copySlug(slug: string, taken: (candidate: string) => Promise<boolean>) {
  for (let n = 1; n <= 50; n++) {
    const suffix = n === 1 ? '-copia' : `-copia-${n}`
    const candidate = `${slug.slice(0, 80 - suffix.length).replace(/-+$/, '')}${suffix}`
    if (!(await taken(candidate))) return candidate
  }
  throw new DomainError(409, 'slug_taken', 'Não foi possível gerar um endereço para a cópia')
}

export default class ProfessionalService {
  static async create(
    slug: string,
    data: ProfessionalData,
    actorId: number,
    templateKey = PROFESSIONAL_TEMPLATE.key as string
  ) {
    if (await slugTaken(slug)) throw new DomainError(409, 'slug_taken', 'Este slug já está em uso')
    return Professional.create({
      slug,
      data,
      name: data.name,
      templateKey,
      status: 'draft',
      revision: 1,
      createdBy: actorId,
      updatedBy: actorId,
    })
  }

  /**
   * Copia um profissional como rascunho novo: dados, modelo e documento do editor. Não leva publicação,
   * histórico de versões, vitrine nem cursos. O nome ganha " (cópia)" e o slug é gerado livre.
   */
  static async duplicate(id: number, actorId: number) {
    const source = await Professional.find(id)
    if (!source) throw new DomainError(404, 'not_found', 'Profissional não encontrado')
    const data = { ...source.data, name: `${source.data.name.slice(0, 73)} (cópia)` }
    const slug = await copySlug(source.slug, (candidate) => slugTaken(candidate))
    return Professional.create({
      slug,
      data,
      name: data.name,
      templateKey: source.templateKey,
      document: source.document ? structuredClone(source.document) : null,
      documentRevision: source.document ? source.documentRevision : 0,
      status: 'draft',
      revision: 1,
      createdBy: actorId,
      updatedBy: actorId,
    })
  }

  /** Grava o rascunho com concorrência otimista (`revision`). */
  static async update(
    id: number,
    input: { slug?: string; data: ProfessionalData; revision: number; templateKey?: string },
    actorId: number
  ) {
    return db.transaction(async (trx) => {
      const current = await Professional.query({ client: trx }).where('id', id).forUpdate().first()
      if (!current) throw new DomainError(404, 'not_found', 'Profissional não encontrado')
      if (current.status === 'archived') {
        throw new DomainError(422, 'archived', 'Restaure o profissional antes de editar')
      }
      if (current.revision !== input.revision) {
        throw new DomainError(
          409,
          'revision_conflict',
          'Outra pessoa alterou este cadastro. Recarregue para continuar.'
        )
      }
      if (input.slug && input.slug !== current.slug) {
        if (current.publishedVersion !== null || (await hasVersions(id, trx))) {
          throw new DomainError(422, 'slug_locked', 'O slug não muda depois da primeira publicação')
        }
        if (await slugTaken(input.slug, id))
          throw new DomainError(409, 'slug_taken', 'Este slug já está em uso')
        current.slug = input.slug
      }
      if (input.templateKey && input.templateKey !== current.templateKey) {
        // Documento e modelo andam juntos: trocar de modelo exige voltar a página ao cadastro antes.
        if (current.document !== null) {
          throw new DomainError(
            422,
            'template_locked',
            'A página foi personalizada no editor. Use "Restaurar do cadastro" antes de trocar o modelo.'
          )
        }
        current.templateKey = input.templateKey
      }
      current.data = input.data
      current.name = input.data.name
      current.revision += 1
      current.updatedBy = actorId
      current.useTransaction(trx)
      await current.save()
      return current
    })
  }

  /** Publica o rascunho: valida completude e grava um snapshot imutável, numa transação. */
  static async publish(id: number, actorId: number) {
    return db.transaction(async (trx) => {
      const current = await Professional.query({ client: trx }).where('id', id).forUpdate().first()
      if (!current) throw new DomainError(404, 'not_found', 'Profissional não encontrado')
      if (current.status === 'archived') {
        throw new DomainError(422, 'archived', 'Restaure o profissional antes de publicar')
      }
      const issues = publishReadiness(current.data)
      if (issues.length) {
        throw new DomainError(422, 'not_ready', 'O cadastro está incompleto para publicar', issues)
      }
      // O documento do editor é revalidado na publicação (o schema pode ter mudado desde o salvamento).
      if (current.document) {
        assertValidDocument(PROFESSIONAL_KIND, current.document, current.templateKey)
      }

      const last = await trx
        .from('professional_versions')
        .where('professional_id', id)
        .max('version as v')
        .first()
      const version = Number(last?.v ?? 0) + 1
      await ProfessionalVersion.create(
        {
          professionalId: id,
          version,
          data: current.data,
          document: current.document,
          templateKey: current.templateKey,
          templateVersion: PROFESSIONAL_TEMPLATE.version,
          publishedBy: actorId,
        },
        { client: trx }
      )
      current.status = 'published'
      current.publishedVersion = version
      current.publishedRevision = current.revision
      current.publishedDocumentRevision = current.documentRevision
      current.publishedAt = DateTime.now()
      current.updatedBy = actorId
      current.useTransaction(trx)
      await current.save()
      return current
    })
  }

  /** Tira do ar (publicado → rascunho) ou arquiva; o histórico de versões é preservado. */
  static async transition(
    id: number,
    action: 'unpublish' | 'archive' | 'restore',
    actorId: number
  ) {
    return db.transaction(async (trx) => {
      const current = await Professional.query({ client: trx }).where('id', id).forUpdate().first()
      if (!current) throw new DomainError(404, 'not_found', 'Profissional não encontrado')

      if (action === 'restore') {
        if (current.status !== 'archived')
          throw new DomainError(422, 'invalid_state', 'O profissional não está arquivado')
        current.status = 'draft'
      } else if (action === 'unpublish') {
        if (current.status !== 'published')
          throw new DomainError(422, 'invalid_state', 'O profissional não está publicado')
        current.status = 'draft'
      } else {
        if (current.status === 'archived')
          throw new DomainError(422, 'invalid_state', 'O profissional já está arquivado')
        current.status = 'archived'
      }
      if (action !== 'restore') {
        current.publishedVersion = null
        current.publishedRevision = null
        current.publishedDocumentRevision = null
        current.publishedAt = null
      }
      current.updatedBy = actorId
      current.useTransaction(trx)
      await current.save()
      return current
    })
  }

  /**
   * Apaga de vez (cadastro e versões publicadas). Só rascunho ou arquivado: quem está no ar precisa ser despublicado
   * antes, e profissional com cursos não sai (os cursos dependem dele; apague-os ou deixe o profissional arquivado).
   */
  static async destroy(id: number) {
    return db.transaction(async (trx) => {
      const current = await Professional.query({ client: trx }).where('id', id).forUpdate().first()
      if (!current) throw new DomainError(404, 'not_found', 'Profissional não encontrado')
      if (current.status === 'published')
        throw new DomainError(422, 'published', 'Despublique o profissional antes de apagar')
      const row = await trx.from('courses').where('professional_id', id).count('* as total').first()
      const courses = Number(row?.total ?? 0)
      if (courses > 0)
        throw new DomainError(
          409,
          'has_courses',
          `Este profissional tem ${courses} curso${courses === 1 ? '' : 's'}. Apague ${courses === 1 ? 'o curso' : 'os cursos'} antes.`
        )
      await trx.from('professional_versions').where('professional_id', id).delete()
      await trx.from('professionals').where('id', id).delete()
      return { id, slug: current.slug, name: current.name }
    })
  }

  static async setShowcase(
    id: number,
    input: { homeVisible: boolean; homeOrder: number; featured: boolean },
    actorId: number
  ) {
    const current = await Professional.find(id)
    if (!current) throw new DomainError(404, 'not_found', 'Profissional não encontrado')
    if (current.status === 'archived')
      throw new DomainError(422, 'archived', 'Restaure o profissional primeiro')
    current.merge({ ...input, updatedBy: actorId })
    await current.save()
    return current
  }

  /**
   * Vitrine da Home: publicados e marcados para a Home, na ordem definida. Lê só o snapshot (com
   * `PUBLIC_SHOW_DRAFTS`, fora de produção, rascunhos entram com os dados de trabalho).
   */
  static async showcase(): Promise<ShowcaseItem[]> {
    const rows = await db
      .from('professionals as p')
      .leftJoin('professional_versions as v', (join) =>
        join.on('v.professional_id', 'p.id').andOn('v.version', 'p.published_version')
      )
      .whereIn('p.status', publicStatuses())
      .where('p.home_visible', true)
      .orderBy([{ column: 'p.home_order' }, { column: 'p.name' }])
      .limit(24)
      .select('p.slug', 'p.status', 'p.data as live', 'v.data')
    return rows.flatMap((row) => {
      const raw = row.status === 'published' ? row.data : row.live
      if (!raw) return []
      const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ProfessionalData
      return [{ slug: row.slug as string, name: data.name, cardPhotoSrc: data.cardPhotoSrc }]
    })
  }

  static async published(slug: string): Promise<PublicProfessional | null> {
    const p = await Professional.query()
      .where('slug', slug)
      .whereIn('status', publicStatuses())
      .first()
    if (!p) return null
    if (showDraftsPublicly() && p.status === 'draft') {
      return {
        slug: p.slug,
        version: 1,
        publishedAt: (p.updatedAt ?? p.createdAt).toISO()!,
        templateKey: p.templateKey,
        templateVersion: PROFESSIONAL_TEMPLATE.version,
        data: p.data,
        document: p.document ?? null,
        courses: await CourseService.cardsFor(p.id),
      }
    }
    if (p.publishedVersion === null) return null
    const v = await ProfessionalVersion.query()
      .where('professional_id', p.id)
      .where('version', p.publishedVersion)
      .first()
    if (!v) return null
    return {
      slug: p.slug,
      version: v.version,
      publishedAt: v.createdAt.toISO()!,
      templateKey: v.templateKey,
      templateVersion: v.templateVersion,
      data: v.data,
      document: v.document ?? null,
      courses: await CourseService.cardsFor(p.id),
    }
  }
}

async function hasVersions(
  professionalId: number,
  trx: import('@adonisjs/lucid/types/database').TransactionClientContract
) {
  const row = await trx
    .from('professional_versions')
    .where('professional_id', professionalId)
    .first()
  return row !== undefined && row !== null
}
