/**
 * E2E da área Insights (D-040): visitas, tempo na página e cliques chegam pelo rastreador público, a tela mostra o funil
 * por curso com filtros (profissional, curso, aparelho, período) e o login de profissional vê só os próprios cursos
 * (o resto do painel fica fechado). Cria profissionais/curso `e2e-ins-*` e um login de teste; apaga/desativa no fim.
 * Requer API (3333) migrada e o build de produção do web (3100).
 * Uso: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web e2e:insights
 */
import { chromium, type BrowserContext, type Page } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
assert.ok(EMAIL && PASSWORD, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD')

const stamp = Date.now().toString(36)
const letters = stamp.replace(/[0-9]/g, 'x')
const PRO = { slug: `e2e-ins-pro-${stamp}`, name: `Insights E2e ${letters}`.slice(0, 40) }
const OTHER = { slug: `e2e-ins-out-${stamp}`, name: `Outro E2e ${letters}`.slice(0, 40) }
const COURSE = { slug: `e2e-ins-curso-${stamp}`, title: `Curso Insights ${letters}`.slice(0, 40) }

const browser = await chromium.launch({ channel: 'chrome' })
const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await admin.newPage()
const consoleErrors: string[] = []
const watch = (p: Page) => {
  p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  p.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
}
watch(page)
const results: string[] = []
const step = async (name: string, fn: () => Promise<void>) => { await fn(); results.push(`✓ ${name}`) }
const xsrf = async (ctx: BrowserContext) => decodeURIComponent((await ctx.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? '')
const send = async (ctx: BrowserContext, method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) => {
  const res = await ctx.request[method](`${BASE}/api${path}`, { headers: { 'x-xsrf-token': await xsrf(ctx) }, data })
  return { status: res.status(), body: (await res.json().catch(() => null)) as any }
}
const proData = (name: string) => ({
  name, specialty: 'Hair', tagline: 'Técnica.', experienceYears: 5, instagramHandle: '@e2e', instagramFollowers: '1 mil',
  instagramUrl: 'https://instagram.com/e2e', portraitSrc: '/site/profissional/lukas_perfil.png', cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: ['Trajetória.'], works: [],
})
const login = async (p: Page, email: string, password: string) => {
  await p.goto(`${BASE}/admin/login`)
  await p.getByLabel('E-mail').fill(email)
  await p.getByLabel('Senha').fill(password)
  await p.getByRole('button', { name: 'Entrar' }).click()
  await p.waitForURL(/\/admin(?!\/login)/)
}
const today = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)

let proId = 0
let otherId = 0
let courseId = 0
let userId = 0

try {
  await step('login; cria dois profissionais e um curso publicados (via API)', async () => {
    await login(page, EMAIL, PASSWORD)
    const pro = await send(admin, 'post', '/admin/professionals', { slug: PRO.slug, data: proData(PRO.name) })
    assert.equal(pro.status, 201, JSON.stringify(pro.body))
    proId = pro.body.id
    assert.equal((await send(admin, 'post', `/admin/professionals/${proId}/publish`)).status, 200)
    const other = await send(admin, 'post', '/admin/professionals', { slug: OTHER.slug, data: proData(OTHER.name) })
    otherId = other.body.id
    assert.equal((await send(admin, 'post', `/admin/professionals/${otherId}/publish`)).status, 200)
    const c = await send(admin, 'post', '/admin/courses', {
      professionalId: proId, slug: COURSE.slug,
      data: { title: COURSE.title, lead: 'Descrição.', coverSrc: '/site/curso/produto-morena-iluminada.svg', coverAlt: 'Capa', benefits: [{ title: 'B', text: 'T' }], modules: [{ title: 'M', text: '', bullets: [] }], deliverables: [{ title: 'D', text: 'T' }] },
    })
    assert.equal(c.status, 201, JSON.stringify(c.body))
    courseId = c.body.id
    assert.equal((await send(admin, 'put', `/admin/courses/${courseId}/commercial`, { listCents: 10000, discountPct: 0, maxInstallments: 1, checkoutUrl: `https://pay.example.com/${stamp}`, environment: 'production', active: true, revision: 0 })).status, 200)
    assert.equal((await send(admin, 'post', `/admin/courses/${courseId}/publish`)).status, 200)
  })

  await step('visitar a página do curso registra a visita e o tempo com a página visível', async () => {
    // O rastreador descarta robôs ("HeadlessChrome" incluso): o visitante se identifica como um Chrome comum.
    const visitor = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    })
    const v = await visitor.newPage()
    await v.goto(`${BASE}/cursos/${COURSE.slug}`)
    await v.locator('h1.hero-title').waitFor()
    // O rastreador envia o tempo visível a cada 15 s (além de ao ocultar/sair; o envio da saída o Chrome de teste descarta).
    await v.waitForTimeout(16_500)
    await visitor.close()
  })

  await step('Insights (admin): funil e tabela do curso, com tempo médio; filtros por profissional, curso e aparelho', async () => {
    let body: any = null
    for (let i = 0; i < 20 && !(body?.totals?.views && body?.totals?.timeMs); i += 1) {
      body = (await send(admin, 'get', `/admin/insights?from=${today}&to=${today}&professionalId=${proId}`)).body
      if (!(body?.totals?.views && body?.totals?.timeMs)) await page.waitForTimeout(500)
    }
    assert.ok(body.totals.views >= 1, 'visita registrada')
    assert.ok(body.totals.timeMs >= 1000, 'tempo na página registrado')
    await page.goto(`${BASE}/admin/insights?days=7`)
    await page.locator('.kpi-grid').waitFor()
    await page.locator('.ins-filters .pf-chip', { hasText: PRO.name }).click()
    await page.waitForURL(new RegExp(`professionalId=${proId}`))
    const row = page.locator('.ins-table tbody tr', { hasText: COURSE.title })
    await row.waitFor()
    assert.match(await row.innerText(), /\d+s|\dmin/, 'tempo médio na linha do curso')
    await page.getByRole('group', { name: 'Curso' }).getByRole('button', { name: COURSE.title }).click()
    await page.waitForURL(new RegExp(`courseId=${courseId}`))
    await page.getByRole('group', { name: 'Aparelho' }).getByRole('button', { name: 'Celular' }).click()
    await page.waitForURL(/device=mobile/)
    await page.getByRole('note').filter({ hasText: 'não seguem o filtro de aparelho' }).waitFor()
  })

  await step('login de profissional: entra direto nos Insights, vê só os próprios cursos e nada mais do painel', async () => {
    const created = await send(admin, 'post', '/admin/users', { email: `e2e-ins-${stamp}@local.test`, fullName: PRO.name, role: 'professional', professionalId: proId })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    userId = created.body.user.id
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const p = await ctx.newPage()
    watch(p)
    await login(p, `e2e-ins-${stamp}@local.test`, created.body.temporaryPassword)
    const newPass = `Painel-Seguro-${stamp}-Forte!` // sem nome nem e-mail (política de senha)
    assert.equal((await send(ctx, 'post', '/auth/password', { currentPassword: created.body.temporaryPassword, newPassword: newPass })).status, 204)
    await p.goto(`${BASE}/admin`)
    await p.waitForURL('**/admin/insights')
    assert.deepEqual(await p.locator('.admin-nav a').allInnerTexts(), ['Insights'])
    assert.equal(await p.locator('.ins-filters .pf-chip').count(), 0, 'sem filtro de profissional')
    await p.locator('.ins-table tbody tr', { hasText: COURSE.title }).waitFor()
    const forced = await send(ctx, 'get', `/admin/insights?from=${today}&to=${today}&professionalId=${otherId}`)
    assert.equal(forced.body.scope.professionalId, proId, 'outro profissional é ignorado')
    assert.equal((await send(ctx, 'get', '/admin/dashboard')).status, 403)
    assert.equal((await send(ctx, 'get', '/admin/courses')).status, 403)
    assert.equal((await send(ctx, 'get', '/admin/users')).status, 403)
    await ctx.close()
  })

  await step('390px: Insights sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/admin/insights`)
    await page.locator('.kpi-grid').waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'overflow em 390px')
  })

  await step('sem erros de console', async () => {
    assert.deepEqual(consoleErrors.filter((e) => !/status of 4\d\d|Failed to load resource/.test(e)), [])
  })

  console.log(results.join('\n'))
  console.log(`\n${results.length} verificações passaram.`)
} catch (error) {
  console.log(results.join('\n'))
  console.error('\nFALHOU:', error)
  console.error('Erros de console até aqui:', consoleErrors)
  process.exitCode = 1
} finally {
  try {
    if (userId) await send(admin, 'put', `/admin/users/${userId}`, { isActive: false })
    if (courseId) { await send(admin, 'post', `/admin/courses/${courseId}/unpublish`); await send(admin, 'delete', `/admin/courses/${courseId}`) }
    for (const id of [proId, otherId].filter(Boolean)) { await send(admin, 'post', `/admin/professionals/${id}/unpublish`); await send(admin, 'delete', `/admin/professionals/${id}`) }
  } catch (error) {
    console.error('limpeza falhou:', error)
  }
  await browser.close()
}
