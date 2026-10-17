import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Profissionais: `data` é o rascunho de trabalho (ProfessionalData); cada publicação grava um
 * snapshot imutável em `professional_versions`. O site público lê só os snapshots.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('professionals', (table) => {
      table.increments('id').notNullable()
      table.string('slug', 80).notNullable().unique()
      table.string('status', 16).notNullable().defaultTo('draft')
      // Concorrência otimista: cada gravação de `data` incrementa.
      table.integer('revision').unsigned().notNullable().defaultTo(1)
      table.json('data').notNullable()
      // Copiado de data.name para ordenar/buscar sem abrir o JSON.
      table.string('name', 80).notNullable().index()
      table.boolean('home_visible').notNullable().defaultTo(false)
      table.integer('home_order').notNullable().defaultTo(0)
      table.boolean('featured').notNullable().defaultTo(false)
      // Versão publicada vigente e a revisão do rascunho que a originou.
      table.integer('published_version').unsigned().nullable()
      table.integer('published_revision').unsigned().nullable()
      table.timestamp('published_at').nullable()
      table.integer('created_by').unsigned().nullable()
      table.integer('updated_by').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['status', 'home_visible', 'home_order'], 'professionals_showcase_idx')
    })

    this.schema.createTable('professional_versions', (table) => {
      table.increments('id').notNullable()
      table
        .integer('professional_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('professionals')
        .onDelete('RESTRICT')
      table.integer('version').unsigned().notNullable()
      table.json('data').notNullable()
      table.string('template_key', 64).notNullable()
      table.integer('template_version').unsigned().notNullable()
      table.integer('published_by').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.unique(['professional_id', 'version'])
    })
  }

  async down() {
    this.schema.dropTable('professional_versions')
    this.schema.dropTable('professionals')
  }
}
