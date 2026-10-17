/**
 * E2E do módulo de cursos e comércio Modo A (Fase 4): cadastro em etapas, oferta com link de
 * checkout validado, publicação, página pública (preço do backend, redirecionamento), vitrine no
 * profissional, snapshot (alterar preço só vale após republicar) e despublicação.
 * Requer API (3333) com migrações e seed (profissional lukas-campos publicado), CHECKOUT_ALLOWED_HOSTS=pay.example.com
 * e o build de produção do web (3100) com REVALIDATE_SECRET igual ao da API.
 * Uso: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web e2e:courses
 */
import { chromium, type Page } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
assert.ok(EMAIL && PASSWORD, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD')

const stamp = Date.now().toString(36)
const SLUG = `e2e-curso-${stamp}`
const TITLE = `Curso Teste ${stamp.replace(/[0-9]/g, 'x')}`.slice(0, 40)
const CHECKOUT = `https://pay.example.com/c/${stamp}`

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext()
const page = await context.newPage()
const consoleErrors: string[] = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`) })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('response', async (r) => { if (r.status() >= 400 && r.url().includes('/api/')) console.log(`[http ${r.status()}] ${r.request().method()} ${r.url()} ${(await r.text().catch(() => '')).slice(0, 300)}`) })
const results: string[] = []
const step = async (name: string, fn: () => Promise<void>) => { await fn(); results.push(`✓ ${name}`) }

const goStep = (p: Page, label: string) => p.getByRole('button', { name: label }).click()
const save = async (p: Page) => { await p.getByRole('button', { name: 'Salvar', exact: true }).click(); await p.getByText('Alterações salvas.').waitFor() }
const publicStatus = async (path: string) => (await fetch(`${BASE}${path}`, { redirect: 'manual' })).status
const publicHtml = async (path: string) => (await fetch(`${BASE}${path}`, { cache: 'no-store' })).text()
const decode = (html: string) => html.replace(/&nbsp;| /g, ' ').replace(/&#x27;/g, "'")

try {
  await step('login; lista de cursos mostra o curso do seed', async () => {
    await page.goto(`${BASE}/admin/login`)
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/admin`)
    await page.getByRole('link', { name: 'Cursos' }).click()
    await page.waitForURL('**/admin/cursos')
    await page.getByRole('link', { name: 'Morena Iluminada' }).waitFor()
  })

  await step('curso do seed: página pública no Modo A (preço do backend, botões levam ao checkout, sem formulário)', async () => {
    const res = await page.goto(`${BASE}/cursos/morena-iluminada`)
    assert.equal(res?.status(), 200)
    await page.locator('h1.hero-title').filter({ hasText: 'Morena' }).waitFor()
    assert.equal(await page.locator('#checkout').count(), 0, 'checkout de demonstração não deve existir')
    assert.equal(await page.locator('input[name="cpf"]').count(), 0)
    const hrefs = await page.locator('a[data-cta]').evaluateAll((els) => els.map((e) => [e.getAttribute('href'), e.getAttribute('rel')]))
    assert.ok(hrefs.length >= 5)
    for (const [href, rel] of hrefs) {
      assert.equal(href, 'https://pay.example.com/morena-iluminada')
      assert.match(rel ?? '', /noopener/)
    }
    const text = decode(await page.locator('body').innerText())
    assert.match(text, /R\$ 175,00/)
    assert.match(text, /30% OFF/)
    assert.doesNotMatch(text, /Depoimentos de exemplo|garantia/i, 'conteúdo não cadastrado não pode aparecer')
  })

  await step('a página do profissional lista o curso publicado', async () => {
    await page.goto(`${BASE}/profissionais/lukas-campos`)
    const href = await page.locator('a.course-card').first().getAttribute('href')
    assert.equal(href, '/cursos/morena-iluminada')
  })

  await step('etapa 1: exige profissional e título; cria o rascunho', async () => {
    await page.goto(`${BASE}/admin/cursos/novo`)
    await page.getByRole('button', { name: 'Criar rascunho' }).click()
    await page.getByRole('alert').first().waitFor()
    await page.getByLabel('Profissional').selectOption({ label: 'Lukas Campos' })
    await page.getByLabel('Título do curso').fill(TITLE)
    assert.equal(await page.getByLabel('Endereço da página (slug)').inputValue(), TITLE.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    await page.getByLabel('Endereço da página (slug)').fill(SLUG)
    await page.getByLabel('Para quem é o curso').fill('Cabeleireiros')
    await page.getByRole('button', { name: 'Criar rascunho' }).click()
    await page.waitForURL(/\/admin\/cursos\/\d+$/)
  })
  const editUrl = page.url()
  const id = editUrl.split('/').pop()!

  await step('rascunho vazio: publicar bloqueado, pendências listadas, pré-visualização explica', async () => {
    await goStep(page, 'Revisão e publicação')
    await page.getByText('Pendências para publicar:').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Publicar', exact: true }).isDisabled(), true)
    const preview = await context.newPage()
    await preview.goto(`${BASE}/admin/preview/cursos/${id}`)
    await preview.getByRole('heading', { name: 'Complete o curso para visualizar' }).waitFor()
    await preview.close()
  })

  await step('etapa 2: conteúdo; rejeita URL perigosa e marcação', async () => {
    await goStep(page, 'Conteúdo')
    await page.getByLabel('Descrição do curso').fill('Descrição <b>do</b> curso')
    await page.getByLabel('Imagem de capa').fill('javascript:alert(1)')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Corrija os campos destacados.').waitFor()
    await page.getByLabel('Descrição do curso').fill('Um curso de teste sobre técnica e carreira.')
    await page.getByLabel('Imagem de capa').fill('/site/curso/produto-morena-iluminada.svg')
    await page.getByLabel('Descrição da capa (texto alternativo)').fill('Capa do curso de teste')
    await page.getByRole('button', { name: 'Adicionar benefício' }).click()
    await page.getByLabel('Benefício 1 · título').fill('Mais técnica')
    await page.getByLabel('Texto', { exact: true }).first().fill('Aprenda com quem faz.')
    await page.getByRole('button', { name: 'Adicionar módulo' }).click()
    await page.getByLabel('Módulo 1 · título').fill('Fundamentos')
    await page.getByLabel('Descrição', { exact: true }).fill('Base do método.')
    await page.getByRole('button', { name: 'Adicionar item' }).click()
    await page.getByLabel('Item 1 · título').fill('Aulas gravadas')
    await page.getByLabel('Texto', { exact: true }).last().fill('Acesso ao conteúdo completo.')
    await save(page)
  })

  await step('etapa 4: link de checkout fora da lista é recusado; preço inválido também', async () => {
    await goStep(page, 'Oferta e checkout')
    await page.getByLabel('Preço de tabela (R$)').fill('abc')
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText('Corrija os campos destacados.').waitFor()
    await page.getByLabel('Preço de tabela (R$)').fill('199,90')
    await page.getByLabel('Desconto (%)').fill('10')
    await page.getByLabel('Parcelas máximas (sem juros, exibição)').selectOption('3')
    await page.getByLabel('Link do checkout (https)').fill('https://malicioso.example.org/pagar')
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/domínio de checkout não autorizado/i).first().waitFor()
    await page.getByLabel('Link do checkout (https)').fill('http://pay.example.com/c/x')
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/deve usar https/i).first().waitFor()
  })

  await step('oferta válida: prévia de cálculo e gravação', async () => {
    await page.getByLabel('Link do checkout (https)').fill(CHECKOUT)
    await page.getByLabel('Oferta ativa (permite publicar o curso)').check()
    await page.getByText(/Prévia: de R\$\s*199,90 por/).waitFor()
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/Oferta salva/).waitFor()
  })

  await step('pré-visualização do rascunho renderiza com os dados, botões desativados, e não é pública', async () => {
    const preview = await context.newPage()
    await preview.goto(`${BASE}/admin/preview/cursos/${id}`)
    await preview.locator('h1.hero-title').waitFor()
    assert.equal(await preview.locator('a[data-cta]').count(), 0)
    assert.ok((await preview.locator('[data-unavailable]').count()) >= 5)
    await preview.close()
    assert.equal(await publicStatus(`/cursos/${SLUG}`), 404)
    assert.equal(await publicStatus(`/admin/preview/cursos/${id}`), 307)
  })

  await step('publica: página pública e vitrine do profissional atualizam na hora', async () => {
    await goStep(page, 'Revisão e publicação')
    await page.getByText('Curso completo: pronto para publicar.').waitFor()
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await page.getByText('Publicado. A página pública já foi atualizada.').waitFor()
    const html = decode(await publicHtml(`/cursos/${SLUG}`))
    assert.match(html, /R\$ 179,91/)
    assert.match(html, /10% OFF/)
    assert.ok(html.includes(`href="${CHECKOUT}"`))
    assert.match(html, /3x de R\$ 59,97/)
    assert.doesNotMatch(html, /Lukas Campos por.*garantia/)
    assert.match(await publicHtml('/profissionais/lukas-campos'), new RegExp(`href="/cursos/${SLUG}"`))
  })

  await step('alterar o preço não muda a página pública até republicar (snapshot)', async () => {
    await goStep(page, 'Oferta e checkout')
    await page.getByLabel('Preço de tabela (R$)').fill('300,00')
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/Oferta salva/).waitFor()
    assert.match(decode(await publicHtml(`/cursos/${SLUG}`)), /R\$ 179,91/)
    await goStep(page, 'Revisão e publicação')
    await page.getByText(/há alterações não publicadas/).waitFor()
    await page.getByRole('button', { name: 'Publicar alterações' }).click()
    await page.getByText('Publicado. A página pública já foi atualizada.').waitFor()
    const html = decode(await publicHtml(`/cursos/${SLUG}`))
    assert.match(html, /R\$ 270,00/)
    assert.doesNotMatch(html, /R\$ 179,91/)
  })

  await step('oferta desativada + republicar: botão de compra fica indisponível; não há link externo', async () => {
    await goStep(page, 'Oferta e checkout')
    await page.getByLabel('Oferta ativa (permite publicar o curso)').uncheck()
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/Oferta salva/).waitFor()
    await goStep(page, 'Revisão e publicação')
    await page.getByText(/Ative a oferta/).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Publicar alterações' }).isDisabled(), true)
    await goStep(page, 'Oferta e checkout')
    await page.getByLabel('Oferta ativa (permite publicar o curso)').check()
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/Oferta salva/).waitFor()
  })

  await step('despublicar tira a página e o cartão do ar; arquivar e restaurar', async () => {
    await goStep(page, 'Revisão e publicação')
    await page.getByRole('button', { name: 'Despublicar' }).click()
    await page.getByText('Curso tirado do ar.').waitFor()
    assert.equal(await publicStatus(`/cursos/${SLUG}`), 404)
    assert.doesNotMatch(await publicHtml('/profissionais/lukas-campos'), new RegExp(SLUG))
    page.once('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Arquivar' }).click()
    await page.getByText('Curso arquivado.').waitFor()
    await page.getByRole('button', { name: 'Restaurar' }).click()
    await page.getByText('Curso restaurado como rascunho.').waitFor()
  })

  await step('mobile 390px: páginas do módulo sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 800 })
    for (const url of [`${BASE}/admin/cursos`, editUrl, `${BASE}/cursos/morena-iluminada`]) {
      await page.goto(url)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 1, `overflow horizontal de ${overflow}px em ${url}`)
    }
  })

  await step('sem erros ou avisos de console, exceto as 2 recusas 422 provocadas de propósito (link fora da lista e http)', async () => {
    const expected = consoleErrors.filter((e) => e.includes('status of 422'))
    assert.equal(expected.length, 2)
    assert.deepEqual(consoleErrors.filter((e) => !e.includes('status of 422')), [])
  })

  console.log(results.join('\n'))
  console.log(`\n${results.length} verificações passaram.`)
} catch (error) {
  console.log(results.join('\n'))
  console.error('\nFALHOU:', error)
  console.error('Erros de console até aqui:', consoleErrors)
  process.exitCode = 1
} finally {
  await browser.close()
}
