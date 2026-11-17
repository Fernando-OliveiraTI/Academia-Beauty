/**
 * E2E do módulo de profissionais no editor único (D-039): criação pela galeria direto no editor, Configurações
 * (identidade e vitrine), pendências de publicação que levam ao campo, página → cadastro, publicação com confirmação,
 * página pública, vitrine da Home, alterações não publicadas, conflito entre abas, despublicar, arquivar e restaurar.
 * Tudo o que cria (`e2e-*`) é apagado no fim.
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
const saved = (p: Page) => p.getByRole('status').filter({ hasText: 'salvo' }).waitFor({ timeout: 10_000 })
const field = (p: Page, path: string) => p.locator(`[data-field-path="${path}"]`).locator('input, textarea').first()
const section = async (p: Page, name: string) => {
  await p.locator('.ed-item').filter({ has: p.locator('.ed-name', { hasText: name }) }).locator('.ed-select').click()
  await p.getByRole('tab', { name: 'Conteúdo' }).click()
}
const settings = async (p: Page) => { if (!(await p.getByRole('heading', { name: 'Configurações', exact: true }).isVisible())) await p.getByRole('button', { name: 'Configurações', exact: true }).click(); await p.getByRole('heading', { name: 'Configurações', exact: true }).waitFor() }
const publishOk = async (p: Page) => {
  await p.getByRole('button', { name: 'Publicar', exact: true }).click()
  await p.getByRole('dialog', { name: 'Publicado!' }).waitFor()
  await p.getByRole('button', { name: 'Continuar editando' }).click()
}
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

  let id = ''
  let editUrl = ''

  await step('galeria: escolhe o template e cai no editor; Configurações validam o nome e gravam nome, especialidade e endereço', async () => {
    await page.goto(`${BASE}/admin/profissionais/novo`)
    await page.getByRole('button', { name: /Usar este template/ }).first().click()
    await page.waitForURL(/\/admin\/editor\/profissionais\/\d+$/)
    editUrl = page.url()
    id = editUrl.split('/').pop()!
    created.push(Number(id))
    await page.locator('.ed-item').first().waitFor()
    await settings(page)
    await page.getByLabel('Nome completo').fill('')
    await page.getByRole('button', { name: 'Salvar configurações' }).click()
    await page.getByText('Corrija os campos destacados.').waitFor()
    await page.getByLabel('Nome completo').fill('<script>alert(1)</script>') // marcação recusada no cliente
    await page.getByRole('button', { name: 'Salvar configurações' }).click()
    await page.getByText('Corrija os campos destacados.').waitFor()
    await page.getByLabel('Nome completo').fill(NAME)
    await page.getByLabel('Especialidade').fill('Barber')
    await page.getByLabel('Endereço da página').fill(SLUG)
    await page.getByRole('button', { name: 'Salvar configurações' }).click()
    await page.getByText('Configurações salvas.').waitFor()
    const row = await send('get', `/admin/professionals/${id}`)
    assert.equal(row.body.data.name, NAME)
    assert.equal(row.body.slug, SLUG)
  })

  await step('rascunho incompleto: publicar lista as pendências no próprio editor (sem sair dele)', async () => {
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    // O aviso "Não publicado" cobre o editor: "Ver pendências" fecha e deixa a lista no painel.
    await page.getByRole('dialog', { name: 'Não publicado' }).getByRole('button', { name: 'Ver pendências' }).click()
    await page.getByRole('heading', { name: /Faltam \d+ itens para publicar/ }).waitFor()
    const items = await page.locator('.ed-issues-list li').allInnerTexts()
    for (const msg of ['Informe os anos de experiência', 'Informe a frase de apresentação', 'Escreva ao menos um parágrafo de trajetória', 'Informe a foto do cartão da Home']) {
      assert.ok(items.some((t) => t.includes(msg)), `pendência ausente: ${msg} (${items.join(' | ')})`)
    }
    assert.match(page.url(), /\/admin\/editor\/profissionais\/\d+$/, 'continua no editor')
  })

  await step('pendência leva ao campo da seção; preencher na página resolve a pendência e vai para o cadastro', async () => {
    await page.locator('.ed-issues-list li', { hasText: 'anos de experiência' }).getByRole('button').click()
    await page.waitForFunction(() => document.activeElement?.closest('[data-field-path]')?.getAttribute('data-field-path') === 'hud.accent')
    await page.locator('[data-field-path="hud.accent"][data-pending-field]').waitFor()
    await page.keyboard.type('7')
    await field(page, 'sub').fill('Técnica, ritmo e carreira.')
    await section(page, 'Trajetória')
    await field(page, 'paragraphs.0').fill('Trajetória do profissional de teste.')
    await field(page, 'instagram.handle').fill('@teste')
    await field(page, 'instagram.followers').fill('1 Mil seguidores')
    await field(page, 'instagram.href').fill('https://instagram.com/teste')
    await saved(page)
    await page.getByRole('button', { name: 'Ver pendências' }).click()
    const items = await page.locator('.ed-issues-list li').allInnerTexts()
    assert.ok(items.filter((t) => /resolvido/i.test(t)).length >= 4, items.join(' | '))
    const row = await send('get', `/admin/professionals/${id}`)
    assert.equal(row.body.data.experienceYears, 7)
    assert.equal(row.body.data.tagline, 'Técnica, ritmo e carreira.')
    assert.deepEqual(row.body.data.bio, ['Trajetória do profissional de teste.'])
    assert.equal(row.body.data.instagramUrl, 'https://instagram.com/teste')
  })

  await step('imagens: a API recusa caminho perigoso e aceita o válido (retrato na página, foto do cartão no cadastro)', async () => {
    // As imagens são escolhidas pelo seletor da biblioteca; aqui entram pela API para não depender de envio.
    const state = await send('get', `/admin/professionals/${id}/document`)
    const withPortrait = (src: string) => ({ ...state.body.document, sections: state.body.document.sections.map((s: any) => (s.type === 'professional.hero' ? { ...s, content: { ...s.content, portrait: { ...s.content.portrait, src } } } : s)) })
    assert.equal((await send('put', `/admin/professionals/${id}/document`, { document: withPortrait('javascript:alert(1)'), revision: state.body.documentRevision })).status, 422)
    assert.equal((await send('put', `/admin/professionals/${id}/document`, { document: withPortrait('/site/profissional/lukas_perfil.png'), revision: state.body.documentRevision })).status, 200)
    const row = await send('get', `/admin/professionals/${id}`)
    assert.equal(row.body.data.portraitSrc, '/site/profissional/lukas_perfil.png', 'o retrato da página vai para o cadastro')
    assert.equal((await send('put', `/admin/professionals/${id}`, { revision: row.body.revision, data: { ...row.body.data, cardPhotoSrc: 'javascript:alert(1)' } })).status, 422)
    assert.equal((await send('put', `/admin/professionals/${id}`, { revision: row.body.revision, data: { ...row.body.data, cardPhotoSrc: '/site/home/lukas-campos.png' } })).status, 200)
    await page.reload()
    await page.locator('.ed-item').first().waitFor()
  })

  await step('pré-visualização do rascunho renderiza com os dados e não é pública', async () => {
    const preview = await context.newPage()
    await preview.goto(`${BASE}/admin/preview/profissionais/${id}`)
    await preview.locator('h1.hero-name').waitFor()
    assert.match(await preview.locator('h1.hero-name').innerText(), /Novo|Teste/i)
    await preview.close()
    assert.equal(await publicStatus(`/profissionais/${SLUG}`), 404)
    assert.equal(await publicStatus(`/admin/preview/profissionais/${id}`), 307) // sem sessão → login
  })

  await step('publica com confirmação: página pública e vitrine da Home atualizam na hora', async () => {
    await settings(page)
    await page.getByLabel('Exibir na Home').check()
    await page.getByLabel('Posição (menor aparece primeiro)').fill('50')
    await page.getByRole('button', { name: 'Salvar vitrine' }).click()
    await page.getByText('Vitrine atualizada.').waitFor()
    await publishOk(page)
    assert.equal(await publicStatus(`/profissionais/${SLUG}`), 200)
    assert.ok(await has(`/profissionais/${SLUG}`, /Trajetória do profissional de teste\./), 'bio publicada ausente')
    assert.ok(await has('/', new RegExp(`/profissionais/${SLUG}`)), 'vitrine da Home não listou o publicado')
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: /Despublicar/ }).waitFor() // a situação muda sem recarregar
    await page.keyboard.press('Escape')
  })

  await step('editar após publicar não muda o público até republicar', async () => {
    await section(page, 'Topo (hero)')
    await field(page, 'sub').fill('Frase NOVA ainda não publicada.')
    await saved(page)
    assert.ok(!(await has(`/profissionais/${SLUG}`, /Frase NOVA/)), 'rascunho vazou para o público')
    assert.equal((await send('get', `/admin/professionals/${id}`)).body.hasUnpublishedChanges, true)
    await publishOk(page)
    await waitUntil('republicação no ar', () => has(`/profissionais/${SLUG}`, /Frase NOVA/))
  })

  await step('edição concorrente: a segunda aba com revisão antiga é bloqueada e nada é sobrescrito', async () => {
    const other = await context.newPage()
    await other.goto(editUrl)
    await other.locator('.ed-item').first().waitFor()
    await section(page, 'Topo (hero)')
    await field(page, 'sub').fill('Alteração da aba 1')
    await saved(page)
    await section(other, 'Topo (hero)')
    await field(other, 'sub').fill('Alteração da aba 2')
    await other.getByRole('alert').filter({ hasText: 'Outra pessoa alterou esta página' }).waitFor({ timeout: 10_000 })
    await other.close()
    assert.equal((await send('get', `/admin/professionals/${id}`)).body.data.tagline, 'Alteração da aba 1')
  })

  await step('despublicar (editor) tira a página e a vitrine do ar; arquivar e restaurar pela lista', async () => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: /Despublicar/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Despublicar' }).click()
    await page.waitForLoadState('load')
    await waitUntil('página do profissional fora do ar', async () => (await publicStatus(`/profissionais/${SLUG}`)) === 404)
    await waitUntil('profissional fora da vitrine da Home', async () => !(await has('/', new RegExp(`/profissionais/${SLUG}`))))
    await page.goto(`${BASE}/admin/profissionais?q=${encodeURIComponent(SLUG)}`)
    await page.getByRole('button', { name: `Mais ações para ${NAME}` }).click()
    await page.getByRole('menuitem', { name: 'Arquivar' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Arquivar' }).click()
    await waitUntil('arquivado', async () => (await send('get', `/admin/professionals/${id}`)).body.status === 'archived')
    await page.goto(`${BASE}/admin/profissionais?status=archived&q=${encodeURIComponent(SLUG)}`)
    await page.getByRole('button', { name: `Mais ações para ${NAME}` }).click()
    await page.getByRole('menuitem', { name: 'Restaurar' }).click()
    await waitUntil('restaurado como rascunho', async () => (await send('get', `/admin/professionals/${id}`)).body.status === 'draft')
  })

  await step('link antigo do cadastro leva ao editor', async () => {
    await page.goto(`${BASE}/admin/profissionais/${id}`)
    await page.waitForURL(`**/admin/editor/profissionais/${id}`)
  })

  await step('mobile 390px: lista e formulário sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 800 })
    for (const url of [`${BASE}/admin/profissionais`, editUrl, `${BASE}/profissionais/${BASE_SLUG}`]) {
      await page.goto(url)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 1, `overflow horizontal de ${overflow}px em ${url}`)
    }
  })

  await step('sem erros ou avisos de console, exceto a recusa 422 de publicar com pendências (provocada de propósito)', async () => {
    assert.equal(consoleErrors.filter((e) => e.includes('status of 422')).length, 1)
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
  try {
    // Apaga (não só arquiva) o que o teste criou: nada de `e2e-*` sobrando na lista.
    for (const professionalId of created) {
      await send('post', `/admin/professionals/${professionalId}/unpublish`)
      await send('delete', `/admin/professionals/${professionalId}`)
    }
  } catch (error) {
    console.error('limpeza falhou:', error)
  }
  await browser.close()
}
