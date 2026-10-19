import { BaseSchema } from '@adonisjs/lucid/schema'

/** ID do curso na The Members (provedor externo) guardado na oferta. Vazio = não informado. */
export default class extends BaseSchema {
  protected tableName = 'commercial_configs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('external_course_id', 128).notNullable().defaultTo('')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('external_course_id')
    })
  }
}
