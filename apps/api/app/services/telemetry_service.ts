import logger from '@adonisjs/core/services/logger'
import { createTelemetry } from '@academia/telemetry'
import env from '#start/env'

/**
 * Telemetria da API (Azure Application Insights). Desligada sem `APPLICATIONINSIGHTS_CONNECTION_STRING`:
 * todas as chamadas viram no-op. Nada aqui lança, atrasa uma resposta ou envia dado pessoal (ver `@academia/telemetry`).
 */
const telemetry = createTelemetry({
  connectionString: env.get('APPLICATIONINSIGHTS_CONNECTION_STRING'),
  role: 'academia-api',
  version: process.env.APP_VERSION,
  requestSampling: env.get('TELEMETRY_REQUEST_SAMPLING'),
  // O logger ainda pode não existir quando este módulo é carregado (subida): cai no console.
  onError: (message) => {
    try {
      logger.warn(message)
    } catch {
      console.warn(message)
    }
  },
})

export default telemetry
