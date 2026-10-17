import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Cursos: `data` é o rascunho (CourseData); cada publicação grava um snapshot imutável em
 * `course_versions` com o conteúdo e a oferta vigentes. A oferta (preço e link de checkout do
 * Modo A) fica em `commercial_configs`, com revisão própria e permissão própria.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('courses', (table) => {
      table.increments('id').notNullable()
      table
        .integer('professional_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('professionals')
        .onDelete('RESTRICT')
      table.string('slug', 80).notNullable().unique()
      table.string('status', 16).notNullable().defaultTo('draft')
      table.integer('revision').unsigned().notNullable().defaultTo(1)
      table.json('data').notNullable()
      // Copiado de data.title para ordenar/buscar sem abrir o JSON.
      table.string('title', 80).notNullable().index()
      table.boolean('showcase_visible').notNullable().defaultTo(true)
      table.integer('showcase_order').notNullable().defaultTo(0)
      table.boolean('featured').notNullable().defaultTo(false)
      table.integer('published_version').unsigned().nullable()
      table.integer('published_revision').unsigned().nullable()
      table.integer('published_commercial_revision').unsigned().nullable()
      table.timestamp('published_at').nullable()
      table.integer('created_by').unsigned().nullable()
      table.integer('updated_by').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['professional_id', 'status', 'showcase_order'], 'courses_showcase_idx')
    })

    this.schema.createTable('commercial_configs', (table) => {
      table.increments('id').notNullable()
      table
        .integer('course_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('courses')
        .onDelete('RESTRICT')
      table.integer('revision').unsigned().notNullable().defaultTo(1)
      table.string('currency', 3).notNullable().defaultTo('BRL')
      // Valores monetários sempre em centavos (inteiros).
      table.integer('list_cents').unsigned().notNullable()
      table.tinyint('discount_pct').unsigned().notNullable().defaultTo(0)
      table.tinyint('max_installments').unsigned().notNullable().defaultTo(1)
      // Modo A: redirecionamento para a URL do provedor (validada contra a lista de domínios).
      table.string('provider', 32).notNullable().defaultTo('redirect')
      table.string('checkout_url', 2048).notNullable().defaultTo('')
      table.string('environment', 16).notNullable().defaultTo('production')
      table.boolean('active').notNullable().defaultTo(false)
      table.integer('updated_by').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    this.schema.createTable('course_versions', (table) => {
      table.increments('id').notNullable()
      table
        .integer('course_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('courses')
        .onDelete('RESTRICT')
      table.integer('version').unsigned().notNullable()
      table.json('data').notNullable()
      // Oferta no momento da publicação: preço e link só mudam na página com nova publicação.
      table.json('commercial').notNullable()
      table.string('template_key', 64).notNullable()
      table.integer('template_version').unsigned().notNullable()
      table.integer('published_by').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.unique(['course_id', 'version'])
    })
  }

  async down() {
    this.schema.dropTable('course_versions')
    this.schema.dropTable('commercial_configs')
    this.schema.dropTable('courses')
  }
}
