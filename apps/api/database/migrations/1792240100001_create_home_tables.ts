import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fase 7B: a Home passa a ter documento próprio, rascunho e versões publicadas imutáveis, com o mesmo
 * formato de `professionals`/`professional_versions` para reaproveitar o `DocumentService`. Existe uma única
 * linha (id = 1). `document` nulo = Home derivada do template original; `data` é fixo (`{"name":"Home"}`).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('home_pages', (table) => {
      table.increments('id').notNullable()
      table.string('status', 16).notNullable().defaultTo('draft')
      table.integer('revision').unsigned().notNullable().defaultTo(1)
      table.json('data').notNullable()
      table.string('name', 80).notNullable()
      table.json('document').nullable()
      table.integer('document_revision').unsigned().notNullable().defaultTo(0)
      table.integer('published_version').unsigned().nullable()
      table.integer('published_revision').unsigned().nullable()
      table.integer('published_document_revision').unsigned().nullable()
      table.timestamp('published_at').nullable()
      table.integer('updated_by').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
    this.schema.createTable('home_versions', (table) => {
      table.increments('id').notNullable()
      table
        .integer('home_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('home_pages')
        .onDelete('RESTRICT')
      table.integer('version').unsigned().notNullable()
      table.json('data').notNullable()
      table.json('document').nullable()
      table.string('template_key', 64).notNullable()
      table.integer('template_version').unsigned().notNullable()
      table.integer('published_by').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.unique(['home_id', 'version'])
    })
    this.defer(async (db) => {
      await db.table('home_pages').insert({
        id: 1,
        status: 'draft',
        revision: 1,
        data: JSON.stringify({ name: 'Home' }),
        name: 'Home',
        document_revision: 0,
        created_at: new Date(),
      })
    })
  }

  async down() {
    this.schema.dropTable('home_versions')
    this.schema.dropTable('home_pages')
  }
}
