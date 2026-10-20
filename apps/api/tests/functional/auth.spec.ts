import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { makeUser, TEST_PASSWORD } from '#tests/helpers'

async function auditActions() {
  const rows = await db.from('audit_logs').select('action').orderBy('id')
  return rows.map((r) => r.action as string)
}

test.group('Auth · login', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('login válido devolve usuário, papéis e permissões e audita', async ({ client, assert }) => {
    const user = await makeUser('editor')
    const response = await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: user.email, password: TEST_PASSWORD })

    response.assertStatus(200)
    assert.equal(response.body().email, user.email)
    assert.deepEqual(response.body().roles, ['editor'])
    assert.include(response.body().permissions, 'pages.write')
    assert.notInclude(response.body().permissions, 'users.manage')
    assert.notProperty(response.body(), 'password')
    assert.include(await auditActions(), 'auth.login')
  })

  test('senha errada e usuário inexistente recebem a mesma resposta (sem enumeração)', async ({
    client,
    assert,
  }) => {
    const user = await makeUser('viewer')
    const wrongPassword = await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: user.email, password: 'errada' })
    const unknownUser = await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: 'ninguem@teste.local', password: 'errada' })

    wrongPassword.assertStatus(401)
    unknownUser.assertStatus(401)
    assert.deepEqual(wrongPassword.body(), unknownUser.body())
    assert.include(await auditActions(), 'auth.login_failed')
  })

  test('usuário inativo não entra, mesmo com senha correta', async ({ client }) => {
    const user = await makeUser('admin', { isActive: false })
    const response = await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: user.email, password: TEST_PASSWORD })
    response.assertStatus(401)
  })

  test('bloqueia após 5 tentativas inválidas (429)', async ({ client }) => {
    const user = await makeUser('viewer')
    for (let i = 0; i < 5; i++) {
      await client
        .post('/auth/login')
        .withCsrfToken()
        .json({ email: user.email, password: 'errada' })
    }
    const blocked = await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: user.email, password: TEST_PASSWORD })
    blocked.assertStatus(429)
  })

  test('rejeita e-mail inválido com 422', async ({ client }) => {
    const response = await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: 'nao-e-email', password: 'x' })
    response.assertStatus(422)
  })

  test('POST sem token CSRF é recusado', async ({ client }) => {
    const user = await makeUser('viewer')
    const response = await client
      .post('/auth/login')
      .json({ email: user.email, password: TEST_PASSWORD })
    response.assertStatus(403)
  })
})

test.group('Auth · sessão', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('/auth/me exige autenticação', async ({ client }) => {
    const response = await client.get('/auth/me')
    response.assertStatus(401)
  })

  test('/auth/me devolve o usuário autenticado', async ({ client, assert }) => {
    const user = await makeUser('viewer')
    const response = await client.get('/auth/me').loginAs(user)
    response.assertStatus(200)
    assert.equal(response.body().id, user.id)
  })

  test('/auth/me recusa usuário desativado após o login', async ({ client }) => {
    const user = await makeUser('viewer')
    user.isActive = false
    await user.save()
    const response = await client.get('/auth/me').loginAs(user)
    response.assertStatus(401)
  })

  test('logout responde 204 e audita', async ({ client, assert }) => {
    const user = await makeUser('viewer')
    const response = await client.post('/auth/logout').withCsrfToken().loginAs(user)
    response.assertStatus(204)
    assert.include(await auditActions(), 'auth.logout')
  })
})

test.group('RBAC', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('anônimo recebe 401', async ({ client }) => {
    const res1 = await client.get('/admin/media')
    res1.assertStatus(401)
  })

  test('viewer recebe 403 (não gerencia mídia)', async ({ client }) => {
    const user = await makeUser('viewer')
    const res2 = await client.get('/admin/media').loginAs(user)
    res2.assertStatus(403)
  })

  test('editor e admin acessam', async ({ client }) => {
    const editor = await makeUser('editor')
    const admin = await makeUser('admin')
    const res3 = await client.get('/admin/media').loginAs(editor)
    res3.assertStatus(200)
    const res4 = await client.get('/admin/media').loginAs(admin)
    res4.assertStatus(200)
  })

  test('usuário inativo com sessão antiga recebe 401', async ({ client }) => {
    const admin = await makeUser('admin', { isActive: false })
    const res5 = await client.get('/admin/media').loginAs(admin)
    res5.assertStatus(401)
  })
})

test.group('Saúde e headers de segurança', () => {
  test('/health responde ok com o banco acessível', async ({ client, assert }) => {
    const response = await client.get('/health')
    response.assertStatus(200)
    assert.equal(response.body().status, 'ok')
  })

  test('envia headers de segurança', async ({ client, assert }) => {
    const response = await client.get('/health')
    assert.equal(response.header('x-frame-options'), 'DENY')
    assert.equal(response.header('x-content-type-options'), 'nosniff')
    assert.exists(response.header('content-security-policy'))
  })
})

test.group('Auth · limite de tentativas', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('e-mail muito longo não quebra a chave do limitador (nunca 500)', async ({
    client,
    assert,
  }) => {
    const email = `${'a'.repeat(200)}@${'b'.repeat(60)}.com`
    for (let i = 0; i < 7; i += 1) {
      const res = await client
        .post('/auth/login')
        .withCsrfToken()
        .json({ email, password: 'qualquer-senha-1' })
      assert.isBelow(res.status(), 500)
    }
  })

  test('bloqueio por excesso de tentativas é auditado uma única vez por janela (sem flood)', async ({
    client,
    assert,
  }) => {
    const user = await makeUser('editor')
    for (let i = 0; i < 12; i += 1) {
      await client
        .post('/auth/login')
        .withCsrfToken()
        .json({ email: user.email, password: 'senha-errada-1' })
    }
    const actions = await auditActions()
    const throttled = actions.filter((a) => a === 'auth.login_throttled')
    assert.equal(throttled.length, 1)
    // o usuário legítimo continua bloqueado mesmo com a senha certa
    const res = await client
      .post('/auth/login')
      .withCsrfToken()
      .json({ email: user.email, password: TEST_PASSWORD })
    res.assertStatus(429)
  })
})
