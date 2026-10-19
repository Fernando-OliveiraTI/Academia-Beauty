import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Eventos de uso das páginas públicas (dashboard): visualização, clique em "comprar" e saída para o checkout.
 * Não guarda IP nem identificador persistente: `visitor_hash` é um resumo diário (muda a cada dia) de IP + navegador.
 */
export default class extends BaseSchema {
  protected tableName = 'page_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table.string('kind', 16).notNullable()
      table.string('resource_type', 16).notNullable()
      table.string('resource_slug', 80).nullable()
      table.string('visitor_hash', 24).notNullable()
      table.string('device', 12).notNullable()
      table.string('referrer_host', 80).nullable()
      table.timestamp('created_at').notNullable()
      table.index(['created_at', 'kind'])
      table.index(['resource_type', 'resource_slug', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
