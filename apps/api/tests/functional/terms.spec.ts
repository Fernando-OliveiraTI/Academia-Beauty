/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).body()` mantém os testes legíveis */
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { LEGAL_VERSION } from '@academia/contracts'
import { makeUser } from '#tests/helpers'

test.group('Aceite dos Termos e da Política no painel (D-041)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('sem aceite o `me` informa null; aceitar a versão vigente grava, audita e aparece no `me`', async ({
    client,
    assert,
  }) => {
    const user = await makeUser('professional')
    assert.isNull((await client.get('/auth/me').loginAs(user)).body().termsAcceptedVersion)

    const res = await client
      .post('/auth/terms')
      .withCsrfToken()
      .loginAs(user)
      .json({ version: LEGAL_VERSION })
    res.assertStatus(204)
    assert.equal(
      (await client.get('/auth/me').loginAs(user)).body().termsAcceptedVersion,
      LEGAL_VERSION
    )
    const row = await db.from('users').where('id', user.id).first()
    assert.equal(row.terms_version, LEGAL_VERSION)
    assert.isNotNull(row.terms_accepted_at)
    const audit = await db
      .from('audit_logs')
      .where('actor_id', user.id)
      .where('action', 'auth.terms_accepted')
      .first()
    assert.isNotNull(audit)
  })

  test('versão antiga é recusada; sem sessão 401; sem CSRF 403', async ({ client }) => {
    const user = await makeUser('editor')
    ;(
      await client.post('/auth/terms').withCsrfToken().loginAs(user).json({ version: '2020-01-01' })
    ).assertStatus(422)
    ;(
      await client.post('/auth/terms').withCsrfToken().json({ version: LEGAL_VERSION })
    ).assertStatus(401)
    ;(await client.post('/auth/terms').loginAs(user).json({ version: LEGAL_VERSION })).assertStatus(
      403
    )
  })
})
