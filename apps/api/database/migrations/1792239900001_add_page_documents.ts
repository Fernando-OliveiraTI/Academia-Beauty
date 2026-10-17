import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fase 5 (D-020): documento de página próprio, editável no editor visual.
 * `document` nulo = página derivada do cadastro (comportamento anterior). `document_revision` é a
 * concorrência otimista do documento (0 = nunca personalizado). Os snapshots guardam o documento
 * vigente na publicação.
 */
export default class extends BaseSchema {
  async up() {
    for (const table of ['professionals', 'courses']) {
      this.schema.alterTable(table, (t) => {
        t.json('document').nullable()
        t.integer('document_revision').unsigned().notNullable().defaultTo(0)
        t.integer('published_document_revision').unsigned().nullable()
      })
    }
    for (const table of ['professional_versions', 'course_versions']) {
      this.schema.alterTable(table, (t) => {
        t.json('document').nullable()
      })
    }
  }

  async down() {
    for (const table of ['professional_versions', 'course_versions']) {
      this.schema.alterTable(table, (t) => t.dropColumn('document'))
    }
    for (const table of ['professionals', 'courses']) {
      this.schema.alterTable(table, (t) => {
        t.dropColumn('published_document_revision')
        t.dropColumn('document_revision')
        t.dropColumn('document')
      })
    }
  }
}
