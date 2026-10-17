import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fase 7C: modelo de página do profissional (Original, Autoridade, Vídeo, Conversão, Imersivo, Premium).
 * Os snapshots já guardam `template_key`; aqui fica a escolha do rascunho. Padrão: o Original.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('professionals', (table) => {
      table.string('template_key', 64).notNullable().defaultTo('professional-original')
    })
  }

  async down() {
    this.schema.alterTable('professionals', (table) => {
      table.dropColumn('template_key')
    })
  }
}
