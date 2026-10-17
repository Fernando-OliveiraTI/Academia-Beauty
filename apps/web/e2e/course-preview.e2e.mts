/**
 * E2E das interações do template Curso Original (/preview/curso). Requer o web em execução (3100); não usa a API.
 * Uso: pnpm e2e:course
 */
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const URL_ = `${BASE}/preview/curso`

const browser = await chromium.launch({ channel: 'chrome' })
const results: string[] = []
const step = async (name: string, fn: () => Promise<void>) => { await fn(); results.push(`✓ ${name}`) }

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await desktop.newPage()
  const problems: string[] = []
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`) })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  const requests: string[] = []
  page.on('request', (r) => { if (r.method() !== 'GET') requests.push(`${r.method()} ${r.url()}`) })

  await page.goto(URL_, { waitUntil: 'networkidle' })

  await step('renderiza o h1 e os preços vindos da oferta', async () => {
    await page.getByRole('heading', { level: 1, name: 'Morena Iluminada.' }).waitFor()
    assert.equal(await page.locator('.price-now').first().textContent(), 'R$ 175,00')
    assert.equal(await page.locator('.price-installments').first().textContent(), 'ou 6x de R$ 29,17 sem juros')
  })

  await step('Geist hospedada carrega (sem Google Fonts)', async () => {
    const families = await page.evaluate(() => Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family))
    assert.ok(families.some((f) => f.includes('Geist')), `fontes carregadas: ${families.join(',')}`)
  })

  await step('header ganha is-scrolled e a barra de progresso avança ao rolar', async () => {
    assert.equal(await page.locator('#header.is-scrolled').count(), 0)
    await page.evaluate(() => window.scrollTo(0, 1500))
    await page.waitForFunction(() => document.getElementById('header')?.classList.contains('is-scrolled'))
    const progress = await page.evaluate(() => getComputedStyle(document.querySelector('.scroll-progress')!).getPropertyValue('--progress'))
    assert.ok(Number(progress) > 0, `progress=${progress}`)
  })

  await step('scroll-spy destaca o link da seção visível', async () => {
    await page.evaluate(() => document.getElementById('conteudo')!.scrollIntoView({ behavior: 'instant' }))
    await page.waitForSelector('.nav a.is-active[href="#conteudo"]')
  })

  await step('accordion: um aberto por vez, aria-expanded coerente', async () => {
    const first = page.locator('#mod-1-btn')
    const second = page.locator('#mod-2-btn')
    assert.equal(await first.getAttribute('aria-expanded'), 'true')
    await second.click()
    assert.equal(await first.getAttribute('aria-expanded'), 'false')
    assert.equal(await second.getAttribute('aria-expanded'), 'true')
    await second.click()
    assert.equal(await second.getAttribute('aria-expanded'), 'false')
  })

  await step('contador da prova social termina no valor formatado', async () => {
    await page.evaluate(() => document.getElementById('depoimentos')!.scrollIntoView({ behavior: 'instant' }))
    await page.waitForFunction(() => document.querySelectorAll('[data-count]')[1]?.textContent === '53,6 mil', undefined, { timeout: 4000 })
  })

  await step('CTA rola até o checkout e foca o nome', async () => {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.locator('#hero-cta').click()
    await page.waitForFunction(() => document.activeElement?.id === 'name', undefined, { timeout: 4000 })
  })

  await step('checkout etapa 1: validação, máscara e avanço', async () => {
    await page.getByRole('button', { name: /Continuar para o pagamento/ }).click()
    await page.getByRole('alert').filter({ hasText: 'Faltam ajustar 4 campos para continuar.' }).waitFor()
    await page.getByLabel('Nome completo').fill('Maria Souza')
    await page.getByLabel('E-mail').fill('maria@email.com')
    await page.getByLabel(/CPF/).fill('')
    await page.getByLabel(/CPF/).pressSequentially('52998224725')
    assert.equal(await page.getByLabel(/CPF/).inputValue(), '529.982.247-25')
    await page.getByLabel('Celular com DDD').pressSequentially('11987654321')
    assert.equal(await page.getByLabel('Celular com DDD').inputValue(), '(11) 98765-4321')
    await page.getByLabel('Celular com DDD').press('Enter') // Enter avança, não envia
    await page.getByText('Quase lá, Maria. Escolha como prefere pagar.').waitFor()
    assert.equal(await page.locator('.step.is-active b').textContent(), '2')
  })

  await step('etapa 2: troca de método e finalizar não envia nada', async () => {
    await page.locator('label[for="m-pix"]').click()
    await page.locator('.method-panel:not([hidden]) .info-box').getByText('QR Code PIX').waitFor()
    assert.equal(await page.locator('.summary-total-sub').textContent(), 'à vista no PIX')
    await page.getByRole('button', { name: /Finalizar compra/ }).click()
    await page.getByRole('alert').filter({ hasText: 'O pagamento ainda não está disponível' }).waitFor()
    assert.deepEqual(requests, [], `requisições não-GET: ${requests.join(' | ')}`)
    await page.getByRole('button', { name: 'Voltar e editar meus dados' }).click()
    await page.waitForFunction(() => document.activeElement?.id === 'name')
  })

  await step('sem erros nem avisos de console (hidratação inclusa)', async () => {
    assert.deepEqual(problems, [])
  })

  // Mobile: sticky CTA e resumo recolhível
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const m = await mobile.newPage()
  const mobileProblems: string[] = []
  m.on('console', (x) => { if (['error', 'warning'].includes(x.type())) mobileProblems.push(x.text()) })
  await m.goto(URL_, { waitUntil: 'networkidle' })

  await step('mobile: CTA fixo oculto no hero, visível depois e oculto no checkout', async () => {
    assert.equal(await m.locator('#sticky-cta').getAttribute('aria-hidden'), 'true')
    await m.evaluate(() => document.getElementById('beneficios')!.scrollIntoView({ behavior: 'instant' }))
    await m.waitForSelector('#sticky-cta.is-visible')
    assert.equal(await m.locator('#sticky-cta a').getAttribute('tabindex'), '0')
    await m.evaluate(() => document.getElementById('checkout')!.scrollIntoView({ behavior: 'instant' }))
    await m.waitForFunction(() => !document.getElementById('sticky-cta')!.classList.contains('is-visible'))
  })

  await step('mobile: resumo do pedido recolhível', async () => {
    const toggle = m.locator('.summary-toggle')
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
    await toggle.click()
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
    await m.locator('#summary-body').waitFor({ state: 'visible' })
  })

  await step('mobile: sem erros de console e sem overflow horizontal', async () => {
    assert.deepEqual(mobileProblems, [])
    assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  })

  // Reduced motion: nada fica escondido
  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const r = await reduced.newPage()
  await r.goto(URL_, { waitUntil: 'networkidle' })
  await step('reduced-motion: nenhum .reveal fica pendente e contadores mostram o valor final', async () => {
    assert.equal(await r.locator('.reveal.is-pending').count(), 0)
    assert.equal(await r.locator('[data-count]').nth(1).textContent(), '53,6 mil')
  })

  console.log(results.join('\n'))
  console.log(`\n${results.length} verificações passaram.`)
} finally {
  await browser.close()
}
