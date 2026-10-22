import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import telemetry from '#services/telemetry_service'

/** Envia um evento de teste ao Application Insights e mostra a resposta do serviço (confere a connection string). */
export default class TelemetryCheck extends BaseCommand {
  static commandName = 'telemetry:check'
  static description = 'Envia um evento de teste ao Application Insights e mostra se foi aceito'
  static options: CommandOptions = { startApp: true }

  async run() {
    if (!telemetry.enabled) {
      this.logger.error(
        'Telemetria desligada: defina APPLICATIONINSIGHTS_CONNECTION_STRING com um valor válido.'
      )
      this.exitCode = 1
      return
    }
    const result = await telemetry.check()
    if (result.ok) {
      this.logger.success(
        `Aceito pelo serviço (HTTP ${result.status}, ${result.itemsAccepted}/${result.itemsReceived}). O evento aparece em "telemetry.check" em alguns minutos.`
      )
      return
    }
    this.logger.error(
      `Recusado: HTTP ${result.status}. ${[result.message, ...(result.errors ?? [])].filter(Boolean).join(' | ')}`
    )
    this.exitCode = 1
  }
}
