import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Login do profissional (D-040): o usuário com papel `professional` aponta para um profissional e só vê os dados dele.
 * O papel também é criado aqui, para bancos que já passaram pelo seed (o seed só roda na instalação).
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('professional_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('professionals')
        .onDelete('SET NULL')
    })
    this.defer(async (db) => {
      const exists = await db.from('roles').where('name', 'professional').first()
      if (!exists) await db.table('roles').insert({ name: 'professional', created_at: new Date() })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['professional_id'])
      table.dropColumn('professional_id')
    })
  }
}
