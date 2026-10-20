import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import { evaluateProductionConfig } from '#services/production_checks'

// Em produção, recusa subir com configuração insegura e avisa sobre o que merece atenção.
if (app.inProduction) {
  const report = evaluateProductionConfig({
    APP_KEY: env.get('APP_KEY'),
    SESSION_DRIVER: env.get('SESSION_DRIVER'),
    LIMITER_STORE: env.get('LIMITER_STORE'),
    REVALIDATE_SECRET: env.get('REVALIDATE_SECRET'),
    THEMEMBERS_WEBHOOK_TOKEN: env.get('THEMEMBERS_WEBHOOK_TOKEN'),
    TRUSTED_PROXIES: env.get('TRUSTED_PROXIES'),
    REQUIRE_2FA_FOR_ADMINS: env.get('REQUIRE_2FA_FOR_ADMINS'),
    PUBLIC_SHOW_DRAFTS: env.get('PUBLIC_SHOW_DRAFTS'),
    ADMIN_PASSWORD: env.get('ADMIN_PASSWORD'),
    ADMIN_EMAIL: env.get('ADMIN_EMAIL'),
    CHECKOUT_ALLOWED_HOSTS: env.get('CHECKOUT_ALLOWED_HOSTS'),
  })
  for (const warning of report.warnings) logger.warn(`config: ${warning}`)
  if (report.errors.length > 0) {
    throw new Error(`Configuração insegura para produção:\n- ${report.errors.join('\n- ')}`)
  }
}
