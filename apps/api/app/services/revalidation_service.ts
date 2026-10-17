import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

/**
 * Avisa o site (Next) para descartar o cache das tags afetadas. Chamado depois do commit.
 * Falha não desfaz a publicação: o site também expira o cache por tempo (ISR) e se corrige sozinho.
 */
export default class RevalidationService {
  static async revalidate(tags: string[]) {
    const url = env.get('REVALIDATE_URL')
    const secret = env.get('REVALIDATE_SECRET')
    if (!url || !secret || tags.length === 0) return
    if (secret.length < 24) {
      logger.error(
        'REVALIDATE_SECRET tem menos de 24 caracteres: o site recusará a invalidação; cache só expira por tempo'
      )
      return
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) logger.warn({ status: res.status, tags }, 'revalidação do site recusada')
    } catch (error) {
      logger.warn({ err: error, tags }, 'revalidação do site falhou')
    }
  }
}
