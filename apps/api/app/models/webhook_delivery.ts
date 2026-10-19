import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Uma chamada recebida no webhook (ver a migração para a política de dados). */
export default class WebhookDelivery extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare provider: string

  @column()
  declare result: string

  @column()
  declare httpStatus: number

  @column()
  declare event: string | null

  @column()
  declare signatureScheme: string | null

  @column()
  declare ip: string | null

  @column({
    prepare: (value: unknown) => JSON.stringify(value),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare headers: Record<string, string>

  @column()
  declare bodyBytes: number

  @column({ consume: (value: unknown) => Boolean(value) })
  declare bodyTruncated: boolean

  @column()
  declare rawBody: string | null

  @column()
  declare paymentEventId: number | null

  @column.dateTime()
  declare receivedAt: DateTime
}
