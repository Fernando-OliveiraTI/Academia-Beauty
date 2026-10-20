import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import encryption from '@adonisjs/core/services/encryption'

const STEP_SECONDS = 30
const DIGITS = 6
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf: Buffer): string {
  let bits = ''
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i < bits.length; i += 5)
    out += B32[Number.parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]
  return out
}

function base32Decode(text: string): Buffer {
  let bits = ''
  for (const char of text.replace(/=+$/g, '').toUpperCase()) {
    const index = B32.indexOf(char)
    if (index === -1) throw new Error('base32 inválido')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function codeAt(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', secret).update(counter).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS
  return String(value).padStart(DIGITS, '0')
}

const currentStep = (now: number) => Math.floor(now / 1000 / STEP_SECONDS)

export default class TotpService {
  /** Segredo novo (160 bits) em base32, o formato dos aplicativos autenticadores. */
  static generateSecret(): string {
    return base32Encode(randomBytes(20))
  }

  static otpauthUri(secret: string, account: string, issuer = 'Academia Beauty'): string {
    const label = encodeURIComponent(`${issuer}:${account}`)
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`
  }

  /**
   * Confere o código na janela de ±1 passo (relógios levemente fora de hora). Devolve o passo aceito ou `null`.
   * `lastStep` bloqueia reuso: só passos maiores que o último aceito valem.
   */
  static verify(
    secret: string,
    code: string,
    lastStep: number | null = null,
    now = Date.now()
  ): number | null {
    if (!/^\d{6}$/.test(code)) return null
    const key = base32Decode(secret)
    const step = currentStep(now)
    for (const candidate of [step - 1, step, step + 1]) {
      if (lastStep !== null && candidate <= lastStep) continue
      const expected = Buffer.from(codeAt(key, candidate))
      const given = Buffer.from(code)
      if (expected.length === given.length && timingSafeEqual(expected, given)) return candidate
    }
    return null
  }

  /** Código do passo atual (usado nos testes e para conferência). */
  static generate(secret: string, now = Date.now()): string {
    return codeAt(base32Decode(secret), currentStep(now))
  }

  static encrypt(secret: string): string {
    return encryption.encrypt(secret)
  }

  static decrypt(payload: string): string | null {
    return encryption.decrypt<string>(payload)
  }

  /** 10 códigos de uso único (`abcde-fghij`); só os hashes vão para o banco. */
  static generateRecoveryCodes(): { plain: string[]; hashes: string[] } {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
    const make = () =>
      Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join('')
    const plain = Array.from({ length: 10 }, () => {
      const raw = make()
      return `${raw.slice(0, 5)}-${raw.slice(5)}`
    })
    return { plain, hashes: plain.map(TotpService.hashRecoveryCode) }
  }

  static hashRecoveryCode(code: string): string {
    return createHash('sha256').update(code.trim().toLowerCase().replace(/\s+/g, '')).digest('hex')
  }
}
