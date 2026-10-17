import type { HttpContext } from '@adonisjs/core/http'
import { errors as authErrors } from '@adonisjs/auth'
import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import limiter from '@adonisjs/limiter/services/main'
import User from '#models/user'
import AuditService from '#services/audit_service'
import { loginValidator } from '#validators/auth'

const GENERIC_FAILURE = { message: 'E-mail ou senha inválidos' }

/** Chave curta e de tamanho fixo (a coluna `rate_limits.key` tem 255 caracteres; o e-mail é entrada livre). */
const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 40)

/**
 * Auditoria de falhas de login sem flood: no máximo 1 registro de bloqueio por chave e 20 falhas por IP,
 * por janela de 15 minutos (as tentativas continuam sendo contadas e bloqueadas normalmente).
 */
async function auditThrottled(
  ctx: HttpContext,
  scope: string,
  requests: number,
  entry: Parameters<typeof AuditService.record>[1]
) {
  const audit = limiter.use({ requests, duration: '15 mins' })
  // attempt() consome 1 requisição e só executa o callback enquanto houver saldo.
  const allowed = await audit.attempt(scope, async () => true)
  if (allowed) await AuditService.record(ctx, entry)
}

export default class AuthController {
  async login(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const { email, password } = await request.validateUsing(loginValidator)

    // Limite por IP + e-mail: 5 tentativas a cada 15 minutos, bloqueio por 15 minutos.
    const loginLimiter = limiter.use({ requests: 5, duration: '15 mins', blockDuration: '15 mins' })
    const ip = request.ip()
    const key = `login_${digest(`${ip}|${email.toLowerCase()}`)}`
    let limitError: { response?: { remaining: number } } | null
    let user: User | null = null
    try {
      // penalize() conta a tentativa quando o callback lança; o erro de credenciais é relançado.
      ;[limitError, user] = await loginLimiter.penalize(key, () =>
        User.verifyCredentials(email, password)
      )
    } catch (error) {
      if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
        await auditThrottled(ctx, `audit_fail_${digest(ip)}`, 20, {
          action: 'auth.login_failed',
          metadata: { email },
        })
        return response.unauthorized(GENERIC_FAILURE)
      }
      throw error
    }

    if (limitError || !user) {
      await auditThrottled(ctx, `audit_block_${key}`, 1, {
        action: 'auth.login_throttled',
        metadata: { email },
      })
      return response.tooManyRequests({ message: 'Muitas tentativas. Tente novamente mais tarde.' })
    }

    if (!user.isActive) {
      await AuditService.record(ctx, { action: 'auth.login_blocked_inactive', actorId: user.id })
      return response.unauthorized(GENERIC_FAILURE)
    }

    await auth.use('web').login(user)
    user.lastLoginAt = DateTime.now()
    await user.save()
    await user.load('roles')
    await AuditService.record(ctx, { action: 'auth.login', actorId: user.id })
    return this.#me(user)
  }

  async logout(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    await ctx.auth.use('web').logout()
    await AuditService.record(ctx, { action: 'auth.logout', actorId: user.id })
    return ctx.response.noContent()
  }

  async me({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.isActive)
      throw new authErrors.E_UNAUTHORIZED_ACCESS('Sessão inválida', { guardDriverName: 'session' })
    await user.load('roles')
    return this.#me(user)
  }

  #me(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roleNames,
      permissions: user.permissions,
    }
  }
}
