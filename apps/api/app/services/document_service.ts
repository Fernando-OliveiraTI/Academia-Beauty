import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { validatePageDocument } from '@academia/section-schemas'
import { DomainError } from '#services/domain_error'

/** Descreve a tabela dona de um documento de página (profissional ou curso). */
export type DocumentKind = {
  table: 'professionals' | 'courses'
  versions: 'professional_versions' | 'course_versions'
  fk: 'professional_id' | 'course_id'
  /** Coluna de nome copiada de `data` (name/title). */
  nameColumn: 'name' | 'title'
  nameField: 'name' | 'title'
  templateKey: string
  label: string
}

export const PROFESSIONAL_KIND: DocumentKind = {
  table: 'professionals',
  versions: 'professional_versions',
  fk: 'professional_id',
  nameColumn: 'name',
  nameField: 'name',
  templateKey: 'professional-original',
  label: 'Profissional',
}

export const COURSE_KIND: DocumentKind = {
  table: 'courses',
  versions: 'course_versions',
  fk: 'course_id',
  nameColumn: 'title',
  nameField: 'title',
  templateKey: 'course-original',
  label: 'Curso',
}

const parse = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : (value ?? null))

export type DocumentState = {
  document: unknown | null
  documentRevision: number
  templateKey: string
  status: string
  /** Revisão do cadastro (`data`), para a UI avisar que o cadastro mudou depois do documento. */
  revision: number
}

export type VersionSummary = {
  version: number
  createdAt: string
  publishedBy: number | null
  hasDocument: boolean
  current: boolean
}

async function lock(kind: DocumentKind, id: number, trx: TransactionClientContract) {
  const row = await trx.from(kind.table).where('id', id).forUpdate().first()
  if (!row) throw new DomainError(404, 'not_found', `${kind.label} não encontrado`)
  if (row.status === 'archived') {
    throw new DomainError(422, 'archived', `Restaure antes de editar a página`)
  }
  return row
}

/** Validação autoritativa: schema de cada seção, template do tipo certo e tamanho razoável. */
export function assertValidDocument(kind: DocumentKind, input: unknown) {
  const result = validatePageDocument(input)
  if (!result.ok) {
    throw new DomainError(
      422,
      'invalid_document',
      'O documento da página é inválido',
      result.errors.slice(0, 50).map((message) => ({ field: 'document', message }))
    )
  }
  if (result.document.template.key !== kind.templateKey) {
    throw new DomainError(422, 'invalid_document', 'Template incompatível com esta página', [
      { field: 'document.template.key', message: `Esperado ${kind.templateKey}` },
    ])
  }
  return result.document
}

function assertRevision(current: number, expected: number) {
  if (current !== expected) {
    throw new DomainError(
      409,
      'revision_conflict',
      'Outra pessoa alterou esta página no editor. Recarregue para continuar.'
    )
  }
}

/** Hosts https externos presentes no documento (auditoria: quem publicou link para onde). */
export function externalHosts(document: unknown): string[] {
  const hosts = new Set<string>()
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      if (/^https:\/\//i.test(value)) {
        try {
          hosts.add(new URL(value).hostname.toLowerCase())
        } catch {
          /* URL inválida já é recusada pelo schema */
        }
      }
    } else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(document)
  return [...hosts].sort().slice(0, 30)
}

export default class DocumentService {
  static async get(kind: DocumentKind, id: number): Promise<DocumentState> {
    const row = await db.from(kind.table).where('id', id).first()
    if (!row) throw new DomainError(404, 'not_found', `${kind.label} não encontrado`)
    return {
      document: parse(row.document),
      documentRevision: row.document_revision,
      templateKey: kind.templateKey,
      status: row.status,
      revision: row.revision,
    }
  }

  /** Grava o documento do editor com concorrência otimista. `expectedRevision` 0 = primeira personalização. */
  static async save(
    kind: DocumentKind,
    id: number,
    input: { document: unknown; revision: number },
    actorId: number
  ) {
    const document = assertValidDocument(kind, input.document)
    return db.transaction(async (trx) => {
      const row = await lock(kind, id, trx)
      assertRevision(row.document_revision, input.revision)
      const next = row.document_revision + 1
      await trx
        .from(kind.table)
        .where('id', id)
        .update({
          document: JSON.stringify(document),
          document_revision: next,
          updated_by: actorId,
          updated_at: new Date(),
        })
      return next
    })
  }

  /** "Restaurar do cadastro": descarta o documento e volta à página derivada do cadastro. */
  static async clear(kind: DocumentKind, id: number, expectedRevision: number, actorId: number) {
    return db.transaction(async (trx) => {
      const row = await lock(kind, id, trx)
      assertRevision(row.document_revision, expectedRevision)
      const next = row.document_revision + 1
      await trx.from(kind.table).where('id', id).update({
        document: null,
        document_revision: next,
        updated_by: actorId,
        updated_at: new Date(),
      })
      return next
    })
  }

  static async versions(kind: DocumentKind, id: number): Promise<VersionSummary[]> {
    const owner = await db.from(kind.table).where('id', id).first()
    if (!owner) throw new DomainError(404, 'not_found', `${kind.label} não encontrado`)
    const rows = await db
      .from(kind.versions)
      .where(kind.fk, id)
      .orderBy('version', 'desc')
      .limit(100)
      .select(
        'version',
        'created_at',
        'published_by',
        db.raw('(document is not null) as has_document')
      )
    return rows.map((r) => ({
      version: r.version,
      createdAt: new Date(r.created_at).toISOString(),
      publishedBy: r.published_by ?? null,
      hasDocument: Boolean(r.has_document),
      current: owner.status === 'published' && owner.published_version === r.version,
    }))
  }

  /**
   * Volta o rascunho (cadastro + documento) ao estado de uma versão publicada. A versão em si é imutável
   * e continua no histórico; a oferta de cursos não é restaurada (módulo comercial separado).
   */
  static async restoreVersion(
    kind: DocumentKind,
    id: number,
    version: number,
    expectedRevision: number,
    actorId: number,
    expectedDataRevision?: number
  ) {
    return db.transaction(async (trx) => {
      const row = await lock(kind, id, trx)
      assertRevision(row.document_revision, expectedRevision)
      // Restaurar sobrescreve também o cadastro: não perder edição do assistente feita por outra pessoa.
      if (expectedDataRevision !== undefined && row.revision !== expectedDataRevision) {
        throw new DomainError(
          409,
          'revision_conflict',
          'O cadastro foi alterado por outra pessoa. Recarregue para continuar.'
        )
      }
      const snap = await trx
        .from(kind.versions)
        .where(kind.fk, id)
        .where('version', version)
        .first()
      if (!snap) throw new DomainError(404, 'version_not_found', 'Versão não encontrada')
      const data = parse(snap.data) as Record<string, unknown>
      const document = parse(snap.document)
      if (document !== null) assertValidDocument(kind, document)
      await trx
        .from(kind.table)
        .where('id', id)
        .update({
          data: JSON.stringify(data),
          [kind.nameColumn]: String(data[kind.nameField] ?? row[kind.nameColumn]),
          revision: row.revision + 1,
          document: document === null ? null : JSON.stringify(document),
          document_revision: row.document_revision + 1,
          updated_by: actorId,
          updated_at: new Date(),
        })
      return row.document_revision + 1
    })
  }
}
