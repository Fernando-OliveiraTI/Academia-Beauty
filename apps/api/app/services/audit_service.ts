import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import telemetry from '#services/telemetry_service'

export type AuditEntry = {
  action: string
  actorId?: number | null
  resourceType?: string
  resourceId?: string | number
  metadata?: Record<string, unknown>
}

/** Registra eventos administrativos. Nunca grava senha, token ou corpo de requisição. */
export default class AuditService {
  static async record(ctx: Pick<HttpContext, 'request'> | null, entry: AuditEntry) {
    // A auditoria roda depois do commit: falhar aqui não pode virar 500 nem pular a revalidação do cache.
    try {
      await AuditService.#insert(ctx, entry)
      // Só o nome da ação e o tipo de recurso: sem ator, IP, ids nem metadados (alertas de login e publicações).
      telemetry.trackEvent(`audit.${entry.action}`, { resource: entry.resourceType })
    } catch (error) {
      logger.error({ err: error, action: entry.action }, 'falha ao gravar auditoria')
    }
  }

  static async #insert(ctx: Pick<HttpContext, 'request'> | null, entry: AuditEntry) {
    await db.table('audit_logs').insert({
      actor_id: entry.actorId ?? null,
      action: entry.action,
      resource_type: entry.resourceType ?? null,
      resource_id: entry.resourceId === undefined ? null : String(entry.resourceId),
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      ip: ctx?.request.ip().slice(0, 45) ?? null,
      user_agent: ctx?.request.header('user-agent')?.slice(0, 255) ?? null,
      created_at: new Date(),
    })
  }
}
