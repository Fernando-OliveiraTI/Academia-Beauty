import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Permission } from '@academia/contracts'
import { checkAccountState } from '#services/session_guard'

/** Exige autenticação e a permissão informada. A decisão é sempre do servidor. */
export default class PermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { permission: Permission }) {
    await ctx.auth.authenticate()
    const user = ctx.auth.getUserOrFail()
    if (!user.isActive) return ctx.response.unauthorized({ message: 'Sessão inválida' })

    await user.load('roles')
    const refused = await checkAccountState(ctx, user, { gate: true })
    if (refused) return refused
    if (!user.permissions.includes(options.permission)) {
      return ctx.response.forbidden({ message: 'Sem permissão para esta ação' })
    }
    return next()
  }
}
