import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Registro técnico de cada chamada recebida no webhook da The Members, aceita ou não, com o **corpo bruto** (que
 * contém dados pessoais do comprador). Serve para conferir em produção o que a The Members realmente envia e por que
 * uma assinatura foi recusada. Acesso só de administrador, corpo limitado e retenção curta (apagado depois de
 * `THEMEMBERS_LOG_RETENTION_DAYS` dias, padrão 30).
 */
export default class extends BaseSchema {
  protected tableName = 'webhook_deliveries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table.string('provider', 16).notNullable().defaultTo('themembers')
      /** accepted, duplicate, invalid_signature, invalid_payload, not_configured, rate_limited, empty_body */
      table.string('result', 24).notNullable()
      table.smallint('http_status').unsigned().notNullable()
      table.string('event', 48).nullable()
      table.string('signature_scheme', 40).nullable()
      table.string('ip', 45).nullable()
      /** Cabeçalhos úteis para depurar (sem cookies nem autorização). */
      table.json('headers').notNullable()
      table.integer('body_bytes').unsigned().notNullable()
      table.boolean('body_truncated').notNullable().defaultTo(false)
      table.specificType('raw_body', 'longtext').nullable()
      table.bigInteger('payment_event_id').unsigned().nullable()
      table.timestamp('received_at').notNullable()
      table.index(['received_at'])
      table.index(['result', 'received_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
