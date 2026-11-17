import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as shieldErrors } from '@adonisjs/shield'
import type { HttpError } from '@adonisjs/core/types/http'
import telemetry from '#services/telemetry_service'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  // Stack traces só em desenvolvimento/teste: staging sem NODE_ENV=production não vaza detalhes.
  protected debug = app.inDev || app.inTest

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    // API JSON: token CSRF ausente ou inválido é 403, nunca redirecionamento.
    if (error instanceof shieldErrors.E_BAD_CSRF_TOKEN) {
      return ctx.response.forbidden({ message: 'Token CSRF inválido' })
    }
    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    // Só falhas do servidor: 5xx ou erro inesperado (sem status). Validação, login, permissão e 404 são erro do
    // cliente e já aparecem como requisição; reportá-los como exceção encheria o painel de ruído.
    const status = (error as { status?: number }).status
    if (this.shouldReport(error as HttpError) && (status === undefined || status >= 500)) {
      telemetry.trackException({
        error,
        operationId: ctx.request.id(),
        properties: {
          route: `${ctx.request.method()} ${ctx.route?.pattern ?? 'sem rota'}`,
          status: status ?? 500,
          code: (error as { code?: string }).code,
        },
      })
    }
    return super.report(error, ctx)
  }
}
