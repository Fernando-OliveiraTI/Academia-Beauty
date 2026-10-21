import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Preço final digitado ("por"), em centavos. Nulo = o final vem do desconto em %. Com valor, ele manda e
 * `discount_pct` guarda só o percentual arredondado (selo "N% OFF").
 */
export default class extends BaseSchema {
  protected tableName = 'commercial_configs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('final_cents').unsigned().nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('final_cents')
    })
  }
}
