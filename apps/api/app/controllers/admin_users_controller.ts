import type { HttpContext } from '@adonisjs/core/http'
import type { Role as RoleName } from '@academia/contracts'
import Role from '#models/role'
import User from '#models/user'
import AuditService from '#services/audit_service'
import { generateTemporaryPassword } from '#services/password_policy'
import { createUserValidator, updateUserValidator } from '#validators/auth'

function present(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.roleNames[0] ?? null,
    isActive: user.isActive,
    twoFactorEnabled: user.twoFactorEnabled,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISO() ?? null,
    createdAt: user.createdAt.toISO(),
  }
}

async function activeAdmins(): Promise<number> {
  const rows = await User.query()
    .where('is_active', true)
    .whereHas('roles', (q) => q.where('name', 'admin'))
  return rows.length
}

async function setRole(user: User, role: RoleName) {
  const row = await Role.findByOrFail('name', role)
  await user.related('roles').sync([row.id])
}

/** Gestão de usuários do painel (`users.manage`). Senhas provisórias aparecem uma única vez na resposta. */
export default class AdminUsersController {
  async index() {
    const users = await User.query().preload('roles').orderBy('full_name').orderBy('email')
    return { items: users.map(present) }
  }

  async store(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const input = await request.validateUsing(createUserValidator)
    if (await User.findBy('email', input.email)) {
      return response.conflict({
        message: 'Já existe um usuário com este e-mail.',
        code: 'email_taken',
      })
    }
    const temporaryPassword = generateTemporaryPassword()
    const user = await User.create({
      email: input.email,
      fullName: input.fullName,
      password: temporaryPassword,
      isActive: true,
      mustChangePassword: true,
    })
    await setRole(user, input.role)
    await user.load('roles')
    await AuditService.record(ctx, {
      action: 'user.created',
      actorId: auth.getUserOrFail().id,
      resourceType: 'user',
      resourceId: user.id,
      metadata: { email: user.email, role: input.role },
    })
    return response.created({ user: present(user), temporaryPassword })
  }

  async update(ctx: HttpContext) {
    const { request, response, auth, params } = ctx
    const actor = auth.getUserOrFail()
    const input = await request.validateUsing(updateUserValidator)
    const user = await User.query().where('id', params.id).preload('roles').first()
    if (!user) return response.notFound({ message: 'Usuário não encontrado.' })

    const isSelf = user.id === actor.id
    const demoting =
      input.role !== undefined && input.role !== 'admin' && user.roleNames.includes('admin')
    const deactivating = input.isActive === false && user.isActive
    if (isSelf && (demoting || deactivating)) {
      return response.unprocessableEntity({
        message: 'Você não pode tirar o próprio acesso de administrador.',
        code: 'self_lockout',
      })
    }
    if (
      (demoting || deactivating) &&
      user.roleNames.includes('admin') &&
      user.isActive &&
      (await activeAdmins()) <= 1
    ) {
      return response.unprocessableEntity({
        message: 'Precisa existir ao menos um administrador ativo.',
        code: 'last_admin',
      })
    }

    if (input.fullName !== undefined) user.fullName = input.fullName
    if (input.isActive !== undefined) user.isActive = input.isActive
    if (input.role !== undefined && input.role !== user.roleNames[0])
      await setRole(user, input.role)
    // Desativar ou mudar de papel encerra as sessões abertas: o acesso novo vale já.
    if (deactivating || (input.role !== undefined && input.role !== user.roleNames[0]))
      user.sessionEpoch += 1
    await user.save()
    await user.load('roles')
    await AuditService.record(ctx, {
      action: 'user.updated',
      actorId: actor.id,
      resourceType: 'user',
      resourceId: user.id,
      metadata: { fields: Object.keys(input) },
    })
    return present(user)
  }

  async resetPassword(ctx: HttpContext) {
    const { response, auth, params } = ctx
    const user = await User.query().where('id', params.id).preload('roles').first()
    if (!user) return response.notFound({ message: 'Usuário não encontrado.' })
    const temporaryPassword = generateTemporaryPassword()
    user.password = temporaryPassword
    user.mustChangePassword = true
    user.sessionEpoch += 1
    await user.save()
    await AuditService.record(ctx, {
      action: 'user.password_reset',
      actorId: auth.getUserOrFail().id,
      resourceType: 'user',
      resourceId: user.id,
    })
    return { user: present(user), temporaryPassword }
  }

  async revokeSessions(ctx: HttpContext) {
    const { response, auth, params } = ctx
    const user = await User.query().where('id', params.id).preload('roles').first()
    if (!user) return response.notFound({ message: 'Usuário não encontrado.' })
    user.sessionEpoch += 1
    await user.save()
    await AuditService.record(ctx, {
      action: 'user.sessions_revoked',
      actorId: auth.getUserOrFail().id,
      resourceType: 'user',
      resourceId: user.id,
    })
    return present(user)
  }

  /** Para quem perdeu o celular e os códigos de recuperação: remove o 2FA; a pessoa configura de novo. */
  async resetTwoFactor(ctx: HttpContext) {
    const { response, auth, params } = ctx
    const user = await User.query().where('id', params.id).preload('roles').first()
    if (!user) return response.notFound({ message: 'Usuário não encontrado.' })
    user.totpSecret = null
    user.totpEnabledAt = null
    user.totpLastStep = null
    user.recoveryCodes = null
    user.sessionEpoch += 1
    await user.save()
    await AuditService.record(ctx, {
      action: 'user.2fa_reset',
      actorId: auth.getUserOrFail().id,
      resourceType: 'user',
      resourceId: user.id,
    })
    return present(user)
  }
}
