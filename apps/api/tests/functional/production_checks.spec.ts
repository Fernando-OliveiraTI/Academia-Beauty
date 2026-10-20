import { test } from '@japa/runner'
import { evaluateProductionConfig } from '#services/production_checks'

const good = {
  APP_KEY: 'k'.repeat(40),
  SESSION_DRIVER: 'database',
  LIMITER_STORE: 'database',
  REVALIDATE_SECRET: 'r'.repeat(30),
  TRUSTED_PROXIES: '10.0.0.0/8',
  REQUIRE_2FA_FOR_ADMINS: true,
  CHECKOUT_ALLOWED_HOSTS: 'pay.exemplo.com',
}

test.group('Configuração de produção', () => {
  test('configuração correta não tem erros nem avisos', ({ assert }) => {
    const report = evaluateProductionConfig(good)
    assert.deepEqual(report, { errors: [], warnings: [] })
  })

  test('chave curta, sessão em memória e limiter em memória impedem a subida', ({ assert }) => {
    const report = evaluateProductionConfig({
      ...good,
      APP_KEY: 'curta',
      SESSION_DRIVER: 'memory',
      LIMITER_STORE: 'memory',
    })
    assert.lengthOf(report.errors, 3)
  })

  test('segredos curtos são erro; ausência de proxy, 2FA e senha do seed viram aviso', ({
    assert,
  }) => {
    const report = evaluateProductionConfig({
      ...good,
      REVALIDATE_SECRET: 'curto',
      TRUSTED_PROXIES: '',
      REQUIRE_2FA_FOR_ADMINS: false,
      ADMIN_PASSWORD: 'x',
      ADMIN_EMAIL: 'admin@academia.local',
    })
    assert.lengthOf(report.errors, 1)
    assert.isAtLeast(report.warnings.length, 4)
  })
})
