import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fase 7A: biblioteca de mídia. `media_assets` guarda o arquivo validado; `media_variants`, os derivados
 * (webp/avif por largura) gerados no envio. O uso (onde cada arquivo aparece) é calculado sob demanda a
 * partir dos rascunhos e dos snapshots vigentes (D-024), então não há tabela de uso para ficar defasada.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('media_assets', (table) => {
      table.string('id', 32).primary()
      table.enum('kind', ['image', 'video']).notNullable()
      table.string('original_name', 255).notNullable()
      table.string('mime', 64).notNullable()
      table.integer('size').unsigned().notNullable()
      table.integer('width').unsigned().nullable()
      table.integer('height').unsigned().nullable()
      table.string('sha256', 64).notNullable()
      table.string('storage_key', 255).notNullable()
      table
        .integer('created_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at').notNullable()
      table.index(['kind', 'created_at'])
    })
    this.schema.createTable('media_variants', (table) => {
      table.increments('id')
      table
        .string('asset_id', 32)
        .notNullable()
        .references('id')
        .inTable('media_assets')
        .onDelete('CASCADE')
      table.enum('format', ['webp', 'avif']).notNullable()
      table.integer('width').unsigned().notNullable()
      table.integer('height').unsigned().notNullable()
      table.integer('size').unsigned().notNullable()
      table.string('storage_key', 255).notNullable()
      table.unique(['asset_id', 'format', 'width'])
    })
  }

  async down() {
    this.schema.dropTable('media_variants')
    this.schema.dropTable('media_assets')
  }
}
