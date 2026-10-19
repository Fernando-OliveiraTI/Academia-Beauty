import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { DateTime } from 'luxon'
import CommercialConfig from '#models/commercial_config'
import PaymentEvent from '#models/payment_event'

/** Resultado da recepção: o controller só traduz para HTTP. */
export type ReceiveResult =
  | { ok: true; duplicate: boolean; eventId: number | null; courseId: number | null }
  | { ok: false; status: 400 | 403 | 503; code: string; message: string }

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max = 200): string | null =>
  typeof v === 'string' && v.trim()
    ? v.trim().slice(0, max)
    : typeof v === 'number'
      ? String(v)
      : null
const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null

/* --------------------------------- assinatura -------------------------------- */

/**
 * Confere o cabeçalho `X-Signature` (HMAC SHA-256 com o segredo compartilhado). A documentação da The Members é
 * ambígua sobre a string assinada (diz "payload bruto", mas os exemplos normalizam o JSON e incluem a URL do webhook),
 * então aceitamos as variantes documentadas — todas exigem o segredo — e registramos qual casou (`signature_scheme`).
 * Comparação em tempo constante. Devolve o nome da variante ou `null` se nenhuma casar.
 */
export function verifySignature(
  raw: string,
  header: string | undefined,
  secret: string,
  webhookUrl?: string
): string | null {
  if (!header || !secret) return null
  const received = header.trim().replace(/^sha256=/i, '')
  if (!received) return null

  const messages: Array<[string, string]> = [['raw', raw]]
  try {
    messages.push(['json', JSON.stringify(JSON.parse(raw))])
  } catch {
    return null
  }
  if (webhookUrl) {
    for (const [name, body] of [...messages])
      messages.push([`url+${name}`, `${webhookUrl}:${body}`])
  }

  const buf = Buffer.from(received)
  for (const [name, message] of messages) {
    const digest = createHmac('sha256', secret).update(message).digest()
    for (const [encoding, value] of [
      ['hex', digest.toString('hex')],
      ['base64', digest.toString('base64')],
    ] as const) {
      const expected = Buffer.from(value)
      const candidate = encoding === 'hex' ? Buffer.from(received.toLowerCase()) : buf
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
        return `${name}+${encoding}`
      }
    }
  }
  return null
}

/* ------------------------------ leitura do corpo ----------------------------- */

/**
 * JSON.parse perde precisão em inteiros acima de 2^53 e a The Members usa IDs desse tamanho: aspas nos `"id"` longos
 * antes de ler, para guardá-los como texto exato.
 */
export function parseBody(raw: string): unknown | null {
  try {
    return JSON.parse(raw.replace(/("(?:id|product_id)"\s*:\s*)(\d{15,})/g, '$1"$2"'))
  } catch {
    return null
  }
}

/* ------------------------------ dados pessoais ------------------------------- */

export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@')
  if (!domain) return '***'
  return `${user.slice(0, 1)}***@${domain.slice(0, 1)}***${domain.includes('.') ? domain.slice(domain.indexOf('.')) : ''}`.slice(
    0,
    120
  )
}

/** "Maria Souza Lima" → "Maria L." */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : ''
  return (last ? `${first} ${last.toUpperCase()}.` : first).slice(0, 80)
}

const DROP_KEYS = new Set([
  'company',
  'document_number',
  'phone',
  'phone_country',
  'qrcode_data',
  'qrcode_url',
  'barcode_data',
  'barcode_url',
])

/** Cópia do corpo sem dados pessoais nem códigos de pagamento (guardada só para conferência). */
export function redact(value: unknown, key = '', depth = 0): unknown {
  if (depth > 12) return null
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, key, depth + 1))
  if (isObj(value)) {
    const out: Json = {}
    for (const [k, v] of Object.entries(value)) {
      if (DROP_KEYS.has(k)) continue
      out[k] = redact(v, k, depth + 1)
    }
    return out
  }
  if (typeof value === 'string') {
    if (key === 'email') return maskEmail(value)
    if (key === 'name') return maskName(value)
    return value.slice(0, 300)
  }
  return value
}

/* --------------------------------- resumo ------------------------------------ */

export type Summary = {
  event: string
  kind: 'transaction' | 'order' | 'access' | 'abandoned' | 'other'
  status: string | null
  externalProductId: string | null
  externalTransactionId: string | null
  paymentMethod: string | null
  amountCents: number | null
  currency: string | null
  instalments: number | null
  cardBrand: string | null
  buyerName: string | null
  buyerEmail: string | null
  occurredAt: DateTime
}

const STATUS_BY_EVENT: Record<string, string> = {
  'transaction.approved': 'approved',
  'transaction.failed': 'failed',
  'transaction.refunded': 'refunded',
  'transaction.charged_back': 'charged_back',
  'transaction.pending_refund': 'pending_refund',
  'transaction.payment_cc_initiated': 'processing',
  'transaction.pix_generated': 'pending',
  'transaction.boleto_generated': 'pending',
  'order.completed': 'completed',
  'order.canceled': 'canceled',
  'order.expired': 'expired',
  'release.access': 'granted',
  'revoke.access': 'revoked',
  'abandoned': 'abandoned',
}

function parseWhen(value: unknown): DateTime {
  const text = str(value, 40)
  if (text) {
    const iso = DateTime.fromISO(text, { zone: 'utc' })
    if (iso.isValid) return iso
    const sql = DateTime.fromSQL(text, { zone: 'utc' })
    if (sql.isValid) return sql
  }
  return DateTime.utc()
}

/** Resume o evento. Aceita os dois envelopes da documentação (`payload.*` na venda única, campos na raiz na assinatura). */
export function summarize(root: unknown): Summary | null {
  if (!isObj(root)) return null
  const p = isObj(root.payload) ? root.payload : root
  const event = str(p.event, 48)
  if (!event || !/^[a-z_.]+$/.test(event)) return null
  const data = isObj(p.data) ? p.data : {}
  const order = isObj(data.order) ? data.order : null
  const subscription = isObj(data.subscription) ? data.subscription : null
  const transaction = isObj(data.transaction) ? data.transaction : null
  const details = isObj(data.payment_details) ? data.payment_details : null
  const lastTx = Array.isArray(data.transactions)
    ? data.transactions.filter(isObj).at(-1)
    : undefined

  const kind = event.startsWith('transaction.')
    ? 'transaction'
    : event.startsWith('order.')
      ? 'order'
      : event === 'release.access' || event === 'revoke.access'
        ? 'access'
        : event === 'abandoned'
          ? 'abandoned'
          : 'other'

  const mainProduct = isObj(order?.main_product)
    ? order.main_product
    : isObj(subscription?.product)
      ? subscription.product
      : isObj(data.main_product)
        ? data.main_product
        : isObj(data.product)
          ? data.product
          : null
  const customer = isObj(order?.customer)
    ? order.customer
    : isObj(subscription?.subscriber)
      ? subscription.subscriber
      : isObj(data.customer)
        ? data.customer
        : null
  const card = isObj(details?.credit_card)
    ? details.credit_card
    : isObj(lastTx?.credit_card)
      ? lastTx.credit_card
      : null
  const name = str(customer?.name, 120)
  const email = str(customer?.email, 160)

  return {
    event,
    kind,
    status: STATUS_BY_EVENT[event] ?? str(data.status, 32),
    externalProductId: str(mainProduct?.id, 64),
    externalTransactionId: kind === 'transaction' ? str(data.id, 40) : null,
    paymentMethod: str(details?.payment_method, 16) ?? str(lastTx?.payment_method, 16),
    amountCents: int(transaction?.total_amount) ?? int(transaction?.amount) ?? int(lastTx?.value),
    currency: (str(transaction?.currency, 3) ?? str(lastTx?.currency, 3))?.toUpperCase() ?? null,
    instalments: int(card?.instalments) ?? int(lastTx?.instalments),
    cardBrand: str(card?.brand, 24),
    buyerName: name ? maskName(name) : null,
    buyerEmail: email ? maskEmail(email) : null,
    occurredAt: parseWhen(p.created_at ?? data.paid_at),
  }
}

/* -------------------------------- recepção ----------------------------------- */

export default class ThemembersWebhookService {
  static async receive(
    raw: string,
    signature: string | undefined,
    secret: string | undefined,
    webhookUrl?: string
  ): Promise<ReceiveResult> {
    // Sem segredo configurado nada é aceito: um receptor sem verificação seria uma porta aberta.
    if (!secret) {
      return {
        ok: false,
        status: 503,
        code: 'webhook_not_configured',
        message: 'Webhook não configurado',
      }
    }
    const scheme = verifySignature(raw, signature, secret, webhookUrl)
    if (!scheme)
      return { ok: false, status: 403, code: 'invalid_signature', message: 'Assinatura inválida' }

    const body = parseBody(raw)
    const summary = summarize(body)
    if (!summary)
      return { ok: false, status: 400, code: 'invalid_payload', message: 'Evento não reconhecido' }

    const eventKey = createHash('sha256').update(raw).digest('hex')
    const existing = await PaymentEvent.findBy('eventKey', eventKey)
    if (existing)
      return { ok: true, duplicate: true, eventId: existing.id, courseId: existing.courseId }

    const config = summary.externalProductId
      ? await CommercialConfig.query()
          .where('external_course_id', summary.externalProductId)
          .first()
      : null

    try {
      const row = await PaymentEvent.create({
        eventKey,
        provider: 'themembers',
        event: summary.event,
        kind: summary.kind,
        status: summary.status,
        externalProductId: summary.externalProductId,
        externalTransactionId: summary.externalTransactionId,
        courseId: config?.courseId ?? null,
        paymentMethod: summary.paymentMethod,
        amountCents: summary.amountCents,
        currency: summary.currency,
        instalments: summary.instalments,
        cardBrand: summary.cardBrand,
        buyerName: summary.buyerName,
        buyerEmail: summary.buyerEmail,
        signatureScheme: scheme,
        payload: redact(body) as Json,
        occurredAt: summary.occurredAt,
        receivedAt: DateTime.utc(),
      })
      return { ok: true, duplicate: false, eventId: row.id, courseId: row.courseId }
    } catch (error) {
      // Duas entregas simultâneas do mesmo evento: a segunda perde a corrida e vale como duplicada.
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        return { ok: true, duplicate: true, eventId: null, courseId: config?.courseId ?? null }
      }
      throw error
    }
  }
}
