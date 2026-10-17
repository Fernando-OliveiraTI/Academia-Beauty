import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { ProfessionalData } from '@academia/contracts'

const nullableJson = {
  prepare: (value: unknown) =>
    value === null || value === undefined ? null : JSON.stringify(value),
  consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : (value ?? null)),
}

/** Snapshot imutável de uma publicação: nunca é atualizado depois de criado. */
export default class ProfessionalVersion extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare professionalId: number

  @column()
  declare version: number

  @column({
    prepare: (value: unknown) => JSON.stringify(value),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare data: ProfessionalData

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
