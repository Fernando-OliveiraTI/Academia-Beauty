import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import limiter from '@adonisjs/limiter/services/main'
import { DateTime } from 'luxon'
import AuditService from '#services/audit_service'
import TotpService from '#services/totp_service'
import { passwordIssues } from '#services/password_policy'
import { EPOCH_KEY } from '#services/session_guard'
import {
  changePasswordValidator,
  disableTwoFactorValidator,
  enableTwoFactorValidator,
} from '#validators/auth'

const SETUP_KEY = 'totp_setup'
const sensitive = { requests: 5, duration: '15 mins', blockDuration: '15 mins' } as const

/** Conta do próprio usuário: troca de senha e verificação em duas etapas (2FA). Exige sessão; não exige estar liberado. */
export default class AccountController {
  async changePassword(ctx: HttpContext) {
    const { request, response, auth, session } = ctx
    const user = auth.getUserOrFail()
    const { currentPassword, newPassword } = await request.validateUsing(changePasswordValidator)

    const key = `pwd_${user.id}`
    const guard = limiter.use(sensitive)
    if (await guard.isBlocked(key)) {
      return response.tooManyRequests({ message: 'Muitas tentativas. Tente novamente mais tarde.' })
    }
    if (!(await hash.verify(user.password, currentPassword))) {
      await guard.consume(key).catch(() => {})
      await AuditService.record(ctx, { action: 'auth.password_change_failed', actorId: user.id })
      return response.unprocessableEntity({
        message: 'A senha atual não confere.',
        code: 'wrong_password',
      })
    }
    await guard.delete(key)

    const issues = passwordIssues(newPassword, { email: user.email, fullName: user.fullName })
    if (newPassword === currentPassword) issues.push('A nova senha deve ser diferente da atual.')
    if (issues.length)
      return response.unprocessableEntity({ message: issues[0], code: 'weak_password', issues })

    user.password = newPassword
    user.mustChangePassword = false
    user.passwordChangedAt = DateTime.now()
    user.sessionEpoch += 1 // encerra todas as outras sessões desta conta
    await user.save()
    session.put(EPOCH_KEY, user.sessionEpoch)
    await AuditService.record(ctx, { action: 'auth.password_changed', actorId: user.id })
    return response.noContent()
  }

  /** Passo 1: gera o segredo e o link `otpauth://` (o segredo só fica na sessão até ser confirmado). */
  async setupTwoFactor({ auth, session, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.twoFactorEnabled)
      return response.conflict({ message: 'A verificação em duas etapas já está ativa.' })
    const secret = TotpService.generateSecret()
    session.put(SETUP_KEY, secret)
    return { secret, otpauthUri: TotpService.otpauthUri(secret, user.email) }
  }

  /** Passo 2: confirma com um código do aplicativo, ativa e devolve os códigos de recuperação (uma única vez). */
  async enableTwoFactor(ctx: HttpContext) {
    const { request, response, auth, session } = ctx
    const user = auth.getUserOrFail()
    const { code } = await request.validateUsing(enableTwoFactorValidator)
    const secret = session.get(SETUP_KEY) as string | undefined
    if (!secret)
      return response.unprocessableEntity({
        message: 'Comece pela configuração do aplicativo.',
        code: 'no_setup',
      })

    const key = `totp_setup_${user.id}`
    const guard = limiter.use(sensitive)
    if (await guard.isBlocked(key))
      return response.tooManyRequests({ message: 'Muitas tentativas. Tente novamente mais tarde.' })
    const step = TotpService.verify(secret, code)
    if (step === null) {
      await guard.consume(key).catch(() => {})
      return response.unprocessableEntity({
        message: 'Código inválido. Confira o horário do celular e tente de novo.',
        code: 'invalid_code',
      })
    }
    await guard.delete(key)

    const recovery = TotpService.generateRecoveryCodes()
    user.totpSecret = TotpService.encrypt(secret)
    user.totpEnabledAt = DateTime.now()
    user.totpLastStep = step
    user.recoveryCodes = JSON.stringify(recovery.hashes)
    await user.save()
    session.forget(SETUP_KEY)
    await AuditService.record(ctx, { action: 'auth.2fa_enabled', actorId: user.id })
    return { recoveryCodes: recovery.plain }
  }

  /** Desativa exigindo a senha e um código válido (aplicativo ou recuperação). */
  async disableTwoFactor(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const user = auth.getUserOrFail()
    const { password, code } = await request.validateUsing(disableTwoFactorValidator)
    if (!user.twoFactorEnabled || !user.totpSecret) return response.noContent()

    const key = `pwd_${user.id}`
    const guard = limiter.use(sensitive)
    if (await guard.isBlocked(key))
      return response.tooManyRequests({ message: 'Muitas tentativas. Tente novamente mais tarde.' })
    const passwordOk = await hash.verify(user.password, password)
    const hashes: string[] = JSON.parse(user.recoveryCodes ?? '[]')
    const codeOk =
      TotpService.verify(TotpService.decrypt(user.totpSecret) ?? '', code, user.totpLastStep) !==
        null || hashes.includes(TotpService.hashRecoveryCode(code))
    if (!passwordOk || !codeOk) {
      await guard.consume(key).catch(() => {})
      return response.unprocessableEntity({
        message: 'Senha ou código inválido.',
        code: 'invalid_credentials',
      })
    }
    await guard.delete(key)

    user.totpSecret = null
    user.totpEnabledAt = null
    user.totpLastStep = null
    user.recoveryCodes = null
    await user.save()
    await AuditService.record(ctx, { action: 'auth.2fa_disabled', actorId: user.id })
    return response.noContent()
  }
}
