import type { HttpContext } from '@adonisjs/core/http'
import CheckoutStatusService, { isValidRef } from '#services/checkout_status_service'
import IpRateLimit from '#services/ip_rate_limit'

const LIMIT_PER_MINUTE = 60

/**
 * Situação do pagamento de uma visita, para a página do curso mostrar a confirmação. O código (`ref`) é aleatório,
 * gerado no navegador e devolvido pela The Members no webhook; quem não o conhece não consegue consultar nada, e a
 * resposta traz só a situação (nunca valor, nome, e-mail ou documento).
 */
export default class PublicCheckoutStatusController {
  async show({ request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    if (!(await IpRateLimit.allow('checkout_status', request.ip(), LIMIT_PER_MINUTE)))
      return response.tooManyRequests({ message: 'Muitas requisições' })
    const ref = request.qs().ref
    if (!isValidRef(ref)) return response.badRequest({ message: 'Código inválido' })
    return CheckoutStatusService.forRef(ref)
  }
}
