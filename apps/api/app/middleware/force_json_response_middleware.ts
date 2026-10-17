import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Updating the "Accept" header to always accept "application/json" response
 * from the server. This will force the internals of the framework like
 * validator errors or auth errors to return a JSON response.
 */
export default class ForceJsonResponseMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    const headers = request.headers()
    // A entrega de mídia negocia o formato (AVIF/WebP) pelo Accept original do navegador.
    headers['x-original-accept'] = headers.accept
    headers.accept = 'application/json'

    return next()
  }
}
