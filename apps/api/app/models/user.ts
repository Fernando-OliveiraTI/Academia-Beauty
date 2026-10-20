import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { permissionsForRoles, type Permission, type Role as RoleName } from '@academia/contracts'
import Role from '#models/role'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare isActive: boolean

  @column.dateTime()
  declare lastLoginAt: DateTime | null

  /** Sobe a cada troca/redefinição de senha, desativação ou revogação: sessões de época antiga deixam de valer. */
  @column({ serializeAs: null })
  declare sessionEpoch: number

  @column({ consume: (v: number | boolean) => Boolean(v) })
  declare mustChangePassword: boolean

  @column.dateTime()
  declare passwordChangedAt: DateTime | null

  /** Segredo TOTP cifrado com a APP_KEY (nunca em claro no banco). */
  @column({ serializeAs: null })
  declare totpSecret: string | null

  @column.dateTime()
  declare totpEnabledAt: DateTime | null

  /** Último passo de 30 s aceito: o mesmo código não vale duas vezes. */
  @column({
    serializeAs: null,
    consume: (v: string | number | null) => (v === null ? null : Number(v)),
  })
  declare totpLastStep: number | null

  /** JSON com os hashes (sha256) dos códigos de recuperação ainda não usados. */
  @column({ serializeAs: null })
  declare recoveryCodes: string | null

  get twoFactorEnabled(): boolean {
    return this.totpEnabledAt !== null && this.totpSecret !== null
  }

  @manyToMany(() => Role, { pivotTable: 'user_roles' })
  declare roles: ManyToMany<typeof Role>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  /** Requer `roles` carregado (preload). */
  get roleNames(): RoleName[] {
    return this.roles.map((r) => r.name as RoleName)
  }

  get permissions(): Permission[] {
    return permissionsForRoles(this.roleNames)
  }
}
