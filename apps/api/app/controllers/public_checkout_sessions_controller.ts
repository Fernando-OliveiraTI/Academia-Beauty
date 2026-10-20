import type { HttpContext } from '@adonisjs/core/http'
import CheckoutSessionService from '#services/checkout_session_service'
import IpRateLimit from '#services/ip_rate_limit'

const LIMIT_PER_MINUTE = 20

/**
 * Registro da visita ao checkout (chamado pela página do curso quando o checkout aparece). Sempre 204: o visitante nunca vê
 * erro de métrica. IP, navegador e cidade vêm da própria requisição; o corpo traz só o que o navegador sabe (fuso, tela, origem).
 */
export default class PublicCheckoutSessionsController {
  async store({ request, response }: HttpContext) {
    if (!(await IpRateLimit.allow('checkout_sessions', request.ip(), LIMIT_PER_MINUTE)))
      return response.tooManyRequests({ message: 'Muitas requisições' })
    const body = request.body() as Record<string, unknown>
    try {
      await CheckoutSessionService.register({
        ref: body.ref,
        body,
        ip: request.ip(),
        headers: request.headers() as Record<string, string | string[] | undefined>,
      })
    } catch {
      // métrica é opcional: falha de banco não pode afetar a página
    }
    return response.noContent()
  }
}
