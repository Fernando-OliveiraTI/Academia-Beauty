import limiter from '@adonisjs/limiter/services/main'
import { digest } from '#services/login_guard'

/**
 * Limite por IP dos endpoints públicos (coleta de métricas, visita ao checkout, status do pagamento), numa janela de 1 minuto.
 * Usa o limiter compartilhado do Adonis (store `LIMITER_STORE`: banco em produção), então vale para todas as instâncias
 * da API e sobrevive a reinício, ao contrário de um contador em memória por processo.
 */
export default class IpRateLimit {
  /** Conta 1 requisição de `ip` no escopo e devolve `false` quando passou de `requests` por minuto. */
  static async allow(scope: string, ip: string, requests: number): Promise<boolean> {
    try {
      await limiter.use({ requests, duration: '1 min' }).consume(`pub_${scope}_${digest(ip)}`)
      return true
    } catch {
      // ThrottleException: estourou o limite. Falha do store também nega (preferimos recusar a deixar passar sem limite).
      return false
    }
  }
}

/** Para os testes: zera os contadores em memória. */
export const resetIpRateLimits = () => limiter.clear(['memory'])
