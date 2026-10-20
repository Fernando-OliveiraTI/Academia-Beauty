import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import type User from '#models/user'

/** Chave da sessão com a época do usuário no momento do login. */
export const EPOCH_KEY = 'auth_epoch'

export type GateOptions = {
  /** Barra quem precisa trocar a senha ou ativar o 2FA (todas as rotas, exceto as da própria conta). */
  gate?: boolean
}

export const requires2fa = (user: User) =>
  env.get('REQUIRE_2FA_FOR_ADMINS') === true &&
  user.roleNames.includes('admin') &&
  !user.twoFactorEnabled

/**
 * Estado da conta numa requisição autenticada. Devolve a resposta de recusa ou `null` (segue).
 * - Época diferente da do usuário: a senha foi trocada, a conta desativada ou as sessões revogadas → 401.
 * - `gate`: troca de senha pendente ou 2FA obrigatório e ainda não ativado → 403 com `code`.
 */
export async function checkAccountState(ctx: HttpContext, user: User, options: GateOptions = {}) {
  const epoch = ctx.session.get(EPOCH_KEY, 0) as number
  if (epoch !== user.sessionEpoch) {
    await ctx.auth.use('web').logout()
    return ctx.response.unauthorized({ message: 'Sessão encerrada. Entre novamente.' })
  }
  if (options.gate) {
    if (user.mustChangePassword) {
      return ctx.response.forbidden({
        message: 'Troque a senha para continuar.',
        code: 'password_change_required',
      })
    }
    if (requires2fa(user)) {
      return ctx.response.forbidden({
        message: 'Ative a verificação em duas etapas para continuar.',
        code: 'two_factor_required',
      })
    }
  }
  return null
}
