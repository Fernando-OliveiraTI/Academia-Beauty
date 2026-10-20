import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { checkAccountState } from '#services/session_guard'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to, when authentication fails
   */
  redirectTo = '/login'

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
      /** Barra quem precisa trocar a senha ou ativar o 2FA. As rotas da própria conta não usam. */
      gate?: boolean
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })
    const user = ctx.auth.getUserOrFail()
    if (!user.isActive) return ctx.response.unauthorized({ message: 'Sessão inválida' })
    await user.load('roles')
    const refused = await checkAccountState(ctx, user, { gate: options.gate })
    if (refused) return refused
    return next()
  }
}
