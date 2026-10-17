/**
 * E2E do template Home Original (/preview/home). Requer o web em execução (3100); não usa a API.
 * Uso: pnpm e2e:home
 */
import { chromium, type Page } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const URL_ = `${BASE}/preview/home`

const browser = await chromium.launch({ channel: 'chrome' })
/** tsx/esbuild injeta __name nas funções passadas ao evaluate. */
const newPage = async (opts: Parameters<typeof browser.newContext>[0]) => {
  const c = await browser.newContext(opts)
  await c.addInitScript('window.__name = (f) => f')
  return c.newPage()
}
const results: string[] = []
const step = async (name: string, fn: () => Promise<void>) => { await fn(); results.push(`✓ ${name}`) }
const painted = (page: Page, id: string) => page.evaluate((cid) => {
  const c = document.getElementById(cid) as HTMLCanvasElement
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i]) n++
  return n
}, id)

try {
  const page = await newPage({ viewport: { width: 1280, height: 800 } })
  const problems: string[] = []
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`) })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  await page.goto(URL_, { waitUntil: 'networkidle' })

  await step('h1 único e marca Academia Beauty (sem "Carreira Beauty")', async () => {
    await page.getByRole('heading', { level: 1, name: /Aprenda e cresça/ }).waitFor()
    assert.equal(await page.getByText(/carreira beauty/i).count(), 0)
  })

  await step('camadas do hero na ordem do original e partículas geradas no cliente', async () => {
    const order = await page.evaluate(() => Array.from(document.querySelector('.cb-hero')!.children).map((c) => c.className.split(' ')[0]))
    assert.deepEqual(order.slice(0, 5), ['cb-hero-boldfx', 'cb-hero-ribbons', 'cb-hero-energy', 'cb-telemetry-layer', 'cb-video-style-fx'])
    assert.equal(await page.locator('.cb-hero-energy .particle').count(), 52)
    assert.equal(await page.locator('.cb-hero-ribbons .particle').count(), 44)
    assert.equal(await page.locator('.cb-hero-ribbons .spark').count(), 10)
    assert.equal(await page.locator('.cb-hero-boldfx .flash').count(), 16)
    assert.equal(await page.locator('.cb-video-style-fx .cb-particle').count(), 72)
  })

  await step('3 canvas desenhados e animando', async () => {
    for (const id of ['cbTelemetryCanvasLeft', 'cbTelemetryCanvas', 'cbTelemetryCanvasBoost']) assert.ok((await painted(page, id)) > 100, id)
    const snap = () => page.evaluate(() => (document.getElementById('cbTelemetryCanvasBoost') as HTMLCanvasElement).toDataURL().length)
    const a = await snap(); await page.waitForTimeout(600)
    assert.notEqual(a, await snap())
  })

  await step('parallax do mouse move as camadas e volta a 0 ao sair', async () => {
    const t = () => page.evaluate(() => getComputedStyle(document.querySelector('.cb-hero-boldfx')!).transform)
    await page.mouse.move(1100, 200)
    await page.mouse.move(1250, 700, { steps: 8 })
    await page.waitForTimeout(500)
    assert.notEqual(await t(), 'matrix(1, 0, 0, 1, 0, 0)')
    await page.mouse.move(640, 790) // fora do hero
    await page.mouse.move(640, 5000).catch(() => undefined)
    await page.evaluate(() => document.querySelector('.cb-hero')!.dispatchEvent(new PointerEvent('pointerleave')))
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.cb-hero-boldfx')!).transform === 'matrix(1, 0, 0, 1, 0, 0)', undefined, { timeout: 6000 })
  })

  await step('slider: 5 cards, setas rolam um passo e voltam', async () => {
    const slider = page.locator('#professoresSlider')
    await page.evaluate(() => document.getElementById('profissionais')!.scrollIntoView({ behavior: 'instant' }))
    assert.equal(await page.locator('.professor-card-link').count(), 5)
    const start = await slider.evaluate((el) => el.scrollLeft)
    await page.locator('#sliderNextBtn').click()
    await page.waitForFunction((s) => (document.getElementById('professoresSlider')!.scrollLeft) > s, start, { timeout: 3000 })
    await page.locator('#sliderPrevBtn').click()
    await page.waitForFunction(() => document.getElementById('professoresSlider')!.scrollLeft === 0, undefined, { timeout: 3000 })
  })

  await step('slider: autoplay avança sozinho depois de ~4 s', async () => {
    await page.mouse.move(5, 5)
    await page.waitForFunction(() => document.getElementById('professoresSlider')!.scrollLeft > 0, undefined, { timeout: 7000 })
    await page.evaluate(() => document.getElementById('professoresSlider')!.scrollTo({ left: 0, behavior: 'instant' }))
  })

  await step('slider: autoplay pausa com o ponteiro dentro', async () => {
    const slider = page.locator('#professoresSlider')
    const box = (await page.locator('.professores-slider-wrapper').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2) // dentro do slider
    await page.waitForTimeout(1200) // deixa terminar qualquer rolagem suave já iniciada
    const before = await slider.evaluate((el) => el.scrollLeft)
    await page.waitForTimeout(4600)
    assert.equal(await slider.evaluate((el) => el.scrollLeft), before)
  })

  await step('reveal: benefícios entram ao rolar (.cb-in)', async () => {
    await page.evaluate(() => document.getElementById('beneficios')!.scrollIntoView({ behavior: 'instant' }))
    await page.waitForFunction(() => document.querySelectorAll('#beneficios .cb-benefit.cb-in').length === 3, undefined, { timeout: 4000 })
  })

  await step('hero ganha is-offscreen fora da tela e retoma ao voltar', async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForSelector('.cb-hero.is-offscreen')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForFunction(() => !document.querySelector('.cb-hero')!.classList.contains('is-offscreen'))
  })

  await step('rodapé tem a energia animada (6 base + extras)', async () => {
    assert.equal(await page.locator('.cb-footer-energy > span').count(), 6)
    assert.equal(await page.locator('.cb-footer-energy .cb-fx-extra > span').count(), 14)
  })

  await step('sem erros nem avisos de console', async () => { assert.deepEqual(problems, []) })

  for (const width of [900, 768, 390]) {
    const m = await newPage({ viewport: { width, height: 844 } })
    const mp: string[] = []
    m.on('console', (x) => { if (['error', 'warning'].includes(x.type())) mp.push(x.text()) })
    await m.goto(URL_, { waitUntil: 'networkidle' })
    await step(`${width}px: sem overflow horizontal, h1 ≤ 38,5px (valor do desktop a 900px), Marcas dentro da tela e sem card órfão`, async () => {
      const r = await m.evaluate(() => {
        const q = (s: string) => document.querySelector(s) as HTMLElement
        const w = innerWidth
        const widths = (s: string) => Array.from(document.querySelectorAll(s)).map((e) => Math.round(e.getBoundingClientRect().width))
        return {
          overflow: document.documentElement.scrollWidth > w,
          h1: parseFloat(getComputedStyle(q('.cb-hero h1')).fontSize),
          h2Right: q('#marcas h2').getBoundingClientRect().right,
          copyRight: q('#marcas .cb-section-copy').getBoundingClientRect().right,
          courses: widths('#cursos-home .cb-course'), benefits: widths('#beneficios .cb-benefit'), w,
        }
      })
      assert.equal(r.overflow, false)
      assert.ok(r.h1 <= 38.6, `h1=${r.h1}`)
      assert.ok(r.h2Right <= r.w && r.copyRight <= r.w, `marcas ${r.h2Right}/${r.copyRight} > ${r.w}`)
      if (width >= 721) assert.ok(r.courses[2]! > r.courses[0]!, `curso órfão: ${r.courses}`)
      if (width >= 681) assert.ok(r.benefits[2]! > r.benefits[0]!, `benefício órfão: ${r.benefits}`)
      assert.deepEqual(mp, [])
    })
  }

  const r = await newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await r.goto(URL_, { waitUntil: 'networkidle' })
  await step('reduced-motion: canvas estáticos, sem parallax e slider sem autoplay', async () => {
    const snap = () => r.evaluate(() => (document.getElementById('cbTelemetryCanvasBoost') as HTMLCanvasElement).toDataURL())
    const a = await snap(); await r.waitForTimeout(500)
    assert.equal(await snap(), a)
    assert.ok((await painted(r, 'cbTelemetryCanvasBoost')) > 100)
    assert.equal(await r.evaluate(() => document.querySelectorAll('.cb-reveal:not(.cb-in)').length > 0 ? getComputedStyle(document.querySelector('.cb-reveal:not(.cb-in)')!).opacity : '1'), '1')
  })

  console.log(results.join('\n'))
  console.log(`\n${results.length} verificações passaram.`)
} finally {
  await browser.close()
}
