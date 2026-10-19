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
const letters = stamp.replace(/[0-9]/g, 'x')
const NAME = `Teste E2e${letters}`.slice(0, 40)
const BASE_SLUG = `e2e-pro-base-${stamp}`
const BASE_NAME = `Base E2e ${letters}`.slice(0, 40)
const DRAFT_SLUG = `e2e-pro-rasc-${stamp}`
const DRAFT_NAME = `Rascunho E2e ${letters}`.slice(0, 40)

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext()
const page = await context.newPage()
const consoleErrors: string[] = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`) })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('response', async (r) => { if (r.status() >= 400 && r.url().includes('/api/')) console.log(`[http ${r.status()}] ${r.request().method()} ${r.url()} ${(await r.text().catch(() => '')).slice(0, 300)}`) })
const results: string[] = []
const step = async (name: string, fn: () => Promise<void>) => { await fn(); results.push(`✓ ${name}`) }

const xsrf = async () => decodeURIComponent((await context.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? '')
const send = async (method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) => {
  const res = await context.request[method](`${BASE}/api${path}`, { headers: { 'x-xsrf-token': await xsrf() }, data })
  return { status: res.status(), body: (await res.json().catch(() => null)) as any }
}
const proData = (name: string) => ({
  name, specialty: 'Hair', tagline: 'Técnica e carreira.', experienceYears: 10, instagramHandle: '@e2e',
  instagramFollowers: '10 mil', instagramUrl: 'https://instagram.com/e2e', portraitSrc: '/site/profissional/lukas_perfil.png',
  cardPhotoSrc: '/site/home/lukas-campos.png', bio: ['Trajetória de dez anos.'], works: [],
})
const created: number[] = []

const waitUntil = async (what: string, check: () => Promise<boolean>, ms = 8000) => {
  const end = Date.now() + ms
  while (Date.now() < end) { if (await check()) return; await new Promise((r) => setTimeout(r, 250)) }
  assert.fail(`Tempo esgotado: ${what}`)
}
const goStep = (p: Page, label: string) => p.getByRole('button', { name: label }).click()
const publicStatus = async (path: string) => (await fetch(`${BASE}${path}`, { redirect: 'manual' })).status
const has = async (path: string, re: RegExp) => re.test(await publicHtml(path))
const publicHtml = async (path: string) => (await fetch(`${BASE}${path}`, { cache: 'no-store' })).text()

try {
  await step('login; cria um profissional publicado e um rascunho; a lista mostra o publicado', async () => {
    await page.goto(`${BASE}/admin/login`)
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/admin`)
    const base = await send('post', '/admin/professionals', { slug: BASE_SLUG, data: proData(BASE_NAME) })
    assert.equal(base.status, 201, JSON.stringify(base.body))
    created.push(base.body.id)
    assert.equal((await send('post', `/admin/professionals/${base.body.id}/publish`)).status, 200)
    assert.equal((await send('put', `/admin/professionals/${base.body.id}/showcase`, { homeVisible: true, homeOrder: 60, featured: false })).status, 200)
    const draft = await send('post', '/admin/professionals', { slug: DRAFT_SLUG, data: proData(DRAFT_NAME) })
    assert.equal(draft.status, 201, JSON.stringify(draft.body))
    created.push(draft.body.id)
    await page.getByRole('link', { name: 'Profissionais' }).click()
    await page.waitForURL('**/admin/profissionais')
    await page.getByRole('link', { name: BASE_NAME }).first().waitFor()
  })

  await step('página pública do publicado renderiza; rascunho e slug inexistente dão 404', async () => {
    const res = await page.goto(`${BASE}/profissionais/${BASE_SLUG}`)
    assert.equal(res?.status(), 200)
    await page.locator('h1.hero-name').filter({ hasText: 'Base' }).waitFor()
    assert.equal(await publicStatus(`/profissionais/${DRAFT_SLUG}`), 404) // rascunho
    assert.equal(await publicStatus('/profissionais/nao-existe-mesmo'), 404)
  })

  await step('a Home lista só publicados e liga para a página do profissional', async () => {
    await page.goto(`${BASE}/`)
    const links = await page.locator('a.professor-card-link').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    assert.ok(links.includes(`/profissionais/${BASE_SLUG}`), 'publicado deve aparecer na vitrine')
    assert.ok(!links.includes(`/profissionais/${DRAFT_SLUG}`), 'rascunho não pode aparecer na vitrine')
  })

  await step('galeria: escolhe o template (abre no editor); cadastro: etapa 1 valida nome e preenche slug', async () => {
    await page.goto(`${BASE}/admin/profissionais/novo`)
    await page.getByRole('button', { name: /Usar este template/ }).first().click()
    await page.waitForURL(/\/admin\/editor\/profissionais\/\d+$/)
    const draftId = page.url().split('/').pop()!
    created.push(Number(draftId))
    await page.goto(`${BASE}/admin/profissionais/${draftId}`)
    await page.getByLabel('Nome completo').fill('')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByRole('alert').first().waitFor()
    await page.getByLabel('Nome completo').fill(NAME)
    await page.getByLabel('Especialidade').fill('Barber')
    await page.getByLabel('Endereço da página (slug)').fill(SLUG)
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Alterações salvas.').waitFor()
  })

  const editUrl = page.url()
  const id = editUrl.split('/').pop()!

  await step('rascunho incompleto: publicar bloqueado e pendências listadas', async () => {
    await goStep(page, 'Revisão e publicação')
    await page.getByText('Pendências para publicar:').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Publicar', exact: true }).isDisabled(), true)
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
    // As imagens agora são escolhidas pelo seletor (biblioteca). Aqui se confere que a API recusa caminho perigoso e aceita o válido.
    const row = await send('get', `/admin/professionals/${id}`)
    const bad = await send('put', `/admin/professionals/${id}`, { revision: row.body.revision, data: { ...row.body.data, portraitSrc: 'javascript:alert(1)' } })
    assert.equal(bad.status, 422)
    const ok = await send('put', `/admin/professionals/${id}`, { revision: row.body.revision, data: { ...row.body.data, portraitSrc: '/site/profissional/lukas_perfil.png', cardPhotoSrc: '/site/home/lukas-campos.png' } })
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    await page.reload()

    await goStep(page, 'Trajetória e trabalhos')
    await page.getByRole('button', { name: 'Adicionar parágrafo' }).click()
    await page.getByLabel('Parágrafo 1').fill('Trajetória do profissional de teste.')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Alterações salvas.').waitFor()
    // O trabalho exige imagem, escolhida pelo seletor (biblioteca): aqui entra pela API.
    const row2 = await send('get', `/admin/professionals/${id}`)
    const works = [{ imageSrc: '/site/profissional/trabLukas01.png', alt: 'Corte de teste', title: 'Corte Teste', tags: [] }]
    assert.equal((await send('put', `/admin/professionals/${id}`, { revision: row2.body.revision, data: { ...row2.body.data, works } })).status, 200)
    await page.reload()
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
    await waitUntil('página do profissional fora do ar', async () => (await publicStatus(`/profissionais/${SLUG}`)) === 404)
    await waitUntil('profissional fora da vitrine da Home', async () => !(await has('/', new RegExp(`/profissionais/${SLUG}`))))
    await page.getByRole('button', { name: 'Arquivar' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Arquivar' }).click()
    await page.getByText('Profissional arquivado.').waitFor()
    await page.getByRole('button', { name: 'Restaurar' }).click()
    await page.getByText('Profissional restaurado como rascunho.').waitFor()
    await page.getByRole('button', { name: 'Arquivar' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Arquivar' }).click()
    await page.getByText('Profissional arquivado.').waitFor()
  })

  await step('mobile 390px: lista e formulário sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 800 })
    for (const url of [`${BASE}/admin/profissionais`, editUrl, `${BASE}/profissionais/${BASE_SLUG}`]) {
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
  try {
    for (const professionalId of created) {
      await send('post', `/admin/professionals/${professionalId}/unpublish`)
      await send('post', `/admin/professionals/${professionalId}/archive`)
    }
  } catch (error) {
    console.error('limpeza falhou:', error)
  }
  await browser.close()
}
