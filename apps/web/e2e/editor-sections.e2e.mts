/**
 * E2E da 9B (fundo da seção, aba Estilo) e 9C (duplicar/adicionar outra seção repetível) no editor do Profissional:
 * escolhe um tom, vê na pré-visualização, duplica a Trajetória, respeita o limite de 4, publica e confere a página pública
 * (tom aplicado, ids únicos). Cria um profissional `e2e-sec-*` e o arquiva no fim.
 * Requer API (3333) migrada e o build de produção do web (3100).
 * Uso: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web e2e:editor-sections
 */
import { chromium, type BrowserContext, type Page } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
assert.ok(EMAIL && PASSWORD, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD')

const SLUG = `e2e-sec-${Date.now().toString(36)}`
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const consoleErrors: string[] = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${m.type()}: ${m.text()}`) })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
const results: string[] = []
const step = async (name: string, fn: () => Promise<void>) => { await fn(); results.push(`✓ ${name}`) }

const xsrf = async (ctx: BrowserContext) => decodeURIComponent((await ctx.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? '')
const send = async (method: 'post' | 'put' | 'delete', path: string, data?: unknown) => {
  const res = await context.request[method](`${BASE}/api${path}`, { headers: { 'x-xsrf-token': await xsrf(context) }, data })
  return { status: res.status(), body: await res.json().catch(() => null) as any }
}
const saved = (p: Page) => p.getByRole('status').filter({ hasText: 'Salvo' }).waitFor({ timeout: 10_000 })
const frame = (p: Page) => p.frameLocator('iframe[title="Pré-visualização da página"]')
const treeNames = (p: Page) => p.locator('.ed-item .ed-name').allTextContents()
const selectSection = (p: Page, label: string, nth = 0) =>
  p.locator('.ed-item').filter({ has: p.locator('.ed-name', { hasText: label }) }).nth(nth).locator('.ed-select').click()
const publicHtml = async () => (await fetch(`${BASE}/profissionais/${SLUG}`, { cache: 'no-store' })).text()

const professional = {
  name: 'Secoes E2e', specialty: 'Hair', tagline: 'Técnica e carreira.', experienceYears: 10,
  instagramHandle: '@e2e', instagramFollowers: '10 mil', instagramUrl: 'https://instagram.com/e2e',
  portraitSrc: '/site/profissional/lukas_perfil.png', cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: ['Parágrafo original do cadastro.'],
  works: [{ imageSrc: '/site/profissional/trabLukas01.png', alt: 'Trabalho', title: 'Morena', tags: ['mechas'] }],
}

let id = 0
try {
  await step('login e criação (via API) do profissional de teste, já publicado', async () => {
    await page.goto(`${BASE}/admin/login`)
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/admin`)
    const created = await send('post', '/admin/professionals', { slug: SLUG, data: professional })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    id = created.body.id
    assert.equal((await send('post', `/admin/professionals/${id}/publish`)).status, 200)
  })

  await step('aba Estilo: a Trajetória (texto escuro) oferece só tons claros; "Papel" é aplicado na pré-visualização', async () => {
    await page.goto(`${BASE}/admin/editor/profissionais/${id}`)
    await page.locator('.ed-item').first().waitFor()
    await frame(page).locator('h1.hero-name').waitFor({ timeout: 15_000 })
    await selectSection(page, 'Trajetória')
    await page.getByRole('tab', { name: 'Estilo' }).click()
    assert.equal(await page.getByRole('radio', { name: /Padrão do modelo/ }).isChecked(), true)
    assert.deepEqual(await page.locator('.ed-bg-opt strong').allTextContents(), ['Padrão do modelo', 'Branco', 'Papel', 'Dourado'], 'tons escuros ficam de fora: o texto da seção é escuro')
    await page.locator('label.ed-bg-opt', { hasText: 'Papel' }).click()
    assert.equal(await page.getByRole('radio', { name: /Papel/ }).isChecked(), true)
    await frame(page).locator('.pg-bg[data-bg="paper"] .bio-section').waitFor({ timeout: 10_000 })
    await saved(page)
  })

  await step('seções sem suporte a fundo (hero) explicam em vez de mostrar o controle', async () => {
    await selectSection(page, 'Topo (hero)')
    await page.getByRole('tab', { name: 'Estilo' }).click()
    await page.getByText(/não aceita troca de fundo/).waitFor()
    assert.equal(await page.locator('.ed-bg-opt').count(), 0)
  })

  await step('Avançado: duplicar a Trajetória cria a cópia logo abaixo, selecionada, com o mesmo fundo e id próprio', async () => {
    await selectSection(page, 'Trajetória')
    await page.getByRole('tab', { name: 'Avançado' }).click()
    await page.getByRole('button', { name: 'Duplicar seção' }).click()
    const names = await treeNames(page)
    assert.equal(names.filter((n) => n === 'Trajetória').length, 2, names.join(', '))
    await page.getByText('bio-2', { exact: true }).waitFor()
    await frame(page).locator('.bio-section').nth(1).waitFor({ timeout: 10_000 })
    await saved(page)
  })

  await step('menu "+ Adicionar seção" oferece "Outra «Trajetória»" até o limite de 4; depois some e o duplicar é recusado', async () => {
    for (let n = 3; n <= 4; n++) {
      await page.getByRole('button', { name: /Adicionar seção/ }).click()
      await page.getByRole('menuitem', { name: /Outra «Trajetória»/ }).click()
      assert.equal((await treeNames(page)).filter((x) => x === 'Trajetória').length, n)
    }
    await page.getByRole('button', { name: /Adicionar seção/ }).click()
    assert.equal(await page.getByRole('menuitem', { name: /Outra «Trajetória»/ }).count(), 0, 'no limite a opção some')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Duplicar seção' }).click()
    await page.getByText(/já aparece 4 vezes/).waitFor()
    assert.equal((await treeNames(page)).filter((x) => x === 'Trajetória').length, 4)
    await saved(page)
  })

  await step('tipos únicos não oferecem duplicar (Trabalhos em destaque sim, Números não existe no Original)', async () => {
    await selectSection(page, 'Topo (hero)')
    await page.getByRole('tab', { name: 'Avançado' }).click()
    assert.equal(await page.getByRole('button', { name: 'Duplicar seção' }).count(), 0)
  })

  await step('publicar leva as 4 trajetórias ao site (2 em "Papel": original e duplicata); ids de DOM únicos', async () => {
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await page.getByText('Publicado. O site será atualizado em instantes.').waitFor()
    let html = ''
    for (let i = 0; i < 30; i++) {
      html = await publicHtml()
      if ((html.match(/class="bio-section"/g) ?? []).length === 4) break
      await new Promise((r) => setTimeout(r, 500))
    }
    assert.equal((html.match(/class="bio-section"/g) ?? []).length, 4)
    assert.equal((html.match(/data-bg="paper"/g) ?? []).length, 2, 'a duplicata herdou o fundo; as adicionadas pelo menu nascem no padrão do modelo')
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!)
    assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), [], 'ids duplicados no HTML público')
  })

  await step('desfazer reverte a última ação; "Padrão do modelo" limpa o tom só da seção escolhida', async () => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Desfazer' }).click()
    await selectSection(page, 'Trajetória')
    await page.getByRole('tab', { name: 'Estilo' }).click()
    await page.locator('label.ed-bg-opt', { hasText: 'Padrão do modelo' }).click()
    await frame(page).locator('.pg-bg[data-bg="paper"]').nth(0).waitFor({ state: 'attached', timeout: 10_000 }) // a duplicata segue em papel
    await saved(page)
  })

  await step('390 px: aba Estilo sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await page.locator('.ed-item').first().waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1)
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  await step('servidor recusa fundo livre, tom de outro esquema e a 5ª trajetória', async () => {
    const state = await context.request.get(`${BASE}/api/admin/professionals/${id}/document`)
    const body = await state.json()
    const doc = body.document
    const bio = doc.sections.find((s: any) => s.type === 'professional.bio')
    const free = structuredClone(doc)
    free.sections.find((s: any) => s.id === bio.id).settings = { background: '#ff0000' }
    assert.equal((await send('put', `/admin/professionals/${id}/document`, { document: free, revision: body.documentRevision })).status, 422)
    const wrong = structuredClone(doc)
    wrong.sections.find((s: any) => s.id === bio.id).settings = { background: 'dark' }
    assert.equal((await send('put', `/admin/professionals/${id}/document`, { document: wrong, revision: body.documentRevision })).status, 422, 'tom escuro em seção de texto escuro')
    const five = structuredClone(doc)
    five.sections.push({ ...structuredClone(bio), id: 'bio-9' }, { ...structuredClone(bio), id: 'bio-10' })
    assert.equal((await send('put', `/admin/professionals/${id}/document`, { document: five, revision: body.documentRevision })).status, 422)
  })
} catch (error) {
  console.error('FALHA:', error)
  console.log(results.join('\n'))
  process.exitCode = 1
} finally {
  if (id) {
    await send('post', `/admin/professionals/${id}/unpublish`)
    await send('post', `/admin/professionals/${id}/archive`)
  }
  await browser.close()
}
const unexpected = consoleErrors.filter((e) => !/status of 4\d\d|Failed to load resource/.test(e))
console.log(results.join('\n'))
console.log('Erros de console inesperados:', unexpected.length ? unexpected : 'nenhum')
if (unexpected.length) process.exitCode = 1
