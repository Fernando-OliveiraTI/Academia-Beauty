import type { HttpContext } from '@adonisjs/core/http'
import type { Telemetry } from '@academia/telemetry'

/** Verificação de saúde do Azure/monitores: não entra na telemetria (encheria o painel de ruído). */
const IGNORED_PATHS = new Set(['/health'])

type Completed = {
  ctx: Pick<HttpContext, 'request' | 'response' | 'route'>
  duration: [number, number]
}

/**
 * Uma linha por requisição concluída: nome = método + padrão da rota (nunca a URL real, que pode ter slug,
 * consulta ou identificadores), status e duração. Sem IP, cookies, cabeçalhos nem corpo.
 */
export function trackCompletedRequest(telemetry: Telemetry, { ctx, duration }: Completed) {
  const request = ctx.request
  const path = request.url().split('?', 1)[0] ?? ''
  if (IGNORED_PATHS.has(path)) return
  const status = ctx.response.getStatus()
  const pattern = ctx.route?.pattern ?? 'sem rota'
  telemetry.trackRequest({
    id: request.id(),
    name: `${request.method()} ${pattern}`,
    url: pattern,
    durationMs: duration[0] * 1000 + duration[1] / 1e6,
    resultCode: status,
    // 4xx é erro do cliente (login errado, 404…): não conta como falha do serviço.
    success: status < 500,
  })
}
