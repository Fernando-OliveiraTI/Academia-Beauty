import type { HttpContext } from '@adonisjs/core/http'
import TrackingService from '#services/tracking_service'

/** Coleta de eventos das páginas públicas. Sempre responde 204: o visitante nunca vê erro de métrica. */
export default class PublicTrackController {
  async store({ request, response }: HttpContext) {
    const body = request.body() as Record<string, unknown>
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null)
    try {
      await TrackingService.record(
        {
          kind: str(body.kind, 16) ?? '',
          type: str(body.type, 16) ?? '',
          slug: str(body.slug, 80),
          referrer: str(body.referrer, 300),
          ip: request.ip(),
          userAgent: request.header('user-agent') ?? '',
        },
        request.header('x-forwarded-host')?.split(',')[0]?.trim().split(':')[0] ?? null
      )
    } catch {
      // métrica é opcional: falha de banco não pode afetar a página
    }
    return response.noContent()
  }
}
