import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Insights (D-040): tempo com a página visível. Eventos `time` trazem o tempo acumulado desde o envio anterior
 * (a página envia ao ficar oculta ou ao sair), então o tempo médio por visita é a soma dividida pelas visitas.
 */
export default class extends BaseSchema {
  protected tableName = 'page_events'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('duration_ms').unsigned().nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('duration_ms')
    })
  }
}
