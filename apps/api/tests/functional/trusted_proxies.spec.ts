import { test } from '@japa/runner'
import { parseTrustedProxies } from '#services/trusted_proxies'

test.group('TRUSTED_PROXIES', () => {
  test('vazio não confia em ninguém (retorna null)', ({ assert }) => {
    assert.isNull(parseTrustedProxies(undefined))
    assert.isNull(parseTrustedProxies('  , '))
  })

  test('aceita a lista com vírgulas: atalhos, IPs e CIDRs', ({ assert }) => {
    const trust = parseTrustedProxies('loopback,linklocal,uniquelocal, 52.188.77.24 ,20.49.0.0/16')!
    assert.isTrue(trust('127.0.0.1'))
    assert.isTrue(trust('::1'))
    assert.isTrue(trust('10.1.2.3'))
    assert.isTrue(trust('172.20.0.5'))
    assert.isTrue(trust('169.254.129.1'))
    assert.isTrue(trust('52.188.77.24'))
    assert.isTrue(trust('20.49.104.52'))
    assert.isTrue(trust('::ffff:52.188.77.24'))
  })

  test('endereços fora da lista não são confiáveis', ({ assert }) => {
    const trust = parseTrustedProxies('loopback,52.188.77.24')!
    assert.isFalse(trust('8.8.8.8'))
    assert.isFalse(trust('52.188.77.25'))
    assert.isFalse(trust('não-é-ip'))
  })

  test('item inválido (ex.: placeholder esquecido) falha com mensagem clara', ({ assert }) => {
    assert.throws(() => parseTrustedProxies('loopback,<IPS_DO_WEB>'), /<IPS_DO_WEB>/)
    assert.throws(() => parseTrustedProxies('10.0.0.0/99'), /prefixo/)
  })
})
