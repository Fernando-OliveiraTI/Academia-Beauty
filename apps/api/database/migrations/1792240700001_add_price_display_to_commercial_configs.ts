import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Formato de exibição do preço do curso (`full`, `from_to`, `percent_off`, `standard`). `full` = o comportamento de sempre
 * (de/por + selo de desconto): ofertas existentes não mudam de aparência.
 */
export default class extends BaseSchema {
  protected tableName = 'commercial_configs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('price_display', 16).notNullable().defaultTo('full')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('price_display')
    })
  }
}
