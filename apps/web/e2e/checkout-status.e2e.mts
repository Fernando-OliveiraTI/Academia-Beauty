/**
 * E2E da confirmação de pagamento na página pública do curso (checkout embutido da The Members): abre a página, lê o
 * código da visita na URL do iframe, "dispara" o webhook assinado e confere o aviso de espera (Pix) e a tela de sucesso.
 * Cria profissional/curso `e2e-pagto-*` e os arquiva no fim.
 * Requer API (3333) com `THEMEMBERS_WEBHOOK_SECRET` igual a `E2E_WEBHOOK_SECRET` e `PUBLIC_SHOW_DRAFTS=false`, e o build do web (3100).
 * Uso: E2E_WEBHOOK_SECRET=... E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web e2e:checkout-status
 */
import { chromium, type BrowserContext } from 'playwright-core'
import { createHmac } from 'node:crypto'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
const SECRET = process.env.E2E_WEBHOOK_SECRET ?? ''
assert.ok(EMAIL && PASSWORD && SECRET, 'Defina E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD e E2E_WEBHOOK_SECRET (o mesmo THEMEMBERS_WEBHOOK_SECRET da API)')

const stamp = Date.now().toString(36)
const PRODUCT = String(700000 + Math.floor(Math.random() * 99999))
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const consoleErrors: string[] = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
const results: string[] = []
const step = async (name: string, fn: () => Promise<void>) => { await fn(); results.push(`✓ ${name}`) }

const xsrf = async (c: BrowserContext) => decodeURIComponent((await c.cookies()).find((x) => x.name === 'XSRF-TOKEN')?.value ?? '')
const send = async (m: 'get' | 'post' | 'put', p: string, d?: unknown) => {
  const r = await context.request[m](`${BASE}/api${p}`, { headers: { 'x-xsrf-token': await xsrf(context) }, data: d })
  return { status: r.status(), body: (await r.json().catch(() => null)) as any }
}
const webhook = async (event: string, status: string, ref: string | null, txId: string, when: string, method = 'pix') => {
  const body = JSON.stringify({
    company: { id: 'c', name: 'Empresa', document_number: '1', owner: { id: 'o', name: 'D', email: 'd@x.com' } },
    payload: { object: 'transaction', event, created_at: when, data: { id: txId, paid_at: when, status, transaction: { currency: 'brl', amount: 29700, buyer_fees: 0, total_amount: 29700, cupom: null },
      payment_details: { payment_method: method, credit_card: null, pix: method === 'pix' ? { qrcode_url: 'u', qrcode_data: 'd', expiration: 1 } : null, boleto: null }, comissions: [],
      order: { id: '1', customer: { id: 'u', name: 'Maria Souza', email: 'maria@exemplo.com', document_number: '52998224725' }, main_product: { id: Number(PRODUCT), title: 'Curso', price: 29700 }, order_bump: [], utms: ref ? [{ utm_source: 'academia', utm_content: ref }] : [] }, subscription: null } },
  })
  const res = await fetch(`${BASE}/api/webhooks/themembers`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': createHmac('sha256', SECRET).update(body).digest('hex') }, body })
  assert.equal(res.status, 200, `webhook ${event}: ${await res.text()}`)
}

const SLUG = `e2e-pagto-c-${stamp}`
let proId = 0
let courseId = 0
try {
  await step('login; cria curso publicado com checkout da The Members (iframe) e ID do produto', async () => {
    await page.goto(`${BASE}/admin/login`)
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/admin`)
    const pro = await send('post', '/admin/professionals', { slug: `e2e-pagto-${stamp}`, data: { name: 'Pagto E2e', specialty: 'Hair', tagline: 'T.', experienceYears: 1, instagramHandle: '@e', instagramFollowers: '1', instagramUrl: 'https://instagram.com/e', portraitSrc: '/site/profissional/lukas_perfil.png', cardPhotoSrc: '/site/home/lukas-campos.png', bio: ['B.'], works: [] } })
    proId = pro.body.id
    assert.equal((await send('post', `/admin/professionals/${proId}/publish`)).status, 200)
    const course = await send('post', '/admin/courses', { professionalId: proId, slug: SLUG, data: { title: 'Curso Pagamento', lead: 'L.', modality: 'online', level: 'profissional', workloadHours: 1, audience: 'A', coverSrc: '/site/curso/produto-morena-iluminada.svg', coverAlt: 'c', benefits: [{ title: 'b', text: 't' }], modules: [{ title: 'm', text: 't', bullets: [] }], deliverables: [{ title: 'd', text: 't' }], faq: [], testimonials: [], guaranteeDays: null } })
    courseId = course.body.id
    assert.equal((await send('put', `/admin/courses/${courseId}/commercial`, { listCents: 29700, discountPct: 0, maxInstallments: 6, checkoutUrl: 'https://pay.example.com/c/1?cupom=ABC', environment: 'production', active: true, revision: 0, provider: 'themembers', externalCourseId: PRODUCT })).status, 200)
    assert.equal((await send('post', `/admin/courses/${courseId}/publish`)).status, 200)
  })

  let ref = ''
  await step('a página pública põe o código da visita (ab_…) na URL do iframe, mantendo os parâmetros do link', async () => {
    await page.goto(`${BASE}/cursos/${SLUG}`, { waitUntil: 'networkidle' })
    await page.locator('#checkout').scrollIntoViewIfNeeded()
    const frame = page.locator('#checkout iframe')
    await frame.waitFor({ state: 'attached', timeout: 15_000 })
    const src = new URL((await frame.getAttribute('src'))!)
    ref = src.searchParams.get('utm_content') ?? ''
    assert.match(ref, /^ab_[a-z0-9]{20}$/)
    assert.equal(src.searchParams.get('cupom'), 'ABC')
    assert.equal(src.host, 'pay.example.com')
    assert.equal(await page.evaluate(() => sessionStorage.getItem('ab:checkout-ref')), ref)
  })

  await step('webhook de outra visita não muda esta página; Pix gerado desta visita mostra o aviso de espera (iframe fica)', async () => {
    await webhook('transaction.approved', 'approved', 'ab_zzzzzzzzzzzzzzzzzzzz', '8001', '2026-10-19 09:00:00')
    await page.waitForTimeout(5000)
    assert.equal(await page.locator('.pay-result').count(), 0, 'pagamento de outra visita não confirma esta')
    await webhook('transaction.pix_generated', 'pending', ref, '8002', '2026-10-19 10:00:00')
    await page.locator('.pay-notice[data-state="waiting"]').waitFor({ timeout: 15_000 })
    assert.match(await page.locator('.pay-notice').innerText(), /Pix/)
    assert.equal(await page.locator('#checkout iframe').count(), 1)
  })

  await step('aprovado: a página troca o iframe pela confirmação, sem recarregar, e para de consultar', async () => {
    await webhook('transaction.approved', 'approved', ref, '8002', '2026-10-19 10:03:00')
    await page.locator('.pay-result[data-state="paid"]').waitFor({ timeout: 15_000 })
    assert.match(await page.locator('.pay-result').innerText(), /Pagamento confirmado!/)
    assert.equal(await page.locator('#checkout iframe').count(), 0)
    await page.locator('.pay-result').screenshot({ path: '/tmp/pay-success.png' })
    let calls = 0
    page.on('request', (r) => { if (r.url().includes('/public/checkout-status')) calls++ })
    await page.waitForTimeout(9000)
    assert.equal(calls, 0, 'depois de aprovado não consulta mais')
  })

  await step('recarregar a aba mantém o código e a página volta direto para "pagamento confirmado"', async () => {
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('#checkout').scrollIntoViewIfNeeded()
    await page.locator('.pay-result[data-state="paid"]').waitFor({ timeout: 15_000 })
    assert.equal(await page.evaluate(() => sessionStorage.getItem('ab:checkout-ref')), ref)
  })

  await step('uma aba nova (outra visita) não vê o pagamento e recebe um código diferente', async () => {
    const other = await (await browser.newContext()).newPage()
    await other.goto(`${BASE}/cursos/${SLUG}`, { waitUntil: 'networkidle' })
    await other.locator('#checkout').scrollIntoViewIfNeeded()
    await other.locator('#checkout iframe').waitFor({ state: 'attached', timeout: 15_000 })
    const otherRef = new URL((await other.locator('#checkout iframe').getAttribute('src'))!).searchParams.get('utm_content')
    assert.notEqual(otherRef, ref)
    await other.waitForTimeout(5000)
    assert.equal(await other.locator('.pay-result').count(), 0)
    await other.context().close()
  })

  await step('a resposta pública da consulta tem só situação e forma de pagamento', async () => {
    const res = await fetch(`${BASE}/api/public/checkout-status?ref=${ref}`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    const body = await res.json() as Record<string, unknown>
    assert.deepEqual(Object.keys(body).sort(), ['method', 'status'])
    assert.equal(body.status, 'approved')
    assert.equal((await fetch(`${BASE}/api/public/checkout-status?ref=invalido`)).status, 400)
  })

  await step('o painel do curso mostra os mesmos pagamentos (para a equipe)', async () => {
    const panel = await send('get', `/admin/courses/${courseId}/payments`)
    assert.equal(panel.status, 200)
    assert.equal(panel.body.summary.approved, 2)
  })

  await step('sem erros de console na página pública (além dos do iframe externo)', async () => {
    const own = consoleErrors.filter((e) => !/pay\.example\.com|ERR_NAME_NOT_RESOLVED|Failed to load resource/.test(e))
    assert.deepEqual(own, [])
  })
} catch (error) {
  console.error('FALHA:', error)
  console.log(results.join('\n'))
  process.exitCode = 1
} finally {
  if (courseId) { await send('post', `/admin/courses/${courseId}/unpublish`); await send('post', `/admin/courses/${courseId}/archive`) }
  if (proId) { await send('post', `/admin/professionals/${proId}/unpublish`); await send('post', `/admin/professionals/${proId}/archive`) }
  await browser.close()
}
console.log(results.join('\n'))
