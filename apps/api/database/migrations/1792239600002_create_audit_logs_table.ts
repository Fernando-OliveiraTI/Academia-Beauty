import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      // Sem FK: o log precisa sobreviver à exclusão do usuário e registrar tentativas sem usuário.
      table.integer('actor_id').unsigned().nullable().index()
      table.string('action', 64).notNullable().index()
      table.string('resource_type', 64).nullable()
      table.string('resource_id', 64).nullable()
      table.json('metadata').nullable()
      table.string('ip', 45).nullable()
      table.string('user_agent', 255).nullable()
      table.timestamp('created_at').notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
