import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Segurança das contas: época de sessão (invalida todas as sessões de uma vez), troca de senha obrigatória
 * e 2FA por TOTP (segredo cifrado, último passo aceito contra repetição e códigos de recuperação em hash).
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('session_epoch').unsigned().notNullable().defaultTo(0)
      table.boolean('must_change_password').notNullable().defaultTo(false)
      table.timestamp('password_changed_at').nullable()
      table.text('totp_secret').nullable()
      table.timestamp('totp_enabled_at').nullable()
      table.bigInteger('totp_last_step').nullable()
      table.text('recovery_codes').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns(
        'session_epoch',
        'must_change_password',
        'password_changed_at',
        'totp_secret',
        'totp_enabled_at',
        'totp_last_step',
        'recovery_codes'
      )
    })
  }
}
