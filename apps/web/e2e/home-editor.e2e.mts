/**
 * E2E do CMS da Home (Fase 7B): editor da Home com pré-visualização ao vivo e autosave, regras das seções
 * automáticas, publicar → `/` muda na hora, histórico e restauração, e a vitrine de cursos dinâmica
 * (curso publicado aparece na Home com link que funciona; despublicado some). Ao final volta a Home ao padrão.
 * Cria um profissional e um curso `e2e-home-*` (arquivados no fim).
 * Requer API (3333) migrada e o build de produção do web (3100).
 * Uso: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web e2e:home-editor
 */
import { chromium, type Page } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
assert.ok(EMAIL && PASSWORD, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD')

const stamp = Date.now().toString(36)
const KICKER = `Home editada pelo E2E ${stamp}`
const PROF_SLUG = `e2e-home-prof-${stamp}`
const COURSE_SLUG = `e2e-home-curso-${stamp}`
const COURSE_TITLE = `Curso Home E2E ${stamp}`

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const consoleErrors: string[] = []
const watch = (p: Page) => {
  p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${m.type()}: ${m.text()}`) })
  p.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
}
watch(page)
const results: string[] = []
const step = async (name: string, fn: () => Promise<void>) => { await fn(); results.push(`✓ ${name}`) }

const xsrf = async () => decodeURIComponent((await context.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? '')
const send = async (method: 'post' | 'put' | 'delete', path: string, data?: unknown) => {
  const res = await context.request[method](`${BASE}/api${path}`, { headers: { 'x-xsrf-token': await xsrf() }, data })
  return { status: res.status(), body: await res.json().catch(() => null) as any }
}
const get = async (path: string) => {
  const res = await context.request.get(`${BASE}/api${path}`)
  return { status: res.status(), body: await res.json().catch(() => null) as any }
}
const saved = (p: Page) => p.getByRole('status').filter({ hasText: 'Salvo' }).waitFor({ timeout: 10_000 })
const frame = (p: Page) => p.frameLocator('iframe[title="Pré-visualização da página"]')
const treeNames = (p: Page) => p.locator('.ed-item .ed-name').allTextContents()
const menu = async (p: Page, item: string) => { await p.getByRole('button', { name: 'Mais ações' }).click(); await p.getByRole('menuitem', { name: item }).click() }
/** Seleciona a seção na lista e abre a aba Avançado (mover/remover moram lá). */
const advanced = async (p: Page, section: string) => {
  await p.locator('.ed-item').filter({ has: p.locator('.ed-name', { hasText: section }) }).locator('.ed-select').click()
  await p.getByRole('tab', { name: 'Avançado' }).click()
}
const homeHtml = async () => (await (await fetch(`${BASE}/`, { cache: 'no-store' })).text())
const until = async (fn: () => Promise<boolean>, what: string, ms = 15_000) => {
  const end = Date.now() + ms
  while (Date.now() < end) { if (await fn()) return; await new Promise((r) => setTimeout(r, 300)) }
  assert.fail(`Tempo esgotado: ${what}`)
}

let professionalId = 0
let courseId = 0
try {
  await step('login e Home aparece no menu', async () => {
    await page.goto(`${BASE}/admin/login`)
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/admin`)
    await page.getByRole('link', { name: 'Home', exact: true }).waitFor()
  })

  await step('editor da Home abre com as seções do template e a pré-visualização renderizada', async () => {
    await page.goto(`${BASE}/admin/editor/home`)
    await page.locator('.ed-item').first().waitFor()
    const names = await treeNames(page)
    assert.deepEqual(names.slice(0, 4), ['Navegação', 'Topo (hero)', 'Profissionais', 'Cursos'])
    await frame(page).locator('.cb-hero').waitFor({ timeout: 15_000 })
  })

  await step('regras: hero não remove; profissionais e cursos são automáticas (sem ocultar)', async () => {
    await advanced(page, 'Topo (hero)')
    assert.equal(await page.getByRole('button', { name: 'Remover Topo (hero)' }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: /(Ocultar|Mostrar) Cursos/ }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: /(Ocultar|Mostrar) Profissionais/ }).isDisabled(), true)
  })

  await step('editar o texto atualiza a pré-visualização ao vivo e salva sozinho', async () => {
    await page.getByRole('button', { name: /Topo \(hero\)/ }).first().click()
    await page.getByLabel('Kicker', { exact: true }).fill(KICKER)
    await frame(page).getByText(KICKER).waitFor({ timeout: 10_000 })
    await saved(page)
    assert.doesNotMatch(await homeHtml(), new RegExp(KICKER))
  })

  await step('campo de imagem do hero oferece a biblioteca de mídia', async () => {
    await page.getByRole('button', { name: /Biblioteca.*Arquivo/ }).first().waitFor()
  })

  await step('publicar muda a Home pública na hora', async () => {
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await page.getByText('Publicado. O site será atualizado em instantes.').waitFor()
    await until(async () => (await homeHtml()).includes(KICKER), 'Home pública com o texto publicado')
    assert.equal((await get('/admin/home')).body.hasUnpublishedChanges, false)
  })

  await step('vitrine de cursos dinâmica: curso publicado aparece na Home com link que funciona', async () => {
    const prof = await send('post', '/admin/professionals', {
      slug: PROF_SLUG,
      data: {
        name: 'Home E2e', specialty: 'Hair', tagline: 'Técnica e carreira.', experienceYears: 5, instagramHandle: '@e2e',
        instagramFollowers: '1 mil', instagramUrl: 'https://instagram.com/e2e', portraitSrc: '/site/profissional/lukas_perfil.png',
        cardPhotoSrc: '/site/home/lukas-campos.png', bio: ['Trajetória.'], works: [],
      },
    })
    assert.equal(prof.status, 201, JSON.stringify(prof.body))
    professionalId = prof.body.id
    assert.equal((await send('post', `/admin/professionals/${professionalId}/publish`)).status, 200)
    const course = await send('post', '/admin/courses', {
      professionalId, slug: COURSE_SLUG,
      data: {
        title: COURSE_TITLE, lead: 'Resumo.', modality: 'online', level: 'profissional', workloadHours: 4, audience: 'Todos',
        coverSrc: '/site/home/curso-classic-bob.png', coverAlt: 'Capa do curso E2E', benefits: [{ title: 'Mais', text: 'Texto.' }],
        modules: [{ title: 'Módulo', text: 'Texto.', bullets: ['A'] }], deliverables: [{ title: 'Aulas', text: 'Texto.' }],
        faq: [], testimonials: [], guaranteeDays: null,
      },
    })
    assert.equal(course.status, 201, JSON.stringify(course.body))
    courseId = course.body.id
    assert.equal((await send('put', `/admin/courses/${courseId}/commercial`, { listCents: 25000, discountPct: 0, maxInstallments: 6, checkoutUrl: 'https://pay.example.com/c/e2e', environment: 'production', active: true, revision: 0 })).status, 200)
    assert.equal((await send('post', `/admin/courses/${courseId}/publish`)).status, 200)
    await until(async () => (await homeHtml()).includes(`/cursos/${COURSE_SLUG}`), 'cartão do curso na Home')
    const html = await homeHtml()
    assert.match(html, new RegExp(COURSE_TITLE))
    assert.doesNotMatch(html, /\/cursos\/corte-profissional-classic-bob|\/cursos\/camadas-desconectadas/, 'os cartões estáticos antigos não devem mais existir')
    const res = await fetch(`${BASE}/cursos/${COURSE_SLUG}`, { cache: 'no-store' })
    assert.equal(res.status, 200)
  })

  await step('o cartão do curso aparece no editor (automático) e leva ao curso no navegador', async () => {
    await page.goto(`${BASE}/`)
    const card = page.locator(`a[href="/cursos/${COURSE_SLUG}"]`).first()
    await card.waitFor()
    await card.click({ force: true })
    await page.waitForURL(`${BASE}/cursos/${COURSE_SLUG}`)
    assert.equal(await page.getByRole('heading', { level: 1 }).first().isVisible(), true)
    await page.goto(`${BASE}/admin/editor/home`)
    await frame(page).locator(`a[href="/cursos/${COURSE_SLUG}"]`).first().waitFor({ timeout: 15_000 })
  })

  await step('despublicar o curso tira o cartão da Home', async () => {
    assert.equal((await send('post', `/admin/courses/${courseId}/unpublish`)).status, 200)
    await until(async () => !(await homeHtml()).includes(`/cursos/${COURSE_SLUG}`), 'cartão removido da Home')
    assert.match(await homeHtml(), new RegExp(KICKER), 'o texto publicado da Home continua')
  })

  await step('editar o rascunho depois de publicar não muda o público; histórico lista as versões', async () => {
    await page.goto(`${BASE}/admin/editor/home`)
    await page.getByRole('button', { name: /Topo \(hero\)/ }).first().click()
    await page.getByLabel('Kicker', { exact: true }).fill(`${KICKER} (rascunho)`)
    await saved(page)
    assert.doesNotMatch(await homeHtml(), /\(rascunho\)/)
    await menu(page, 'Histórico')
    await page.getByText(/Versão \d+ \(no ar\)/).waitFor()
  })

  await step('restaurar a versão publicada devolve o rascunho ao que está no ar', async () => {
    await page.getByRole('button', { name: 'Restaurar no rascunho' }).first().click()
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await page.waitForLoadState('load')
    await page.getByRole('button', { name: /Topo \(hero\)/ }).first().click()
    assert.equal(await page.getByLabel('Kicker', { exact: true }).inputValue(), KICKER)
  })

  await step('"Restaurar padrão" volta ao template; ao publicar, a Home pública volta ao original', async () => {
    await menu(page, 'Restaurar padrão')
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await page.waitForLoadState('load')
    await page.getByRole('button', { name: /Topo \(hero\)/ }).first().click()
    assert.notEqual(await page.getByLabel('Kicker', { exact: true }).inputValue(), KICKER)
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await page.getByText('Publicado. O site será atualizado em instantes.').waitFor()
    await until(async () => !(await homeHtml()).includes(KICKER), 'Home pública de volta ao original')
  })

  await step('permissão: sem CSRF não salva nem publica a Home (403)', async () => {
    const put = await context.request.put(`${BASE}/api/admin/home/document`, { data: { document: {}, revision: 0 } })
    assert.equal(put.status(), 403)
    const publish = await context.request.post(`${BASE}/api/admin/home/publish`)
    assert.equal(publish.status(), 403)
  })

  await step('390px: editor sem rolagem horizontal da página', async () => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto(`${BASE}/admin/editor/home`)
    await page.locator('.ed-item').first().waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'overflow no editor da Home')
    await page.setViewportSize({ width: 1440, height: 900 })
  })
} finally {
  try {
    if (courseId) { await send('post', `/admin/courses/${courseId}/unpublish`); await send('post', `/admin/courses/${courseId}/archive`) }
    if (professionalId) { await send('post', `/admin/professionals/${professionalId}/unpublish`); await send('post', `/admin/professionals/${professionalId}/archive`) }
  } catch (error) {
    console.error('limpeza falhou:', error)
  }
  await browser.close()
}

console.log(results.join('\n'))
const unexpected = consoleErrors.filter((e) => !/status of 4\d\d|Failed to load resource/.test(e))
console.log(`Erros de console inesperados: ${unexpected.length}`)
if (unexpected.length) console.log(unexpected.join('\n'))
assert.equal(unexpected.length, 0)
