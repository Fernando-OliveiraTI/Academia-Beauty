import type { HttpContext } from '@adonisjs/core/http'
import { insightsQuerySchema } from '@academia/contracts'
import InsightsService from '#services/insights_service'
import { DomainError, toDomainError } from '#services/domain_error'

/**
 * Área Insights (D-040). `insights.read` libera a rota; sem `insights.all`, o login só vê o profissional ligado a ele
 * (o filtro de profissional pedido é ignorado e o de curso precisa ser de um curso dele).
 */
export default class AdminInsightsController {
  async show(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const user = auth.getUserOrFail()
    await user.load('roles')
    const canSeeAll = user.permissions.includes('insights.all')
    if (!canSeeAll && !user.professionalId) {
      return response.forbidden({
        message: 'Este login não está ligado a um profissional.',
        code: 'no_professional',
      })
    }
    const parsed = insightsQuerySchema.safeParse(request.qs())
    if (!parsed.success) {
      return response.unprocessableEntity({
        message: 'Filtros inválidos',
        errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      })
    }
    try {
      return await InsightsService.overview(parsed.data, {
        canSeeAll,
        professionalId: user.professionalId ?? null,
      })
    } catch (raw) {
      const error = toDomainError(raw)
      if (error instanceof DomainError) {
        return response
          .status(error.status)
          .send({ message: error.message, code: error.code, errors: error.details })
      }
      throw error
    }
  }
}
