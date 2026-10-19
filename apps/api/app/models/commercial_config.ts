import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

const bool = { consume: (value: unknown) => Boolean(value) }

/** Oferta do curso (1:1). Preços em centavos; o Modo A só guarda a URL de redirecionamento. */
export default class CommercialConfig extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare revision: number

  @column()
  declare currency: string

  @column()
  declare listCents: number

  @column()
  declare discountPct: number

  @column()
  declare maxInstallments: number

  @column()
  declare provider: string

  @column()
  declare externalCourseId: string

  @column()
  declare checkoutUrl: string

  @column()
  declare environment: 'production' | 'sandbox'

  @column(bool)
  declare active: boolean

  @column()
  declare updatedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
