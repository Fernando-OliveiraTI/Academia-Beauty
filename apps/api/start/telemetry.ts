import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import telemetry from '#services/telemetry_service'
import { trackCompletedRequest } from '#services/request_telemetry'

if (telemetry.enabled) {
  emitter.on('http:request_completed', (event) => trackCompletedRequest(telemetry, event))
  // Ao encerrar o processo (deploy, reinício), envia o que sobrou na fila.
  app.terminating(() => telemetry.shutdown())
  logger.info('telemetria ligada (Application Insights)')
} else if (app.inProduction) {
  logger.warn(
    'telemetria desligada: defina APPLICATIONINSIGHTS_CONNECTION_STRING para monitorar erros e latência'
  )
}
