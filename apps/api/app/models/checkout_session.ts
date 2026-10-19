import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Visita ao checkout embutido (ver a migração para a política de dados). */
export default class CheckoutSession extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare ref: string

  @column()
  declare courseSlug: string | null

  @column()
  declare courseId: number | null

  @column()
  declare ip: string | null

  @column()
  declare country: string | null

  @column()
  declare region: string | null

  @column()
  declare city: string | null

  @column()
  declare userAgent: string | null

  @column()
  declare browser: string | null

  @column()
  declare browserVersion: string | null

  @column()
  declare os: string | null

  @column()
  declare osVersion: string | null

  @column()
  declare device: string | null

  @column()
  declare inApp: string | null

  @column()
  declare language: string | null

  @column()
  declare timezone: string | null

  @column()
  declare viewportW: number | null

  @column()
  declare viewportH: number | null

  @column()
  declare referrerHost: string | null

  @column()
  declare landingPath: string | null

  @column()
  declare utmSource: string | null

  @column()
  declare utmMedium: string | null

  @column()
  declare utmCampaign: string | null

  @column()
  declare utmContent: string | null

  @column()
  declare utmTerm: string | null

  @column({ consume: (value: unknown) => Boolean(value) })
  declare hasClickId: boolean

  @column()
  declare visits: number

  @column.dateTime()
  declare createdAt: DateTime

  @column.dateTime()
  declare lastSeenAt: DateTime
}
