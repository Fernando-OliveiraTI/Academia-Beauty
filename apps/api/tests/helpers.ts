import { ROLES, type Role as RoleName } from '@academia/contracts'
import db from '@adonisjs/lucid/services/db'
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

/**
 * Esvazia todas as tabelas de dados numa única conexão, em sequência e com as chaves estrangeiras desligadas só
 * nela. O `testUtils.db().truncate()` do Adonis dispara TRUNCATEs em conexões diferentes do pool e podia deixar um
 * deles correr durante o teste seguinte (falha intermitente de FK em `user_roles`).
 */
export async function truncateAll() {
  const trx = await db.transaction()
  try {
    const [rows] = await trx.rawQuery(
      "select table_name as name from information_schema.tables where table_schema = database() and table_type = 'BASE TABLE' and table_name not like 'adonis\\_%'"
    )
    await trx.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    for (const row of rows as { name: string }[]) {
      await trx.rawQuery(`truncate table \`${row.name}\``)
    }
    await trx.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
  } finally {
    await trx.rollback().catch(() => {})
  }
}
