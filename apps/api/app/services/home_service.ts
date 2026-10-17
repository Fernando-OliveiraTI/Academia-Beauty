import db from '@adonisjs/lucid/services/db'
import type { AdminHome, HomeCourseCard, PublicHome } from '@academia/contracts'
import CourseService from '#services/course_service'
import { assertValidDocument, HOME_ID, HOME_KIND } from '#services/document_service'
import { DomainError } from '#services/domain_error'
import ProfessionalService from '#services/professional_service'

export const HOME_TEMPLATE = { key: 'home-original', version: 1 } as const
/** Tags de cache do site que a Home usa: invalidar qualquer uma refaz a Home. */
export const HOME_TAGS = ['home', 'professionals', 'courses'] as const

/**
 * Garante a linha única da Home (id 1). A migração a cria, mas ela some em restauração parcial de backup ou
 * em `truncate`; criar sob demanda (idempotente) evita que a Home vire 404 por causa disso.
 */
export async function ensureHomeRow() {
  await db.rawQuery(
    'insert ignore into home_pages (id, status, revision, data, name, document_revision, created_at) values (?, ?, ?, ?, ?, ?, ?)',
    [HOME_ID, 'draft', 1, JSON.stringify({ name: 'Home' }), 'Home', 0, new Date()]
  )
}

const parse = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : (value ?? null))

type HomeRow = {
  status: 'draft' | 'published'
  document_revision: number
  published_version: number | null
  published_document_revision: number | null
}

export default class HomeService {
  static async admin(): Promise<AdminHome> {
    await ensureHomeRow()
    const row = (await db.from('home_pages').where('id', HOME_ID).first()) as HomeRow | undefined
    if (!row) throw new DomainError(404, 'not_found', 'Home não encontrada')
    return {
      status: row.status,
      publishedVersion: row.published_version,
      publishedDocumentRevision: row.published_document_revision,
      documentRevision: row.document_revision,
      hasUnpublishedChanges:
        row.published_version === null
          ? row.document_revision > 0
          : row.published_document_revision !== row.document_revision,
    }
  }

  /** Publica o rascunho: revalida o documento e grava um snapshot imutável, numa transação. */
  static async publish(actorId: number) {
    await ensureHomeRow()
    return db.transaction(async (trx) => {
      const row = await trx.from('home_pages').where('id', HOME_ID).forUpdate().first()
      if (!row) throw new DomainError(404, 'not_found', 'Home não encontrada')
      const document = parse(row.document)
      // O schema pode ter mudado desde o salvamento: o documento é revalidado na publicação.
      if (document) assertValidDocument(HOME_KIND, document)
      const last = await trx
        .from('home_versions')
        .where('home_id', HOME_ID)
        .max('version as v')
        .first()
      const version = Number(last?.v ?? 0) + 1
      const now = new Date()
      await trx.table('home_versions').insert({
        home_id: HOME_ID,
        version,
        data: JSON.stringify(parse(row.data)),
        document: document ? JSON.stringify(document) : null,
        template_key: HOME_TEMPLATE.key,
        template_version: HOME_TEMPLATE.version,
        published_by: actorId,
        created_at: now,
      })
      await trx.from('home_pages').where('id', HOME_ID).update({
        status: 'published',
        published_version: version,
        published_revision: row.revision,
        published_document_revision: row.document_revision,
        published_at: now,
        updated_by: actorId,
        updated_at: now,
      })
      return version
    })
  }

  /**
   * Leitura pública: documento do snapshot vigente (nulo = Home nunca personalizada) e as partes
   * dinâmicas do catálogo, sempre atuais. Lê só snapshots publicados.
   */
  static async publicView(): Promise<PublicHome> {
    await ensureHomeRow()
    const row = await db.from('home_pages').where('id', HOME_ID).first()
    let version: number | null = null
    let document: unknown = null
    if (row?.published_version) {
      const snap = await db
        .from('home_versions')
        .where('home_id', HOME_ID)
        .where('version', row.published_version)
        .first()
      if (snap) {
        version = snap.version as number
        document = parse(snap.document)
      }
    }
    const [professionals, courses] = await Promise.all([
      ProfessionalService.showcase(),
      CourseService.homeCards() as Promise<HomeCourseCard[]>,
    ])
    return { version, document, professionals, courses }
  }
}
