import type { HttpContext } from '@adonisjs/core/http'
import CheckoutSessionService from '#services/checkout_session_service'

/** Janela simples por IP em memória: o registro é público e a página chama uma vez por abertura do checkout. */
const hits = new Map<string, { count: number; reset: number }>()
const LIMIT_PER_MINUTE = 20
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
export const resetCheckoutSessionsLimiter = () => hits.clear()

/**
 * Registro da visita ao checkout (chamado pela página do curso quando o checkout aparece). Sempre 204: o visitante nunca vê
 * erro de métrica. IP, navegador e cidade vêm da própria requisição; o corpo traz só o que o navegador sabe (fuso, tela, origem).
 */
export default class PublicCheckoutSessionsController {
  async store({ request, response }: HttpContext) {
    if (!allowed(request.ip())) return response.tooManyRequests({ message: 'Muitas requisições' })
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
