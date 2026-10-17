import { BaseSchema } from '@adonisjs/lucid/schema'

/** Papéis e vínculo usuário↔papel. As permissões de cada papel vivem em @academia/contracts (fonte única). */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('roles', (table) => {
      table.increments('id').notNullable()
      table.string('name', 32).notNullable().unique()
      table.timestamp('created_at').notNullable()
    })
    this.schema.createTable('user_roles', (table) => {
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('roles')
        .onDelete('RESTRICT')
      table.primary(['user_id', 'role_id'])
    })
  }

  async down() {
    this.schema.dropTable('user_roles')
    this.schema.dropTable('roles')
  }
}
