import type { HttpContext } from '@adonisjs/core/http'
import { errors as authErrors } from '@adonisjs/auth'
import { DateTime } from 'luxon'
import limiter from '@adonisjs/limiter/services/main'
import User from '#models/user'
import AuditService from '#services/audit_service'
import LoginGuard, { digest } from '#services/login_guard'
import TotpService from '#services/totp_service'
import { EPOCH_KEY, requires2fa } from '#services/session_guard'
import { loginValidator, secondFactorValidator } from '#validators/auth'

const GENERIC_FAILURE = { message: 'E-mail ou senha inválidos' }
const PENDING_KEY = 'pending_2fa'
const PENDING_TTL_MS = 5 * 60 * 1000

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

export function describeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roleNames,
    permissions: user.permissions,
    twoFactorEnabled: user.twoFactorEnabled,
    mustChangePassword: user.mustChangePassword,
    twoFactorRequired: requires2fa(user),
  }
}

export default class AuthController {
  async login(ctx: HttpContext) {
    const { request, response } = ctx
    const { email, password } = await request.validateUsing(loginValidator)
    const ip = request.ip()

    if (await LoginGuard.isBlocked(ip, email)) {
      await auditThrottled(ctx, `audit_block_${digest(`${ip}|${email}`)}`, 1, {
        action: 'auth.login_throttled',
        metadata: { email },
      })
      return response.tooManyRequests({ message: 'Muitas tentativas. Tente novamente mais tarde.' })
    }

    let user: User
    try {
      user = await User.verifyCredentials(email, password)
    } catch (error) {
      if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
        await LoginGuard.recordFailure(ip, email)
        await auditThrottled(ctx, `audit_fail_${digest(ip)}`, 20, {
          action: 'auth.login_failed',
          metadata: { email },
        })
        return response.unauthorized(GENERIC_FAILURE)
      }
      throw error
    }

    if (!user.isActive) {
      await AuditService.record(ctx, { action: 'auth.login_blocked_inactive', actorId: user.id })
      return response.unauthorized(GENERIC_FAILURE)
    }

    await LoginGuard.clearPair(ip, email)

    if (user.twoFactorEnabled) {
      // Senha correta, falta o segundo fator: nada de login ainda; a sessão guarda só um "pendente" de 5 minutos.
      ctx.session.put(PENDING_KEY, { userId: user.id, until: Date.now() + PENDING_TTL_MS })
      // Nome próprio: `twoFactorRequired` dos dados do usuário significa "precisa ATIVAR o 2FA", outra coisa.
      return { secondFactorRequired: true }
    }
    return this.#complete(ctx, user)
  }

  /** Segundo passo do login: código do aplicativo ou código de recuperação. */
  async secondFactor(ctx: HttpContext) {
    const { request, response, session } = ctx
    const { code, recoveryCode } = await request.validateUsing(secondFactorValidator)
    const pending = session.get(PENDING_KEY) as { userId: number; until: number } | undefined
    if (!pending || pending.until < Date.now()) {
      session.forget(PENDING_KEY)
      return response.unauthorized({
        message: 'Sessão de verificação expirada. Entre novamente.',
        code: 'pending_expired',
      })
    }
    const user = await User.query().where('id', pending.userId).preload('roles').first()
    if (!user || !user.isActive || !user.twoFactorEnabled || !user.totpSecret) {
      session.forget(PENDING_KEY)
      return response.unauthorized(GENERIC_FAILURE)
    }
    if (await LoginGuard.secondFactorBlocked(user.id)) {
      return response.tooManyRequests({ message: 'Muitas tentativas. Tente novamente mais tarde.' })
    }

    let ok = false
    let usedRecovery = false
    if (code) {
      const step = TotpService.verify(
        TotpService.decrypt(user.totpSecret) ?? '',
        code,
        user.totpLastStep
      )
      if (step !== null) {
        user.totpLastStep = step
        ok = true
      }
    } else if (recoveryCode) {
      const hashes: string[] = JSON.parse(user.recoveryCodes ?? '[]')
      const hash = TotpService.hashRecoveryCode(recoveryCode)
      if (hashes.includes(hash)) {
        user.recoveryCodes = JSON.stringify(hashes.filter((h) => h !== hash))
        ok = true
        usedRecovery = true
      }
    }

    if (!ok) {
      await LoginGuard.secondFactorFailed(user.id)
      await auditThrottled(ctx, `audit_2fa_${user.id}`, 5, {
        action: 'auth.2fa_failed',
        actorId: user.id,
      })
      return response.unauthorized({ message: 'Código inválido.', code: 'invalid_code' })
    }
    await LoginGuard.secondFactorOk(user.id)
    session.forget(PENDING_KEY)
    if (usedRecovery)
      await AuditService.record(ctx, { action: 'auth.2fa_recovery_used', actorId: user.id })
    return this.#complete(ctx, user)
  }

  async logout(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    await ctx.auth.use('web').logout()
    await AuditService.record(ctx, { action: 'auth.logout', actorId: user.id })
    return ctx.response.noContent()
  }

  async me({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('roles')
    return describeUser(user)
  }

  async #complete(ctx: HttpContext, user: User) {
    await ctx.auth.use('web').login(user)
    ctx.session.put(EPOCH_KEY, user.sessionEpoch)
    user.lastLoginAt = DateTime.now()
    await user.save()
    await user.load('roles')
    await AuditService.record(ctx, { action: 'auth.login', actorId: user.id })
    return describeUser(user)
  }
}
