import { createHash } from 'node:crypto'
import limiter from '@adonisjs/limiter/services/main'

/**
 * Limites de tentativas de login em três escopos, todos contando só FALHAS (um acerto não zera o contador de IP
 * ou de e-mail, para o atacante não "limpar" o limite alternando com uma conta válida):
 * - par IP + e-mail: 5 falhas / 15 min (tentativa direcionada);
 * - IP: 20 falhas / 15 min (varredura de vários e-mails a partir de um IP);
 * - e-mail: 10 falhas / 15 min (muitos IPs contra uma conta; o limite é maior para um atacante não bloquear o
 *   dono da conta com poucas tentativas).
 */
const SCOPES = {
  pair: { requests: 5, duration: '15 mins', blockDuration: '15 mins' },
  ip: { requests: 20, duration: '15 mins', blockDuration: '15 mins' },
  email: { requests: 10, duration: '15 mins', blockDuration: '15 mins' },
} as const

type Scope = keyof typeof SCOPES

/** Chave curta e de tamanho fixo (a coluna `rate_limits.key` tem 255 caracteres; o e-mail é entrada livre). */
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex').slice(0, 40)

function keysFor(ip: string, email: string): Record<Scope, string> {
  const mail = email.toLowerCase()
  return {
    pair: `login_${digest(`${ip}|${mail}`)}`,
    ip: `login_ip_${digest(ip)}`,
    email: `login_mail_${digest(mail)}`,
  }
}

export default class LoginGuard {
  /** `true` se algum dos escopos já está bloqueado (não verifica a senha nesse caso). */
  static async isBlocked(ip: string, email: string): Promise<boolean> {
    const keys = keysFor(ip, email)
    for (const scope of Object.keys(SCOPES) as Scope[]) {
      if (await limiter.use(SCOPES[scope]).isBlocked(keys[scope])) return true
    }
    return false
  }

  static async recordFailure(ip: string, email: string): Promise<void> {
    const keys = keysFor(ip, email)
    for (const scope of Object.keys(SCOPES) as Scope[]) {
      try {
        await limiter.use(SCOPES[scope]).consume(keys[scope])
      } catch {
        // estourou o limite: a chave passa a constar como bloqueada
      }
    }
  }

  /** Login correto zera só o contador do par (a conta legítima volta ao normal); IP e e-mail seguem contando. */
  static async clearPair(ip: string, email: string): Promise<void> {
    await limiter.use(SCOPES.pair).delete(keysFor(ip, email).pair)
  }

  /** Segundo fator: 5 falhas / 15 min por usuário. */
  static readonly second = { requests: 5, duration: '15 mins', blockDuration: '15 mins' } as const
  static async secondFactorBlocked(userId: number): Promise<boolean> {
    return limiter.use(LoginGuard.second).isBlocked(`totp_${userId}`)
  }
  static async secondFactorFailed(userId: number): Promise<void> {
    try {
      await limiter.use(LoginGuard.second).consume(`totp_${userId}`)
    } catch {
      // bloqueado
    }
  }
  static async secondFactorOk(userId: number): Promise<void> {
    await limiter.use(LoginGuard.second).delete(`totp_${userId}`)
  }
}
