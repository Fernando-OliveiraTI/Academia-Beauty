import type { HttpContext } from '@adonisjs/core/http'
import BaseDocumentsController from '#controllers/base_documents_controller'
import AuditService from '#services/audit_service'
import { HOME_ID, HOME_KIND } from '#services/document_service'
import { DomainError, toDomainError } from '#services/domain_error'
import HomeService, { ensureHomeRow, HOME_TAGS } from '#services/home_service'
import RevalidationService from '#services/revalidation_service'

/**
 * Documento da Home (Fase 7B). Reaproveita as ações de documento dos demais (ler, salvar com revisão,
 * restaurar, histórico) fixando o id da página única, e acrescenta o estado e a publicação.
 */
export default class AdminHomeController extends BaseDocumentsController {
  protected kind = HOME_KIND
  protected resource = 'home' as const

  #fixed(ctx: HttpContext) {
    ctx.params.id = String(HOME_ID)
    return ctx
  }

  override async show(ctx: HttpContext) {
    await ensureHomeRow()
    return super.show(this.#fixed(ctx))
  }
  override async save(ctx: HttpContext) {
    await ensureHomeRow()
    return super.save(this.#fixed(ctx))
  }
  override async clear(ctx: HttpContext) {
    await ensureHomeRow()
    return super.clear(this.#fixed(ctx))
  }
  override async versions(ctx: HttpContext) {
    await ensureHomeRow()
    return super.versions(this.#fixed(ctx))
  }
  override async restoreVersion(ctx: HttpContext) {
    await ensureHomeRow()
    return super.restoreVersion(this.#fixed(ctx))
  }

  async state() {
    return HomeService.admin()
  }

  async publish(ctx: HttpContext) {
    const actor = ctx.auth.getUserOrFail()
    try {
      const version = await HomeService.publish(actor.id)
      await AuditService.record(ctx, {
        action: 'home.publish',
        actorId: actor.id,
        resourceType: 'home',
        resourceId: HOME_ID,
        metadata: { version },
      })
      await RevalidationService.revalidate([...HOME_TAGS])
      return HomeService.admin()
    } catch (error) {
      const e = toDomainError(error)
      if (e instanceof DomainError) {
        return ctx.response
          .status(e.status)
          .send({ message: e.message, code: e.code, errors: e.details })
      }
      throw e
    }
  }
}
