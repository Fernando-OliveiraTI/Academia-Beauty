import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import ThemembersWebhookService from '#services/themembers_webhook_service'

/** Janela simples por IP em memória: o receptor é público (a assinatura é a defesa; isto só limita enchente). */
const hits = new Map<string, { count: number; reset: number }>()
const LIMIT_PER_MINUTE = 300
const MAX_TRACKED_IPS = 2000
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
export const resetWebhookLimiter = () => hits.clear()

/**
 * Receptor do webhook de checkout da The Members. Servidor→servidor: sem sessão e sem CSRF, autenticado pela assinatura
 * HMAC em `X-Signature` (validada sobre o corpo bruto, antes de qualquer regra de negócio). Responde 200 quando grava ou
 * quando o evento já tinha sido recebido (retentativa), 403 para assinatura inválida e 503 sem segredo configurado.
 */
export default class ThemembersWebhookController {
  async handle({ request, response }: HttpContext) {
    if (!allowed(request.ip())) return response.tooManyRequests({ message: 'Muitas requisições' })

    const raw = request.raw() ?? ''
    if (!raw) return response.badRequest({ code: 'empty_body', message: 'Corpo vazio' })

    const result = await ThemembersWebhookService.receive(
      raw,
      request.header('x-signature'),
      env.get('THEMEMBERS_WEBHOOK_SECRET'),
      env.get('THEMEMBERS_WEBHOOK_URL')
    )
    if (!result.ok) {
      return response.status(result.status).send({ code: result.code, message: result.message })
    }
    return response.ok({ received: true, duplicate: result.duplicate })
  }
}
