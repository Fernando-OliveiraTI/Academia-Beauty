import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Código da visita (`ab_` + 20 caracteres) que a página do curso põe na URL do checkout embutido e que a The Members
 * devolve no webhook (campo `utms`). Liga o pagamento ao navegador que o iniciou, sem expor dados do comprador.
 */
export default class extends BaseSchema {
  protected tableName = 'payment_events'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('ref', 32).nullable()
      table.index(['ref', 'occurred_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['ref', 'occurred_at'])
      table.dropColumn('ref')
    })
  }
}
