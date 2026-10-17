/**
 * E2E do template Profissional Original (/preview/profissional). Requer o web em execução (3100); não usa a API.
 * Uso: pnpm e2e:professional
 */
import { chromium, type Page } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const URL_ = `${BASE}/preview/profissional`

const browser = await chromium.launch({ channel: 'chrome' })
const results: string[] = []
const step = async (name: string, fn: () => Promise<void>) => { await fn(); results.push(`✓ ${name}`) }

/** Conta pixels não transparentes de um canvas (garante que a camada desenhou algo). */
const paintedPixels = (page: Page, id: string) => page.evaluate((cid) => {
  const c = document.getElementById(cid) as HTMLCanvasElement
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i]) n++
  return n
}, id)

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const problems: string[] = []
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`) })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  await page.goto(URL_, { waitUntil: 'networkidle' })

  await step('hero, marca Academia Beauty e fontes hospedadas', async () => {
    await page.getByRole('heading', { level: 1 }).waitFor()
    assert.match((await page.locator('.cb-brand').textContent()) ?? '', /ACADEMIA\s*BEAUTY/)
    assert.equal(await page.getByText(/carreira beauty/i).count(), 0)
    const families = await page.evaluate(() => Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family))
    assert.ok(families.some((f) => f.includes('Geist')) && families.some((f) => f.includes('JetBrains')), families.join(','))
  })

  await step('3 canvas na ordem do original, dimensionados e com conteúdo desenhado', async () => {
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll('.cb-telemetry-layer canvas')).map((c) => c.id))
    assert.deepEqual(ids, ['cbTelemetryCanvasLeft', 'cbTelemetryCanvas', 'cbTelemetryCanvasBoost'])
    for (const id of ids) assert.ok((await paintedPixels(page, id)) > 100, `${id} vazio`)
  })

  await step('72 partículas CSS geradas no cliente (a cada 10ª é big)', async () => {
    assert.equal(await page.locator('.cb-particle').count(), 72)
    assert.equal(await page.locator('.cb-particle.big').count(), 8)
  })

  await step('canvas animam (o boost não para mais após o 1º quadro)', async () => {
    const snap = () => page.evaluate(() => (document.getElementById('cbTelemetryCanvasBoost') as HTMLCanvasElement).toDataURL().length)
    const a = await snap()
    await page.waitForTimeout(600)
    const b = await snap()
    assert.notEqual(a, b, 'o canvas boost não mudou entre quadros')
  })

  await step('reveal: elementos entram em cascata e recebem .in', async () => {
    await page.evaluate(() => document.getElementById('trabalhos')!.scrollIntoView({ behavior: 'instant' }))
    await page.waitForFunction(() => document.querySelectorAll('.cb-courses .cb-course.in').length === 3, undefined, { timeout: 4000 })
  })

  await step('pausa fora da viewport: hero ganha is-offscreen e volta ao rolar para o topo', async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForSelector('.profile-hero.is-offscreen')
    const state = await page.evaluate(() => getComputedStyle(document.querySelector('.cb-grid-floor')!).animationPlayState)
    assert.equal(state, 'paused')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForFunction(() => !document.querySelector('.profile-hero')!.classList.contains('is-offscreen'))
  })

  await step('vídeo: controles, sem autoplay e preload=metadata', async () => {
    const v = page.locator('video')
    assert.equal(await v.getAttribute('controls'), '')
    assert.equal(await v.evaluate((el) => (el as HTMLVideoElement).autoplay), false)
    assert.equal(await v.getAttribute('preload'), 'metadata')
  })

  await step('link do curso aponta para a rota do curso (não para a loja Shopify)', async () => {
    assert.equal(await page.locator('.course-card').getAttribute('href'), '/preview/curso')
  })

  await step('sem erros nem avisos de console (o original lançava ReferenceError no canvas boost)', async () => {
    assert.deepEqual(problems, [])
  })

  // Mobile
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  const mp: string[] = []
  m.on('console', (x) => { if (['error', 'warning'].includes(x.type())) mp.push(x.text()) })
  await m.goto(URL_, { waitUntil: 'networkidle' })
  await step('mobile: sem overflow horizontal, HUD oculto (≤620px) e sem erros', async () => {
    assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
    assert.equal(await m.locator('.hero-hud').isVisible(), false)
    assert.deepEqual(mp, [])
  })

  // Reduced motion
  const r = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage()
  await r.goto(URL_, { waitUntil: 'networkidle' })
  await step('reduced-motion: ticker parado, canvas desenhados uma única vez', async () => {
    assert.equal(await r.evaluate(() => getComputedStyle(document.querySelector('.bio-bg')!).animationName), 'none')
    const snap = () => r.evaluate(() => (document.getElementById('cbTelemetryCanvasBoost') as HTMLCanvasElement).toDataURL())
    const a = await snap()
    await r.waitForTimeout(500)
    assert.equal(await snap(), a)
    assert.ok((await paintedPixels(r, 'cbTelemetryCanvasBoost')) > 100)
  })

  console.log(results.join('\n'))
  console.log(`\n${results.length} verificações passaram.`)
} finally {
  await browser.close()
}
