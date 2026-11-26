import { BaseSchema } from '@adonisjs/lucid/schema'

/** Aceite dos Termos de Uso e da Política de Privacidade no painel (D-041): quando e qual versão. */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('terms_accepted_at').nullable()
      table.string('terms_version', 20).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('terms_accepted_at')
      table.dropColumn('terms_version')
    })
  }
}
