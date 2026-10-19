import type { HttpContext } from '@adonisjs/core/http'
import CheckoutStatusService, { isValidRef } from '#services/checkout_status_service'

/** Janela simples por IP em memória: a consulta é pública e a página faz polling. */
const hits = new Map<string, { count: number; reset: number }>()
const LIMIT_PER_MINUTE = 60
const MAX_TRACKED_IPS = 5000
function allowed(ip: string, now = Date.now()) {
  const entry = hits.get(ip)
  if (!entry || entry.reset <= now) {
    if (hits.size >= MAX_TRACKED_IPS) {
      for (const [key, value] of hits) if (value.reset <= now) hits.delete(key)
      if (hits.size >= MAX_TRACKED_IPS) return false
    }
    hits.set(ip, { count: 1, reset: now + 60_000 })
    return true
  }
  entry.count += 1
  return entry.count <= LIMIT_PER_MINUTE
}
export const resetCheckoutStatusLimiter = () => hits.clear()

/**
 * Situação do pagamento de uma visita, para a página do curso mostrar a confirmação. O código (`ref`) é aleatório,
 * gerado no navegador e devolvido pela The Members no webhook; quem não o conhece não consegue consultar nada, e a
 * resposta traz só a situação (nunca valor, nome, e-mail ou documento).
 */
export default class PublicCheckoutStatusController {
  async show({ request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    if (!allowed(request.ip())) return response.tooManyRequests({ message: 'Muitas requisições' })
    const ref = request.qs().ref
    if (!isValidRef(ref)) return response.badRequest({ message: 'Código inválido' })
    return CheckoutStatusService.forRef(ref)
  }
}
