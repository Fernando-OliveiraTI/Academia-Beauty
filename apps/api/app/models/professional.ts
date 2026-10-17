import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { ProfessionalData, ProfessionalStatus } from '@academia/contracts'

/** mysql2 devolve TINYINT(1) como 0/1; a API promete booleano. */
const bool = { consume: (value: unknown) => Boolean(value) }

const json = {
  prepare: (value: unknown) => JSON.stringify(value),
  consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
}

const nullableJson = {
  prepare: (value: unknown) =>
    value === null || value === undefined ? null : JSON.stringify(value),
  consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : (value ?? null)),
}

export default class Professional extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column()
  declare status: ProfessionalStatus

  @column()
  declare revision: number

  @column(json)
  declare data: ProfessionalData

  @column()
  declare name: string

  @column(bool)
  declare homeVisible: boolean

  @column()
  declare homeOrder: number

  @column(bool)
  declare featured: boolean

  @column(nullableJson)
  declare document: unknown | null

  @column()
  declare documentRevision: number

  @column()
  declare publishedDocumentRevision: number | null

  @column()
  declare publishedVersion: number | null

  @column()
  declare publishedRevision: number | null

  @column.dateTime()
  declare publishedAt: DateTime | null

  @column()
  declare createdBy: number | null

  @column()
  declare updatedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
