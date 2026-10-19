import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Eventos de pagamento recebidos do webhook da The Members. Cada chamada vira no máximo uma linha
 * (`event_key` = SHA-256 do corpo bruto: retentativas do mesmo evento não duplicam). Guarda só o resumo tratado e o
 * corpo **com dados pessoais removidos** (documento, telefone, e-mail e nome mascarados; QR Code, código de barras e
 * dados da empresa fora). Nunca guarda número de cartão (a The Members só envia o último dígito).
 */
export default class extends BaseSchema {
  protected tableName = 'payment_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table.string('event_key', 64).notNullable().unique()
      table.string('provider', 16).notNullable().defaultTo('themembers')
      table.string('event', 48).notNullable()
      table.string('kind', 16).notNullable()
      /** Status tratado: approved, failed, refunded, charged_back, pending_refund, pending, canceled, expired, completed… */
      table.string('status', 32).nullable()
      /** ID do produto na The Members (casa com `commercial_configs.external_course_id`). */
      table.string('external_product_id', 64).nullable()
      table.string('external_transaction_id', 40).nullable()
      table.integer('course_id').unsigned().nullable()
      table.string('payment_method', 16).nullable()
      table.integer('amount_cents').nullable()
      table.string('currency', 3).nullable()
      table.smallint('instalments').unsigned().nullable()
      table.string('card_brand', 24).nullable()
      table.string('buyer_name', 80).nullable()
      table.string('buyer_email', 120).nullable()
      table.string('signature_scheme', 40).notNullable()
      table.json('payload').notNullable()
      table.timestamp('occurred_at').notNullable()
      table.timestamp('received_at').notNullable()
      table.index(['course_id', 'occurred_at'])
      table.index(['external_product_id', 'occurred_at'])
      table.index(['external_transaction_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
