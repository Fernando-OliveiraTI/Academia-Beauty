import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { CommercialInput, CourseData } from '@academia/contracts'

const json = {
  prepare: (value: unknown) => JSON.stringify(value),
  consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
}

const nullableJson = {
  prepare: (value: unknown) =>
    value === null || value === undefined ? null : JSON.stringify(value),
  consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : (value ?? null)),
}

/** Snapshot imutável de uma publicação (conteúdo + oferta): nunca é atualizado depois de criado. */
export default class CourseVersion extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare version: number

  @column(json)
  declare data: CourseData

  @column(json)
  declare commercial: CommercialInput

  @column(nullableJson)
  declare document: unknown | null

  @column()
  declare templateKey: string

  @column()
  declare templateVersion: number

  @column()
  declare publishedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
