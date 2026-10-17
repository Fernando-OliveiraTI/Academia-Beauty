/**
 * E2E do módulo de profissionais (Fase 3): cadastro em etapas, pré-visualização, publicação,
 * página pública, vitrine da Home, alterações não publicadas, despublicar e arquivar.
 * Requer API (3333) com migrações e seed, e o build de produção do web (3100) com REVALIDATE_SECRET igual ao da API.
 * Uso: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web e2e:professionals
 */
import { chromium, type Page } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
assert.ok(EMAIL && PASSWORD, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD')

const stamp = Date.now().toString(36)
const SLUG = `e2e-${stamp}`
const NAME = `Teste E2e${stamp.replace(/[0-9]/g, 'x')}`.slice(0, 40)

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
const publicStatus = async (path: string) => (await fetch(`${BASE}${path}`, { redirect: 'manual' })).status
const has = async (path: string, re: RegExp) => re.test(await publicHtml(path))
const publicHtml = async (path: string) => (await fetch(`${BASE}${path}`, { cache: 'no-store' })).text()

try {
  await step('login e lista com o profissional publicado do seed', async () => {
    await page.goto(`${BASE}/admin/login`)
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/admin`)
    await page.getByRole('link', { name: 'Profissionais' }).click()
    await page.waitForURL('**/admin/profissionais')
    await page.getByRole('link', { name: 'Lukas Campos' }).waitFor()
  })

  await step('página pública do seed renderiza; rascunho e slug inexistente dão 404', async () => {
    const res = await page.goto(`${BASE}/profissionais/lukas-campos`)
    assert.equal(res?.status(), 200)
    await page.locator('h1.hero-name').filter({ hasText: 'Lukas' }).waitFor()
    assert.equal(await publicStatus('/profissionais/cleber-venancio'), 404) // rascunho
    assert.equal(await publicStatus('/profissionais/nao-existe-mesmo'), 404)
  })

  await step('a Home lista só publicados e liga para a página do profissional', async () => {
    await page.goto(`${BASE}/`)
    const links = await page.locator('a.professor-card-link').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    assert.ok(links.includes('/profissionais/lukas-campos'))
    assert.ok(!links.includes('/profissionais/cleber-venancio'), 'rascunho não pode aparecer na vitrine')
  })

  await step('etapa 1: valida nome obrigatório e cria o rascunho', async () => {
    await page.goto(`${BASE}/admin/profissionais/novo`)
    await page.getByRole('button', { name: 'Criar rascunho' }).click()
    await page.getByRole('alert').first().waitFor()
    await page.getByLabel('Nome completo').fill(NAME)
    await page.getByLabel('Especialidade').fill('Barber')
    assert.equal(await page.getByLabel('Endereço da página (slug)').inputValue(), NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    await page.getByLabel('Endereço da página (slug)').fill(SLUG)
    await page.getByRole('button', { name: 'Criar rascunho' }).click()
    await page.waitForURL(/\/admin\/profissionais\/\d+$/)
  })

  const editUrl = page.url()
  const id = editUrl.split('/').pop()!

  await step('rascunho incompleto: publicar bloqueado, pendências listadas e pré-visualização explica', async () => {
    await goStep(page, 'Revisão e publicação')
    await page.getByText('Pendências para publicar:').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Publicar', exact: true }).isDisabled(), true)
    const preview = await context.newPage()
    await preview.goto(`${BASE}/admin/preview/profissionais/${id}`)
    await preview.getByRole('heading', { name: 'Complete o cadastro para visualizar' }).waitFor()
    await preview.close()
  })

  await step('rejeita marcação no nome (cliente) sem enviar ao servidor', async () => {
    await goStep(page, 'Identidade')
    await page.getByLabel('Nome completo').fill('<script>alert(1)</script>')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Corrija os campos destacados.').waitFor()
    await page.getByLabel('Nome completo').fill(NAME)
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Alterações salvas.').waitFor()
  })

  await step('etapas 2 a 4: preenche e salva', async () => {
    await goStep(page, 'Apresentação')
    await page.getByLabel('Frase de apresentação').fill('Técnica, ritmo e carreira.')
    await page.getByLabel('Anos de experiência').fill('7')
    await page.getByLabel('Instagram (usuário)').fill('@teste')
    await page.getByLabel('Seguidores (texto exibido)').fill('1 Mil seguidores')
    await page.getByLabel('Link do Instagram').fill('https://instagram.com/teste')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Alterações salvas.').waitFor()

    await goStep(page, 'Imagens e vídeo')
    await page.getByLabel('Retrato da página').fill('javascript:alert(1)')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Corrija os campos destacados.').waitFor()
    await page.getByLabel('Retrato da página').fill('/site/profissional/lukas_perfil.png')
    await page.getByLabel('Foto do cartão na Home').fill('/site/home/lukas-campos.png')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Alterações salvas.').waitFor()

    await goStep(page, 'Trajetória e trabalhos')
    await page.getByRole('button', { name: 'Adicionar parágrafo' }).click()
    await page.getByLabel('Parágrafo 1').fill('Trajetória do profissional de teste.')
    await page.getByRole('button', { name: 'Adicionar trabalho' }).click()
    await page.getByLabel('Trabalho 1 · título').fill('Corte Teste')
    await page.getByLabel('Imagem', { exact: true }).fill('/site/profissional/trabLukas01.png')
    await page.getByLabel('Texto alternativo da imagem').fill('Corte de teste')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Alterações salvas.').waitFor()
  })

  await step('pré-visualização do rascunho renderiza com os dados e não é pública', async () => {
    const preview = await context.newPage()
    await preview.goto(`${BASE}/admin/preview/profissionais/${id}`)
    await preview.locator('h1.hero-name').waitFor()
    assert.match(await preview.locator('h1.hero-name').innerText(), /Teste/i)
    await preview.close()
    assert.equal(await publicStatus(`/profissionais/${SLUG}`), 404)
    assert.equal(await publicStatus(`/admin/preview/profissionais/${id}`), 307) // sem sessão → login
  })

  await step('publica: página pública e vitrine da Home atualizam na hora (invalidação por tag)', async () => {
    await goStep(page, 'Revisão e publicação')
    await page.getByText('Cadastro completo: pronto para publicar.').waitFor()
    await page.getByLabel('Exibir na Home quando publicado').check()
    await page.getByLabel('Posição (menor aparece primeiro)').fill('50')
    await page.getByRole('button', { name: 'Salvar vitrine' }).click()
    await page.getByText('Vitrine atualizada.').waitFor()
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await page.getByText('Publicado. A página pública já foi atualizada.').waitFor()

    assert.equal(await publicStatus(`/profissionais/${SLUG}`), 200)
    assert.ok(await has(`/profissionais/${SLUG}`, /Trajetória do profissional de teste\./), 'bio publicada ausente')
    assert.ok(await has('/', new RegExp(`/profissionais/${SLUG}`)), 'vitrine da Home não listou o publicado')
  })

  await step('editar após publicar não muda o público até republicar', async () => {
    await goStep(page, 'Apresentação')
    await page.getByLabel('Frase de apresentação').fill('Frase NOVA ainda não publicada.')
    await goStep(page, 'Revisão e publicação')
    await page.getByText('Há alterações não salvas.').waitFor()
    assert.equal(await page.getByRole('button', { name: /Publicar/ }).first().isDisabled(), true)
    await goStep(page, 'Apresentação')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Alterações salvas.').waitFor()
    assert.ok(!(await has(`/profissionais/${SLUG}`, /Frase NOVA/)), 'rascunho vazou para o público')
    await goStep(page, 'Revisão e publicação')
    await page.getByText('há alterações não publicadas').waitFor()
    await page.getByRole('button', { name: 'Publicar alterações' }).click()
    await page.getByText('Publicado. A página pública já foi atualizada.').waitFor()
    assert.ok(await has(`/profissionais/${SLUG}`, /Frase NOVA/), 'republicação não apareceu')
  })

  await step('edição concorrente: segunda aba com revisão antiga recebe aviso e nada é sobrescrito', async () => {
    const other = await context.newPage()
    await other.goto(editUrl)
    await other.getByLabel('Nome completo').waitFor()
    await goStep(page, 'Apresentação')
    await page.getByLabel('Frase de apresentação').fill('Alteração da aba 1')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Alterações salvas.').waitFor()
    await other.getByLabel('Especialidade').fill('Alteração da aba 2')
    await other.getByRole('button', { name: 'Salvar', exact: true }).click()
    await other.getByText(/Outra pessoa alterou este cadastro/).waitFor()
    await other.close()
  })

  await step('despublicar tira a página e a vitrine do ar; arquivar mantém fora; restaurar volta a rascunho', async () => {
    await goStep(page, 'Revisão e publicação')
    await page.getByRole('button', { name: 'Despublicar' }).click()
    await page.getByText('Página tirada do ar.').waitFor()
    assert.equal(await publicStatus(`/profissionais/${SLUG}`), 404)
    assert.ok(!(await has('/', new RegExp(`/profissionais/${SLUG}`))), 'despublicado ainda na vitrine')
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Arquivar' }).click()
    await page.getByText('Profissional arquivado.').waitFor()
    await page.getByRole('button', { name: 'Restaurar' }).click()
    await page.getByText('Profissional restaurado como rascunho.').waitFor()
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Arquivar' }).click()
    await page.getByText('Profissional arquivado.').waitFor()
  })

  await step('mobile 390px: lista e formulário sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 800 })
    for (const url of [`${BASE}/admin/profissionais`, editUrl, `${BASE}/profissionais/lukas-campos`]) {
      await page.goto(url)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 1, `overflow horizontal de ${overflow}px em ${url}`)
    }
  })

  await step('sem erros ou avisos de console em todo o fluxo', async () => {
    assert.deepEqual(consoleErrors, [])
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
