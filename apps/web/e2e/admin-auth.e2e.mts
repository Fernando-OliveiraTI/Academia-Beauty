/**
 * E2E do login administrativo. Requer API (3333) e web (3100) em execução e o admin semeado.
 * Uso: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm e2e
 */
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
assert.ok(EMAIL && PASSWORD, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD')

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext()
const page = await context.newPage()
const cspViolations: string[] = []
page.on('console', (m) => { if (/content security policy/i.test(m.text())) cspViolations.push(m.text()) })
const results: string[] = []
const step = async (name: string, fn: () => Promise<void>) => { await fn(); results.push(`✓ ${name}`) }

try {
  await step('anônimo em /admin é redirecionado para o login', async () => {
    await page.goto(`${BASE}/admin`)
    await page.waitForURL('**/admin/login')
  })

  await step('credenciais inválidas mostram erro genérico e não entram', async () => {
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.getByRole('alert').filter({ hasText: 'E-mail ou senha inválidos.' }).waitFor()
    assert.match(page.url(), /\/admin\/login$/)
  })

  await step('campos vazios são validados no cliente', async () => {
    await page.reload()
    await page.getByRole('button', { name: 'Entrar' }).click()
    assert.equal(await page.getByRole('form', { name: 'Entrar no painel' }).getByRole('alert').count(), 2)
  })

  await step('login válido abre o dashboard', async () => {
    await page.reload()
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/admin`)
    await page.getByRole('heading', { name: /Olá,/ }).waitFor()
  })

  await step('cookie de sessão é HttpOnly e SameSite=Lax', async () => {
    const cookies = await context.cookies()
    const session = cookies.find((c) => c.name === 'adonis-session')
    assert.ok(session, 'cookie adonis-session ausente')
    assert.equal(session.httpOnly, true)
    assert.equal(session.sameSite, 'Lax')
    const xsrf = cookies.find((c) => c.name === 'XSRF-TOKEN')
    assert.ok(xsrf, 'cookie XSRF-TOKEN ausente')
  })

  let oldSessionCookie: { name: string; value: string; domain: string; path: string } | undefined

  await step('logout encerra a sessão e /admin volta a exigir login', async () => {
    const before = (await context.cookies()).find((c) => c.name === 'adonis-session')
    assert.ok(before, 'cookie adonis-session ausente antes do logout')
    oldSessionCookie = { name: before.name, value: before.value, domain: before.domain, path: before.path }
    await page.getByRole('button', { name: 'Sair' }).click()
    await page.waitForURL('**/admin/login')
    await page.goto(`${BASE}/admin`)
    await page.waitForURL('**/admin/login')
  })

  await step('o cookie capturado antes do logout deixa de funcionar (revogação no servidor)', async () => {
    assert.ok(oldSessionCookie)
    const replay = await browser.newContext()
    await replay.addCookies([{ ...oldSessionCookie, httpOnly: true, sameSite: 'Lax', secure: false }])
    const res = await replay.request.get(`${BASE}/api/auth/me`)
    assert.equal(res.status(), 401)
    await replay.close()
  })

  await step('a CSP não bloqueou nada na navegação', async () => {
    assert.deepEqual(cspViolations, [])
  })
} finally {
  await browser.close()
  console.log(results.join('\n'))
}
