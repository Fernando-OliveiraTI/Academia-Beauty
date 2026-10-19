import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Visitas ao checkout embutido. Cada abertura de checkout (aba do navegador) gera um código `ab_…` que a página põe na URL
 * do iframe; aqui guardamos o contexto da visita para, quando o webhook da The Members devolver o código, saber quem comprou
 * (navegador, aparelho, origem, cidade aproximada). Contém dados pessoais (IP) conforme `CHECKOUT_SESSIONS_IP_MODE`;
 * só administrador lê e tudo é apagado depois de `CHECKOUT_SESSIONS_RETENTION_DAYS` dias.
 */
export default class extends BaseSchema {
  protected tableName = 'checkout_sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table.string('ref', 32).notNullable().unique()
      table.string('course_slug', 80).nullable()
      table.integer('course_id').unsigned().nullable()
      table.string('ip', 45).nullable()
      table.string('country', 2).nullable()
      table.string('region', 80).nullable()
      table.string('city', 80).nullable()
      table.string('user_agent', 400).nullable()
      table.string('browser', 40).nullable()
      table.string('browser_version', 12).nullable()
      table.string('os', 40).nullable()
      table.string('os_version', 12).nullable()
      table.string('device', 10).nullable()
      table.string('in_app', 24).nullable()
      table.string('language', 20).nullable()
      table.string('timezone', 60).nullable()
      table.smallint('viewport_w').unsigned().nullable()
      table.smallint('viewport_h').unsigned().nullable()
      table.string('referrer_host', 80).nullable()
      table.string('landing_path', 200).nullable()
      table.string('utm_source', 80).nullable()
      table.string('utm_medium', 80).nullable()
      table.string('utm_campaign', 120).nullable()
      table.string('utm_content', 120).nullable()
      table.string('utm_term', 120).nullable()
      table.boolean('has_click_id').notNullable().defaultTo(false)
      table.integer('visits').unsigned().notNullable().defaultTo(1)
      table.timestamp('created_at').notNullable()
      table.timestamp('last_seen_at').notNullable()
      table.index(['created_at'])
      table.index(['course_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
