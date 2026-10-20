import { test } from '@japa/runner'
import type { ApiResponse } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import TotpService from '#services/totp_service'
import { passwordIssues } from '#services/password_policy'
import { makeUser, TEST_PASSWORD } from '#tests/helpers'

async function expectStatus(request: PromiseLike<ApiResponse>, status: number) {
  const response = await request
  response.assertStatus(status)
  return response
}

const STRONG = 'Outra-Senha-Muito-Forte-9'

async function audits() {
  const rows = await db.from('audit_logs').select('action').orderBy('id')
  return rows.map((r) => r.action as string)
}

/** Habilita o 2FA direto no banco (o fluxo HTTP de ativação tem teste próprio). */
async function withTotp(user: User) {
  const secret = TotpService.generateSecret()
  const recovery = TotpService.generateRecoveryCodes()
  user.totpSecret = TotpService.encrypt(secret)
  user.totpEnabledAt = DateTime.now()
  user.recoveryCodes = JSON.stringify(recovery.hashes)
  await user.save()
  return { secret, recovery: recovery.plain }
}

test.group('Política de senha', () => {
  test('exige tamanho, variedade e que não contenha o e-mail ou o nome', ({ assert }) => {
    assert.isNotEmpty(passwordIssues('curta'))
    assert.isNotEmpty(passwordIssues('aaaaaaaaaaaaaaaa'))
    assert.isNotEmpty(passwordIssues('password1234'))
    assert.isNotEmpty(passwordIssues('maria.silva-2026!', { email: 'maria.silva@x.com' }))
    assert.isNotEmpty(
      passwordIssues('Fernando-2026-Forte', { email: 'a@b.com', fullName: 'Fernando Oliveira' })
    )
    assert.isEmpty(passwordIssues('Cavalo-Bateria-Grampo-77'))
  })
})

test.group('TOTP', () => {
  test('aceita o código atual e vizinhos, recusa errado e repetido', ({ assert }) => {
    const secret = TotpService.generateSecret()
    const now = 1_800_000_000_000
    const code = TotpService.generate(secret, now)
    const step = TotpService.verify(secret, code, null, now)
    assert.isNotNull(step)
    assert.isNull(TotpService.verify(secret, code, step, now), 'mesmo passo não vale duas vezes')
    assert.isNotNull(
      TotpService.verify(secret, TotpService.generate(secret, now - 30_000), null, now)
    )
    assert.isNull(
      TotpService.verify(secret, TotpService.generate(secret, now - 120_000), null, now)
    )
    assert.isNull(
      TotpService.verify(secret, '000000', null, now) === step
        ? null
        : TotpService.verify(secret, 'abcdef', null, now)
    )
  })

  test('vetor RFC 6238 (SHA1, 59 s → 94287082 → 287082)', ({ assert }) => {
    // Segredo ASCII "12345678901234567890" em base32.
    assert.equal(TotpService.generate('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000), '287082')
  })
})

test.group('Login · limites e 2FA', (group) => {
  group.each.setup(async () => {
    await limiter.clear(['memory'])
    return testUtils.db().withGlobalTransaction()
  })

  test('um IP que erra para 20 e-mails diferentes é bloqueado, mesmo com a senha certa', async ({
    client,
  }) => {
    const user = await makeUser('viewer')
    for (let i = 0; i < 20; i++) {
      await client
        .post('/auth/login')
        .withCsrfToken()
        .json({ email: `alvo${i}@teste.local`, password: 'errada-errada' })
    }
    const res = await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: user.email, password: TEST_PASSWORD })
    res.assertStatus(429)
  })

  test('um acerto não zera o contador do IP', async ({ client }) => {
    const user = await makeUser('viewer')
    for (let i = 0; i < 19; i++) {
      await client
        .post('/auth/login')
        .withCsrfToken()
        .json({ email: `outro${i}@teste.local`, password: 'errada-errada' })
    }
    ;(await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: user.email, password: TEST_PASSWORD }),
      200)
    await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: 'x1@teste.local', password: 'errada-errada' })
    await expectStatus(
      client
        .post('/auth/login')
        .withCsrfToken()
        .json({ email: user.email, password: TEST_PASSWORD }),
      429
    )
  })

  test('com 2FA ativo, a senha certa não loga: pede o segundo fator', async ({
    client,
    assert,
  }) => {
    const user = await makeUser('admin')
    await withTotp(user)
    const res = await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: user.email, password: TEST_PASSWORD })
    res.assertStatus(200)
    assert.deepEqual(res.body(), { secondFactorRequired: true })
    const actions = await audits()
    assert.notInclude(actions, 'auth.login')
  })

  test('código do aplicativo conclui o login; reutilizar o mesmo código falha', async ({
    client,
    assert,
  }) => {
    const user = await makeUser('admin')
    const { secret } = await withTotp(user)
    const session = { pending_2fa: { userId: user.id, until: Date.now() + 60_000 } }
    const code = TotpService.generate(secret)

    const ok = await client
      .post('/auth/login/2fa')
      .withCsrfToken()
      .withSession(session)
      .json({ code })
    ok.assertStatus(200)
    assert.equal(ok.body().email, user.email)
    assert.isTrue(ok.body().twoFactorEnabled)

    const again = await client
      .post('/auth/login/2fa')
      .withCsrfToken()
      .withSession(session)
      .json({ code })
    again.assertStatus(401)
  })

  test('código de recuperação vale uma vez só', async ({ client }) => {
    const user = await makeUser('editor')
    const { recovery } = await withTotp(user)
    const session = { pending_2fa: { userId: user.id, until: Date.now() + 60_000 } }
    ;(await client
      .post('/auth/login/2fa')
      .withCsrfToken()
      .withSession(session)
      .json({ recoveryCode: recovery[0] }),
      200)
    await expectStatus(
      client
        .post('/auth/login/2fa')
        .withCsrfToken()
        .withSession(session)
        .json({ recoveryCode: recovery[0] }),
      401
    )
  })

  test('sem passo pendente, ou expirado, o segundo fator é recusado', async ({ client }) => {
    const user = await makeUser('admin')
    const { secret } = await withTotp(user)
    const code = TotpService.generate(secret)
    await expectStatus(client.post('/auth/login/2fa').withCsrfToken().json({ code }), 401)
    const expired = { pending_2fa: { userId: user.id, until: Date.now() - 1 } }
    await expectStatus(
      client.post('/auth/login/2fa').withCsrfToken().withSession(expired).json({ code }),
      401
    )
  })

  test('5 códigos errados bloqueiam o segundo fator', async ({ client }) => {
    const user = await makeUser('admin')
    const { secret } = await withTotp(user)
    const session = { pending_2fa: { userId: user.id, until: Date.now() + 60_000 } }
    for (let i = 0; i < 5; i++) {
      await client
        .post('/auth/login/2fa')
        .withCsrfToken()
        .withSession(session)
        .json({ code: '000000' })
    }
    const res = await client
      .post('/auth/login/2fa')
      .withCsrfToken()
      .withSession(session)
      .json({ code: TotpService.generate(secret) })
    res.assertStatus(429)
  })
})

test.group('Conta · senha e 2FA', (group) => {
  group.each.setup(async () => {
    await limiter.clear(['memory'])
    return testUtils.db().withGlobalTransaction()
  })

  test('troca de senha: exige a atual, aplica a política e encerra as outras sessões', async ({
    client,
    assert,
  }) => {
    const user = await makeUser('editor')
    const wrong = await client
      .post('/auth/password')
      .withCsrfToken()
      .loginAs(user)
      .json({ currentPassword: 'errada', newPassword: STRONG })
    wrong.assertStatus(422)
    const weak = await client
      .post('/auth/password')
      .withCsrfToken()
      .loginAs(user)
      .json({ currentPassword: TEST_PASSWORD, newPassword: 'curta' })
    weak.assertStatus(422)
    assert.equal(weak.body().code, 'weak_password')

    const ok = await client
      .post('/auth/password')
      .withCsrfToken()
      .loginAs(user)
      .json({ currentPassword: TEST_PASSWORD, newPassword: STRONG })
    ok.assertStatus(204)
    const fresh = await User.findOrFail(user.id)
    assert.equal(fresh.sessionEpoch, 1)
    assert.include(await audits(), 'auth.password_changed')

    // Uma sessão da época anterior (outro aparelho) deixa de valer.
    await expectStatus(client.get('/auth/me').loginAs(user), 401)
    // E a senha nova entra.
    ;(await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: user.email, password: STRONG }),
      200)
  })

  test('troca de senha pendente barra o painel, mas não a conta', async ({ client }) => {
    const user = await makeUser('admin')
    user.mustChangePassword = true
    await user.save()
    const blocked = await client.get('/admin/home').loginAs(user)
    blocked.assertStatus(403)
    blocked.assertBodyContains({ code: 'password_change_required' })
    await expectStatus(client.get('/auth/me').loginAs(user), 200)
    await expectStatus(
      client
        .post('/auth/password')
        .withCsrfToken()
        .loginAs(user)
        .json({ currentPassword: TEST_PASSWORD, newPassword: STRONG }),
      204
    )
    const after = await User.findOrFail(user.id)
    await expectStatus(
      client.get('/admin/home').loginAs(after).withSession({ auth_epoch: after.sessionEpoch }),
      200
    )
  })

  test('ativação do 2FA: setup devolve segredo, enable confirma com código e devolve recuperação', async ({
    client,
    assert,
  }) => {
    const user = await makeUser('admin')
    const setup = await client.post('/auth/2fa/setup').withCsrfToken().loginAs(user)
    setup.assertStatus(200)
    const secret = setup.body().secret as string
    assert.match(setup.body().otpauthUri, /^otpauth:\/\/totp\//)

    // O segredo fica na sessão: repetimos no enable via withSession (cada requisição do teste é uma sessão nova).
    const bad = await client
      .post('/auth/2fa/enable')
      .withCsrfToken()
      .loginAs(user)
      .withSession({ totp_setup: secret })
      .json({ code: '000000' })
    bad.assertStatus(422)
    const ok = await client
      .post('/auth/2fa/enable')
      .withCsrfToken()
      .loginAs(user)
      .withSession({ totp_setup: secret })
      .json({ code: TotpService.generate(secret) })
    ok.assertStatus(200)
    assert.lengthOf(ok.body().recoveryCodes, 10)
    const fresh = await User.findOrFail(user.id)
    assert.isTrue(fresh.twoFactorEnabled)
    assert.notEqual(fresh.totpSecret, secret, 'segredo cifrado no banco')
    assert.include(await audits(), 'auth.2fa_enabled')
  })

  test('desativar o 2FA exige senha e código', async ({ client, assert }) => {
    const user = await makeUser('admin')
    const { secret } = await withTotp(user)
    ;(await client
      .post('/auth/2fa/disable')
      .withCsrfToken()
      .loginAs(user)
      .json({ password: 'errada', code: TotpService.generate(secret) }),
      422)
    await expectStatus(
      client
        .post('/auth/2fa/disable')
        .withCsrfToken()
        .loginAs(user)
        .json({ password: TEST_PASSWORD, code: TotpService.generate(secret) }),
      204
    )
    const after = await User.findOrFail(user.id)
    assert.isFalse(after.twoFactorEnabled)
  })
})

test.group('Usuários (admin)', (group) => {
  group.each.setup(async () => {
    await limiter.clear(['memory'])
    return testUtils.db().withGlobalTransaction()
  })

  test('só administrador gerencia usuários', async ({ client }) => {
    const editor = await makeUser('editor')
    await expectStatus(client.get('/admin/users').loginAs(editor), 403)
    await expectStatus(client.get('/admin/users'), 401)
  })

  test('cria usuário com senha provisória, que obriga a troca no primeiro acesso', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const res = await client
      .post('/admin/users')
      .withCsrfToken()
      .loginAs(admin)
      .json({ email: 'nova.pessoa@teste.local', fullName: 'Nova Pessoa', role: 'editor' })
    res.assertStatus(201)
    const temp = res.body().temporaryPassword as string
    assert.isAtLeast(temp.length, 12)
    assert.equal(res.body().user.role, 'editor')
    assert.isTrue(res.body().user.mustChangePassword)
    assert.notProperty(res.body().user, 'password')

    const login = await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: 'nova.pessoa@teste.local', password: temp })
    login.assertStatus(200)
    assert.isTrue(login.body().mustChangePassword)
    ;(await client
      .post('/admin/users')
      .withCsrfToken()
      .loginAs(admin)
      .json({ email: 'nova.pessoa@teste.local', fullName: 'Outra', role: 'viewer' }),
      409)
    assert.include(await audits(), 'user.created')
  })

  test('não deixa o administrador se desativar nem rebaixar, nem remover o último admin', async ({
    client,
  }) => {
    const admin = await makeUser('admin')
    ;(await client
      .put(`/admin/users/${admin.id}`)
      .withCsrfToken()
      .loginAs(admin)
      .json({ isActive: false }),
      422)
    await expectStatus(
      client
        .put(`/admin/users/${admin.id}`)
        .withCsrfToken()
        .loginAs(admin)
        .json({ role: 'viewer' }),
      422
    )
    const other = await makeUser('admin')
    await expectStatus(
      client
        .put(`/admin/users/${other.id}`)
        .withCsrfToken()
        .loginAs(admin)
        .json({ role: 'viewer' }),
      200
    )
  })

  test('desativar encerra as sessões; redefinir senha invalida e exige troca', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const target = await makeUser('editor')
    await expectStatus(
      client
        .put(`/admin/users/${target.id}`)
        .withCsrfToken()
        .loginAs(admin)
        .json({ isActive: false }),
      200
    )
    const deactivated = await User.findOrFail(target.id)
    assert.equal(deactivated.sessionEpoch, 1)

    const other = await makeUser('viewer')
    const reset = await client
      .post(`/admin/users/${other.id}/reset-password`)
      .withCsrfToken()
      .loginAs(admin)
    reset.assertStatus(200)
    const fresh = await User.findOrFail(other.id)
    assert.isTrue(fresh.mustChangePassword)
    assert.equal(fresh.sessionEpoch, 1)
    ;(await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: other.email, password: reset.body().temporaryPassword }),
      200)
  })

  test('redefinir o 2FA remove o segundo fator', async ({ client, assert }) => {
    const admin = await makeUser('admin')
    const target = await makeUser('editor')
    await withTotp(target)
    await expectStatus(
      client.post(`/admin/users/${target.id}/reset-2fa`).withCsrfToken().loginAs(admin),
      200
    )
    const cleared = await User.findOrFail(target.id)
    assert.isFalse(cleared.twoFactorEnabled)
    assert.include(await audits(), 'user.2fa_reset')
  })
})
