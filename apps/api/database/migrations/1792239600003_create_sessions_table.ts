import { BaseSchema } from '@adonisjs/lucid/schema'

/** Sessões no servidor: o logout e a desativação do usuário revogam o acesso de fato. */
export default class extends BaseSchema {
  protected tableName = 'sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('id', 255).notNullable().primary()
      table.integer('user_id').unsigned().nullable().index()
      table.text('data', 'longtext').notNullable()
      table.timestamp('expires_at').notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
