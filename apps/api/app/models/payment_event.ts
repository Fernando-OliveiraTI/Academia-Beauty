import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Evento de pagamento recebido por webhook (somente leitura depois de gravado). */
export default class PaymentEvent extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare eventKey: string

  @column()
  declare provider: string

  @column()
  declare event: string

  @column()
  declare kind: string

  @column()
  declare status: string | null

  @column()
  declare externalProductId: string | null

  @column()
  declare externalTransactionId: string | null

  @column()
  declare courseId: number | null

  @column()
  declare paymentMethod: string | null

  @column()
  declare amountCents: number | null

  @column()
  declare currency: string | null

  @column()
  declare instalments: number | null

  @column()
  declare cardBrand: string | null

  @column()
  declare buyerName: string | null

  @column()
  declare buyerEmail: string | null

  @column()
  declare signatureScheme: string

  @column({
    prepare: (value: unknown) => JSON.stringify(value),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare payload: Record<string, unknown>

  @column.dateTime()
  declare occurredAt: DateTime

  @column.dateTime()
  declare receivedAt: DateTime
}
