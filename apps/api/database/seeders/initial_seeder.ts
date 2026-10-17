import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { ROLES } from '@academia/contracts'
import env from '#start/env'
import Role from '#models/role'
import User from '#models/user'

/** Idempotente: cria papéis e, se ADMIN_EMAIL/ADMIN_PASSWORD existirem, o primeiro administrador. */
export default class extends BaseSeeder {
  async run() {
    for (const name of ROLES) await Role.firstOrCreate({ name }, { name })

    const email = env.get('ADMIN_EMAIL')?.toLowerCase()
    const password = env.get('ADMIN_PASSWORD')
    if (!email || !password) return
    if (password.length < 12) throw new Error('ADMIN_PASSWORD deve ter ao menos 12 caracteres')

    const existing = await User.findBy('email', email)
    if (existing) return

    const admin = await User.create({ email, password, fullName: 'Administrador', isActive: true })
    const adminRole = await Role.findByOrFail('name', 'admin')
    await admin.related('roles').attach([adminRole.id])
  }
}
