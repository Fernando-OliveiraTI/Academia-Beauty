import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import RetentionService from '#services/retention_service'

/** Apaga dados vencidos conforme a retenção de cada tabela. Agende uma vez ao dia (cron). */
export default class MaintenancePurge extends BaseCommand {
  static commandName = 'maintenance:purge'
  static description =
    'Apaga dados vencidos (eventos, auditoria, sessões, limites, visitas e registros de webhook)'
  static options: CommandOptions = { startApp: true }

  async run() {
    const report = await RetentionService.purgeAll()
    for (const [table, count] of Object.entries(report))
      this.logger.info(`${table}: ${count} linha(s) removida(s)`)
  }
}
