/**
 * E2E do editor visual (Fase 5): árvore, propriedades, pré-visualização ao vivo, arrastar/reordenar,
 * ocultar, desfazer/refazer, autosave, validação, conflito de revisão, histórico, restaurar do cadastro,
 * publicação com o documento e página pública. Cria um profissional `e2e-ed-*` e o arquiva no fim.
 * Requer API (3333) migrada e o build de produção do web (3100).
 * Uso: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web e2e:editor
 */
import { chromium, type BrowserContext, type Page } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
assert.ok(EMAIL && PASSWORD, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD')

const stamp = Date.now().toString(36)
const SLUG = `e2e-ed-${stamp}`
const EDITED = `Texto editado pelo E2E ${stamp}`

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

const login = async (ctx: BrowserContext) => {
  const p = await ctx.newPage()
  watch(p)
  await p.goto(`${BASE}/admin/login`)
  await p.getByLabel('E-mail').fill(EMAIL)
  await p.getByLabel('Senha').fill(PASSWORD)
  await p.getByRole('button', { name: 'Entrar' }).click()
  await p.waitForURL(`${BASE}/admin`)
  return p
}
const xsrf = async (ctx: BrowserContext) => decodeURIComponent((await ctx.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? '')
const send = async (ctx: BrowserContext, method: 'post' | 'put' | 'delete', path: string, data?: unknown) => {
  const res = await ctx.request[method](`${BASE}/api${path}`, { headers: { 'x-xsrf-token': await xsrf(ctx) }, data })
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

const professional = {
  name: 'Editor E2e', specialty: 'Hair', tagline: 'Técnica e carreira.', experienceYears: 10,
  instagramHandle: '@e2e', instagramFollowers: '10 mil', instagramUrl: 'https://instagram.com/e2e',
  portraitSrc: '/site/profissional/lukas_perfil.png', cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: ['Parágrafo original do cadastro.'],
  works: [{ imageSrc: '/site/profissional/trabLukas01.png', alt: 'Trabalho', title: 'Morena', tags: ['mechas'] }],
}

let id = 0
try {
  await step('login e criação (via API) do profissional de teste, já publicado', async () => {
    const p = await login(context)
    await p.close()
    const created = await send(context, 'post', '/admin/professionals', { slug: SLUG, data: professional })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    id = created.body.id
    assert.equal((await send(context, 'post', `/admin/professionals/${id}/publish`)).status, 200)
  })

  await step('página pública antes de editar vem do cadastro (document nulo)', async () => {
    const html = await (await fetch(`${BASE}/profissionais/${SLUG}`, { cache: 'no-store' })).text()
    assert.match(html, /Parágrafo original do cadastro\./)
  })

  await step('editor abre com a árvore de seções e a pré-visualização renderizada', async () => {
    await page.goto(`${BASE}/admin/editor/profissionais/${id}`)
    await page.locator('.ed-item').first().waitFor()
    const names = await treeNames(page)
    assert.deepEqual(names.slice(0, 3), ['Navegação', 'Topo (hero)', 'Trajetória'])
    await frame(page).locator('h1.hero-name').waitFor({ timeout: 15_000 })
  })

  await step('editar o texto atualiza a pré-visualização ao vivo e salva sozinho', async () => {
    await page.getByRole('button', { name: /Trajetória/ }).first().click()
    const field = page.getByLabel('Conteúdo de Parágrafos 1')
    await field.fill(EDITED)
    await frame(page).getByText(EDITED).waitFor({ timeout: 10_000 })
    await saved(page)
  })

  await step('regras: hero não remove, nav não desce para o conteúdo, cursos é automática', async () => {
    await advanced(page, 'Topo (hero)')
    assert.equal(await page.getByRole('button', { name: 'Remover Topo (hero)' }).isDisabled(), true)
    await advanced(page, 'Navegação')
    assert.equal(await page.getByRole('button', { name: 'Mover Navegação para baixo' }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: /(Ocultar|Mostrar) Cursos/ }).isDisabled(), true)
  })

  await step('reordenar por botão e por arrastar; ordem refletida na árvore', async () => {
    const before = await treeNames(page)
    await advanced(page, 'Trajetória')
    await page.getByRole('button', { name: 'Mover Trajetória para baixo' }).click()
    const after = await treeNames(page)
    assert.equal(after[2], before[3])
    assert.equal(after[3], 'Trajetória')
    await saved(page)
    await page.locator('.ed-item').nth(3).dragTo(page.locator('.ed-item').nth(2))
    assert.equal((await treeNames(page))[2], 'Trajetória')
    await saved(page)
  })

  await step('ocultar seção some da pré-visualização; desfazer e refazer', async () => {
    await page.getByRole('button', { name: 'Ocultar Vídeo' }).click().catch(async () => { /* sem vídeo no cadastro: usa Trabalhos */ })
    const worksVisible = async () => (await frame(page).locator('#trabalhos').count()) > 0
    assert.equal(await worksVisible(), true)
    await page.getByRole('button', { name: 'Ocultar Trabalhos em destaque' }).click()
    await frame(page).locator('#trabalhos').waitFor({ state: 'detached', timeout: 10_000 })
    await menu(page, 'Desfazer')
    await frame(page).locator('#trabalhos').waitFor({ timeout: 10_000 })
    await menu(page, 'Refazer')
    await frame(page).locator('#trabalhos').waitFor({ state: 'detached', timeout: 10_000 })
    await menu(page, 'Desfazer')
    await saved(page)
  })

  await step('valor inválido (javascript:) é recusado no cliente e não é salvo', async () => {
    await page.getByRole('button', { name: /Trajetória/ }).first().click()
    await page.getByLabel('Link', { exact: true }).fill('javascript:alert(1)')
    await page.getByRole('status').filter({ hasText: 'Corrija os campos para salvar' }).waitFor()
    await page.getByRole('alert').filter({ hasText: 'URL não permitida' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Publicar' }).isDisabled(), true)
    await menu(page, 'Desfazer')
    await saved(page)
  })

  await step('recarregar mantém texto, ordem e visibilidade (persistido no servidor)', async () => {
    await page.reload()
    await page.locator('.ed-item').first().waitFor()
    const names = await treeNames(page)
    assert.equal(names[2], 'Trajetória')
    await frame(page).getByText(EDITED).waitFor({ timeout: 15_000 })
  })

  await step('publicar leva o documento editado ao site público (texto novo, texto do cadastro sumiu)', async () => {
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await page.getByText('Publicado. O site será atualizado').waitFor()
    let html = ''
    for (let i = 0; i < 20; i += 1) {
      html = await (await fetch(`${BASE}/profissionais/${SLUG}`, { cache: 'no-store' })).text()
      if (html.includes(EDITED)) break
      await new Promise((r) => setTimeout(r, 500))
    }
    assert.ok(html.includes(EDITED), 'o site público deve mostrar o texto editado')
    assert.ok(!html.includes('Parágrafo original do cadastro.'))
  })

  await step('histórico lista as versões e marca a que está no ar', async () => {
    await menu(page, 'Histórico')
    await page.getByText('Versão 2 (no ar)').waitFor()
    await page.getByText(/Versão 1.*gerada pelo cadastro|Versão 1/).first().waitFor()
  })

  await step('conflito: duas abas editando; a segunda é bloqueada sem perder dados da primeira', async () => {
    const other = await context.newPage()
    watch(other)
    await other.goto(`${BASE}/admin/editor/profissionais/${id}`)
    await other.locator('.ed-item').first().waitFor()
    await menu(page, 'Histórico') // volta ao painel de propriedades
    await page.getByRole('button', { name: /Trajetória/ }).first().click()
    await page.getByLabel('Conteúdo de Parágrafos 1').fill(`${EDITED} (aba 1)`)
    await saved(page)
    await other.getByRole('button', { name: /Trajetória/ }).first().click()
    await other.getByLabel('Conteúdo de Parágrafos 1').fill(`${EDITED} (aba 2)`)
    await other.getByRole('alert').filter({ hasText: 'Outra pessoa alterou esta página' }).waitFor({ timeout: 10_000 })
    await other.close()
    const server = await (await context.request.get(`${BASE}/api/admin/professionals/${id}/document`)).json()
    assert.match(JSON.stringify(server.document), /aba 1/)
    assert.doesNotMatch(JSON.stringify(server.document), /aba 2/)
  })

  await step('restaurar do cadastro descarta o documento e volta ao texto do cadastro', async () => {
    await menu(page, 'Restaurar do cadastro')
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await page.waitForLoadState('load')
    await page.locator('.ed-item').first().waitFor()
    await frame(page).getByText('Parágrafo original do cadastro.').waitFor({ timeout: 15_000 })
    const server = await (await context.request.get(`${BASE}/api/admin/professionals/${id}/document`)).json()
    assert.equal(server.document, null)
  })

  await step('painel sem horizontal overflow em 390px', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await page.locator('.ed-item').first().waitFor()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 1, `overflow horizontal de ${overflow}px`)
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  await step('escrita do documento sem token CSRF é recusada (403)', async () => {
    const res = await context.request.put(`${BASE}/api/admin/professionals/${id}/document`, { data: { document: {}, revision: 0 } }) // sem CSRF
    assert.equal(res.status(), 403)
  })

  await step('rota de pré-visualização ao vivo só é embutível pelo próprio site', async () => {
    const live = await fetch(`${BASE}/admin/preview/profissionais/${id}/live`, { redirect: 'manual' })
    assert.match(live.headers.get('content-security-policy') ?? '', /frame-ancestors 'self'/)
    const editorHeaders = await fetch(`${BASE}/admin/editor/profissionais/${id}`, { redirect: 'manual' })
    assert.match(editorHeaders.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/)
    assert.equal(editorHeaders.headers.get('x-frame-options'), 'DENY')
  })

  let courseId = 0
  const COURSE_SLUG = `e2e-ed-curso-${stamp}`
  const CTA = `Entrar agora ${stamp}`
  const CHECKOUT = `https://pay.example.com/c/${stamp}`

  await step('curso: criado e publicado via API com oferta (R$ 250 − 30%)', async () => {
    const created = await send(context, 'post', '/admin/courses', {
      professionalId: id, slug: COURSE_SLUG,
      data: {
        title: 'Curso Editor', lead: 'A metodologia de corte para valorizar a cor.', modality: 'online', level: 'profissional', workloadHours: 8,
        audience: 'Cabeleireiros e coloristas', coverSrc: '/site/curso/produto-morena-iluminada.svg', coverAlt: 'Capa do curso',
        benefits: [{ title: 'Mais brilho', text: 'Cortes que realçam a cor.' }],
        modules: [{ title: 'Corte e cor', text: 'Leitura da coloração.', bullets: ['Diagnóstico'] }],
        deliverables: [{ title: 'Aulas', text: 'Método completo.' }], faq: [], testimonials: [], guaranteeDays: null,
      },
    })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    courseId = created.body.id
    const commercial = await send(context, 'put', `/admin/courses/${courseId}/commercial`, {
      listCents: 25000, discountPct: 30, maxInstallments: 6, checkoutUrl: CHECKOUT, environment: 'production', active: true, revision: 0,
    })
    assert.equal(commercial.status, 200, JSON.stringify(commercial.body))
    const pub = await send(context, 'post', `/admin/courses/${courseId}/publish`)
    assert.equal(pub.status, 200, JSON.stringify(pub.body))
  })

  await step('editor de curso: seções, oferta obrigatória, edição ao vivo e autosave', async () => {
    await page.goto(`${BASE}/admin/editor/cursos/${courseId}`)
    await page.locator('.ed-item').first().waitFor()
    const names = await treeNames(page)
    assert.ok(names.includes('Oferta') && names.includes('Chamada final'), names.join(','))
    await advanced(page, 'Oferta')
    assert.equal(await page.getByRole('button', { name: 'Remover Oferta' }).isDisabled(), true)
    await frame(page).locator('.pg-course').waitFor({ timeout: 15_000 })
    await page.getByRole('button', { name: /Chamada final/ }).first().click()
    await page.getByLabel('Texto do botão').fill(CTA)
    await frame(page).getByText(CTA).first().waitFor({ timeout: 10_000 })
    await saved(page)
  })

  await step('curso publicado: texto editado no ar; preço e checkout continuam vindo do backend', async () => {
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await page.getByText('Publicado. O site será atualizado').waitFor()
    let html = ''
    for (let i = 0; i < 20; i += 1) {
      html = await (await fetch(`${BASE}/cursos/${COURSE_SLUG}`, { cache: 'no-store' })).text()
      if (html.includes(CTA)) break
      await new Promise((r) => setTimeout(r, 500))
    }
    assert.ok(html.includes(CTA), 'texto editado deve estar no site')
    assert.ok(html.includes('R$ 175,00'), 'preço calculado no backend (250 − 30%)')
    assert.ok(html.includes(`href="${CHECKOUT}"`), 'link de checkout vem do backend')
  })

  await step('instrutor: "Não mostrar retrato" tira a foto (a página não repõe o retrato do cadastro) e vale no site publicado', async () => {
    await page.goto(`${BASE}/admin/editor/cursos/${courseId}`)
    await page.locator('.ed-item').first().waitFor()
    await frame(page).locator('h1').first().waitFor({ timeout: 15_000 })
    // O curso herda o retrato do profissional: a prévia começa com foto.
    await frame(page).locator('.instructor-portrait img').waitFor({ timeout: 10_000 })
    await page.locator('.ed-item').filter({ has: page.locator('.ed-name', { hasText: 'Instrutor' }) }).locator('.ed-select').click()
    const hide = page.getByLabel('Não mostrar retrato (só o monograma)')
    assert.equal(await hide.isChecked(), false)
    await hide.check()
    await frame(page).locator('.instructor-portrait .monogram').waitFor({ timeout: 10_000 })
    assert.equal(await frame(page).locator('.instructor-portrait img').count(), 0)
    await saved(page)
    // Recarregar não repõe o retrato: o marcador foi salvo no documento.
    await page.reload()
    await page.locator('.ed-item').first().waitFor()
    await frame(page).locator('.instructor-portrait .monogram').waitFor({ timeout: 15_000 })
    assert.equal(await frame(page).locator('.instructor-portrait img').count(), 0)
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await page.getByText('Publicado. O site será atualizado em instantes.').waitFor()
    let html = ''
    for (let i = 0; i < 30; i++) {
      html = await (await fetch(`${BASE}/cursos/${COURSE_SLUG}`, { cache: 'no-store' })).text()
      if (!/class="instructor-portrait[^"]*"[^>]*>\s*<img/.test(html) && html.includes('class="monogram"')) break
      await new Promise((r) => setTimeout(r, 500))
    }
    const block = html.slice(html.indexOf('id="instrutor"'), html.indexOf('id="depoimentos"') > 0 ? html.indexOf('id="depoimentos"') : html.indexOf('id="oferta"'))
    assert.ok(block.includes('class="monogram"'), 'monograma no site')
    assert.ok(!block.includes('<img'), 'sem foto do instrutor no site')
    // Desmarcar devolve o retrato (depois de recarregar a seleção volta ao início: escolhe o Instrutor de novo).
    await page.locator('.ed-item').filter({ has: page.locator('.ed-name', { hasText: 'Instrutor' }) }).locator('.ed-select').click()
    await page.getByLabel('Não mostrar retrato (só o monograma)').uncheck()
    await frame(page).locator('.instructor-portrait img').waitFor({ timeout: 10_000 })
    await saved(page)
  })

  await step('servidor recusa documento de curso com seção de outro template', async () => {
    const bad = await send(context, 'put', `/admin/courses/${courseId}/document`, {
      document: { schemaVersion: 1, template: { key: 'course-original', version: 1 }, sections: [{ id: 'x', type: 'professional.hero', schemaVersion: 1, visibility: { enabled: true }, settings: {}, content: {} }] },
      revision: 99,
    })
    assert.ok([409, 422].includes(bad.status), `status ${bad.status}`)
  })

  await send(context, 'post', `/admin/courses/${courseId}/archive`)
} catch (error) {
  console.error('FALHA:', error)
  console.log(results.join('\n'))
  await browser.close()
  process.exitCode = 1
  throw error
}
if (id) await send(context, 'post', `/admin/professionals/${id}/archive`)
const unexpected = consoleErrors.filter((e) => !/status of 409|status of 422|status of 403|Failed to load resource/.test(e))
console.log(results.join('\n'))
console.log('Erros de console inesperados:', unexpected.length ? unexpected : 'nenhum')
await browser.close()
assert.equal(unexpected.length, 0)
