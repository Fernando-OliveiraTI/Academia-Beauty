import type { HttpContext } from '@adonisjs/core/http'
import type { ZodType } from 'zod'
import { documentRevisionSchema, saveDocumentSchema } from '@academia/contracts'
import AuditService from '#services/audit_service'
import DocumentService, { externalHosts, type DocumentKind } from '#services/document_service'
import { DomainError, toDomainError } from '#services/domain_error'

function parse<T>(schema: ZodType<T>, input: unknown, ctx: HttpContext): T | null {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  ctx.response.unprocessableEntity({
    message: 'Dados inválidos',
    errors: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
  })
  return null
}

function fail(ctx: HttpContext, raw: unknown) {
  const error = toDomainError(raw)
  if (error instanceof DomainError) {
    return ctx.response
      .status(error.status)
      .send({ message: error.message, code: error.code, errors: error.details })
  }
  throw error
}

/**
 * Documento de página do editor visual (D-020), comum a profissionais e cursos. Só o rascunho muda:
 * o site público só enxerga o documento depois de publicar (snapshot), então nada aqui invalida cache.
 */
export default abstract class BaseDocumentsController {
  protected abstract kind: DocumentKind
  protected abstract resource: 'professional' | 'course' | 'home'

  async show(ctx: HttpContext) {
    try {
      return await DocumentService.get(this.kind, Number(ctx.params.id))
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async save(ctx: HttpContext) {
    const input = parse(saveDocumentSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const id = Number(ctx.params.id)
      const documentRevision = await DocumentService.save(this.kind, id, input, actor.id)
      // Links externos ficam registrados: quem edita a página pode apontar visitantes para fora.
      await this.#audit(ctx, 'document.save', id, {
        documentRevision,
        externalHosts: externalHosts(input.document),
      })
      return { documentRevision }
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async clear(ctx: HttpContext) {
    const input = parse(documentRevisionSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const id = Number(ctx.params.id)
      const documentRevision = await DocumentService.clear(this.kind, id, input.revision, actor.id)
      await this.#audit(ctx, 'document.reset', id, { documentRevision })
      return { documentRevision }
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async versions(ctx: HttpContext) {
    try {
      return { items: await DocumentService.versions(this.kind, Number(ctx.params.id)) }
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async restoreVersion(ctx: HttpContext) {
    const input = parse(documentRevisionSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const id = Number(ctx.params.id)
      const version = Number(ctx.params.version)
      const documentRevision = await DocumentService.restoreVersion(
        this.kind,
        id,
        version,
        input.revision,
        actor.id,
        input.dataRevision
      )
      await this.#audit(ctx, 'document.restore_version', id, { version, documentRevision })
      return { documentRevision }
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async #audit(ctx: HttpContext, action: string, id: number, metadata: Record<string, unknown>) {
    await AuditService.record(ctx, {
      action: `${this.resource}.${action}`,
      actorId: ctx.auth.getUserOrFail().id,
      resourceType: this.resource,
      resourceId: id,
      metadata,
    })
  }
}
