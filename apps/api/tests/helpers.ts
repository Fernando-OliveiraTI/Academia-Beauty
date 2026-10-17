import { ROLES, type Role as RoleName } from '@academia/contracts'
import Role from '#models/role'
import User from '#models/user'

let counter = 0

export const TEST_PASSWORD = 'Senha-De-Teste-Forte-1'

/** Cria usuário com um papel. E-mails são únicos por teste para isolar o rate limit em memória. */
export async function makeUser(
  role: RoleName,
  overrides: Partial<{ isActive: boolean; email: string }> = {}
) {
  for (const name of ROLES) await Role.firstOrCreate({ name }, { name })
  counter += 1
  const user = await User.create({
    email: overrides.email ?? `user${counter}-${Date.now()}@teste.local`,
    password: TEST_PASSWORD,
    fullName: `Teste ${role}`,
    isActive: overrides.isActive ?? true,
  })
  const roleRow = await Role.findByOrFail('name', role)
  await user.related('roles').attach([roleRow.id])
  return user
}
