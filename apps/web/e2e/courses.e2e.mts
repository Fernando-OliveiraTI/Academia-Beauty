/**
 * E2E do módulo de cursos e comércio Modo A no editor único (D-039): criação pela galeria direto no editor,
 * Configurações (dados e oferta com link de checkout validado), pendências que levam às seções, conteúdo escrito
 * na página indo para o cadastro, publicação com confirmação, página pública (preço do backend, redirecionamento),
 * vitrine no profissional, snapshot (alterar preço só vale após republicar), oferta inativa e despublicação.
 * Requer API (3333) com migrações, CHECKOUT_ALLOWED_HOSTS=pay.example.com e PUBLIC_SHOW_DRAFTS=false. Cria o próprio profissional
 * e um curso publicado (`e2e-*`, apagados no fim); não depende do seed.
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
const letters = stamp.replace(/[0-9]/g, 'x')
const PRO_SLUG = `e2e-cur-prof-${stamp}`
const PRO_NAME = `Prof Cursos ${letters}`.slice(0, 40)
const SEED_SLUG = `e2e-cur-base-${stamp}`
const SEED_TITLE = `Morena Base ${letters}`.slice(0, 40)
const SEED_CHECKOUT = `https://pay.example.com/${SEED_SLUG}`

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
const professionalData = (name: string) => ({
  name, specialty: 'Hair', tagline: 'Técnica e carreira.', experienceYears: 10, instagramHandle: '@e2e',
  instagramFollowers: '10 mil', instagramUrl: 'https://instagram.com/e2e', portraitSrc: '/site/profissional/lukas_perfil.png',
  cardPhotoSrc: '/site/home/lukas-campos.png', bio: ['Trajetória de dez anos.'], works: [],
})
const courseData = (title: string) => ({
  title, lead: 'A metodologia de corte para valorizar a cor.', modality: 'online', level: 'profissional', workloadHours: 8,
  audience: 'Cabeleireiros', coverSrc: '/site/curso/produto-morena-iluminada.svg', coverAlt: 'Capa do curso',
  benefits: [{ title: 'Mais brilho', text: 'Cortes que realçam a cor.' }], modules: [{ title: 'Corte e cor', text: 'Leitura da coloração.', bullets: ['Diagnóstico'] }],
  deliverables: [{ title: 'Aulas', text: 'Método completo.' }], faq: [], testimonials: [], guaranteeDays: null,
})
const createdCourses: number[] = []
let professionalId = 0

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
/** Abre a lista de pendências (pelo aviso) e segue a do texto informado até a seção/campo. */
const goIssue = async (p: Page, text: string) => {
  if (!(await p.locator('.ed-issues').isVisible())) await p.getByRole('button', { name: 'Ver pendências' }).click()
  await p.locator('.ed-issues-list li', { hasText: text }).getByRole('button').click()
}
const publishOk = async (p: Page) => {
  await p.getByRole('button', { name: 'Publicar', exact: true }).click()
  await p.getByRole('dialog', { name: 'Publicado!' }).waitFor()
  await p.getByRole('button', { name: 'Continuar editando' }).click()
}
const publicStatus = async (path: string) => (await fetch(`${BASE}${path}`, { redirect: 'manual' })).status
const publicHtml = async (path: string) => (await fetch(`${BASE}${path}`, { cache: 'no-store' })).text()
const decode = (html: string) => html.replace(/&nbsp;| /g, ' ').replace(/&#x27;/g, "'")

try {
  await step('login; cria profissional e curso publicado (preço R$ 250 − 30%); a lista mostra o curso', async () => {
    await page.goto(`${BASE}/admin/login`)
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/admin`)
    const pro = await send('post', '/admin/professionals', { slug: PRO_SLUG, data: professionalData(PRO_NAME) })
    assert.equal(pro.status, 201, JSON.stringify(pro.body))
    professionalId = pro.body.id
    assert.equal((await send('post', `/admin/professionals/${professionalId}/publish`)).status, 200)
    const course = await send('post', '/admin/courses', { professionalId, slug: SEED_SLUG, data: courseData(SEED_TITLE) })
    assert.equal(course.status, 201, JSON.stringify(course.body))
    createdCourses.push(course.body.id)
    assert.equal((await send('put', `/admin/courses/${course.body.id}/commercial`, { listCents: 25000, discountPct: 30, maxInstallments: 6, checkoutUrl: SEED_CHECKOUT, environment: 'production', active: true, revision: 0 })).status, 200)
    assert.equal((await send('post', `/admin/courses/${course.body.id}/publish`)).status, 200)
    await page.getByRole('link', { name: 'Cursos' }).click()
    await page.waitForURL('**/admin/cursos')
    await page.getByRole('link', { name: SEED_TITLE }).first().waitFor()
  })

  await step('curso base: página pública no Modo A (preço do backend, botões levam ao checkout, sem formulário)', async () => {
    const res = await page.goto(`${BASE}/cursos/${SEED_SLUG}`)
    assert.equal(res?.status(), 200)
    await page.locator('h1.hero-title').filter({ hasText: 'Morena' }).waitFor()
    // Fase 10A: o checkout em 3 etapas existe na página, mas em Modo A nada do formulário é enviado.
    assert.equal(await page.locator('#checkout').count(), 1, 'checkout em 3 etapas (Modo A)')
    assert.equal(await page.locator('#checkout form[action]').count(), 0, 'o formulário não envia dados a lugar nenhum')
    const hrefs = await page.locator('a[data-cta]').evaluateAll((els) => els.map((e) => [e.getAttribute('href'), e.getAttribute('rel')]))
    assert.ok(hrefs.length >= 5)
    for (const [href, rel] of hrefs) {
      assert.equal(href, SEED_CHECKOUT)
      assert.match(rel ?? '', /noopener/)
    }
    const text = decode(await page.locator('body').innerText())
    assert.match(text, /R\$ 175,00/)
    assert.match(text, /30% OFF/)
    assert.doesNotMatch(text, /Depoimentos de exemplo|garantia/i, 'conteúdo não cadastrado não pode aparecer')
  })

  await step('a página do profissional lista o curso publicado', async () => {
    await page.goto(`${BASE}/profissionais/${PRO_SLUG}`)
    const href = await page.locator('a.course-card').first().getAttribute('href')
    assert.equal(href, `/cursos/${SEED_SLUG}`)
  })

  let id = ''
  let editUrl = ''

  await step('galeria: escolhe o profissional e o template; o rascunho abre no editor; Configurações gravam título e endereço', async () => {
    await page.goto(`${BASE}/admin/cursos/novo`)
    assert.equal(await page.getByRole('button', { name: /Usar este template/ }).first().isDisabled(), true, 'sem profissional não cria')
    await page.locator('label.pro-card', { hasText: PRO_NAME }).click()
    await page.getByRole('button', { name: /Usar este template/ }).first().click()
    await page.waitForURL(/\/admin\/editor\/cursos\/\d+$/)
    editUrl = page.url()
    id = editUrl.split('/').pop()!
    createdCourses.push(Number(id))
    await page.locator('.ed-item').first().waitFor()
    await settings(page)
    await page.getByLabel('Título do curso').fill(TITLE)
    await page.getByLabel('Endereço da página').fill(SLUG)
    await page.getByRole('button', { name: 'Salvar configurações' }).click()
    await page.getByText('Configurações salvas.').waitFor()
    assert.equal((await send('get', `/admin/courses/${id}`)).body.slug, SLUG)
  })

  await step('rascunho vazio: publicar lista as pendências no editor; pré-visualização já renderiza com conteúdo provisório', async () => {
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    // O aviso "Não publicado" cobre o editor: "Ver pendências" fecha e deixa a lista no painel.
    await page.getByRole('dialog', { name: 'Não publicado' }).getByRole('button', { name: 'Ver pendências' }).click()
    await page.getByRole('heading', { name: /Faltam \d+ itens para publicar/ }).waitFor()
    const items = await page.locator('.ed-issues-list li').allInnerTexts()
    for (const msg of ['Escreva a descrição do curso', 'Informe ao menos um benefício', 'Informe ao menos um módulo', 'Informe o que o aluno recebe', 'Configure a oferta']) {
      assert.ok(items.some((t) => t.includes(msg)), `pendência ausente: ${msg} (${items.join(' | ')})`)
    }
    assert.ok(!items.some((t) => /para quem é o curso/i.test(t)), 'público não é mais exigido')
    const preview = await context.newPage()
    await preview.goto(`${BASE}/admin/preview/cursos/${id}`)
    await preview.locator('h1.hero-title').waitFor()
    await preview.close()
  })

  await step('conteúdo escrito nas seções (marcação recusada); listas vazias trazem o item provisório, não o exemplo de outro curso', async () => {
    await goIssue(page, 'descrição do curso')
    await field(page, 'lead').fill('Descrição <b>do</b> curso')
    await page.getByRole('status').filter({ hasText: 'Corrija os campos para salvar' }).waitFor()
    await field(page, 'lead').fill('Um curso de teste sobre técnica e carreira.')
    await field(page, 'image.alt').fill('Capa do curso de teste')
    await goIssue(page, 'benefício')
    assert.equal(await field(page, 'cards.0.title').inputValue(), 'Preencha este item')
    await field(page, 'cards.0.title').fill('Mais técnica')
    await field(page, 'cards.0.text').fill('Aprenda com quem faz.')
    await goIssue(page, 'módulo')
    await field(page, 'modules.0.title').fill('Fundamentos')
    await field(page, 'modules.0.text').fill('Base do método.')
    await goIssue(page, 'o aluno recebe')
    assert.equal(await field(page, 'items.0.title').inputValue(), 'Preencha este item')
    await field(page, 'items.0.title').fill('Aulas gravadas')
    await field(page, 'items.0.text').fill('Acesso ao conteúdo completo.')
    await saved(page)
    const data = (await send('get', `/admin/courses/${id}`)).body.data
    assert.equal(data.lead, 'Um curso de teste sobre técnica e carreira.')
    assert.deepEqual(data.benefits, [{ title: 'Mais técnica', text: 'Aprenda com quem faz.' }])
    assert.equal(data.modules[0].title, 'Fundamentos')
    assert.deepEqual(data.deliverables, [{ title: 'Aulas gravadas', text: 'Acesso ao conteúdo completo.' }])
    assert.doesNotMatch(JSON.stringify(data), /Lukas Campos|Mais brilho na cor/, 'exemplo do template não pode virar conteúdo')
  })

  await step('capa: a API recusa caminho perigoso e aceita o válido (a capa da página vai para o cadastro)', async () => {
    const state = await send('get', `/admin/courses/${id}/document`)
    const withCover = (src: string) => ({ ...state.body.document, sections: state.body.document.sections.map((x: any) => (x.type === 'course.hero' ? { ...x, content: { ...x.content, image: { ...x.content.image, src } } } : x)) })
    assert.equal((await send('put', `/admin/courses/${id}/document`, { document: withCover('javascript:alert(1)'), revision: state.body.documentRevision })).status, 422)
    assert.equal((await send('put', `/admin/courses/${id}/document`, { document: withCover('/site/curso/produto-morena-iluminada.svg'), revision: state.body.documentRevision })).status, 200)
    assert.equal((await send('get', `/admin/courses/${id}`)).body.data.coverSrc, '/site/curso/produto-morena-iluminada.svg')
    await page.reload()
    await page.locator('.ed-item').first().waitFor()
  })

  await step('oferta (Configurações): preço inválido e link fora da lista ou sem https são recusados', async () => {
    await settings(page)
    await page.getByLabel('De (R$)').fill('abc')
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText('Corrija os campos de preço destacados.').waitFor()
    await page.getByLabel('De (R$)').fill('199,90')
    await page.getByLabel('Por (R$)').fill('179,91')
    await page.getByLabel('Parcelas máximas (sem juros, exibição)').selectOption('3')
    await page.getByLabel('Link do checkout (https)').fill('https://malicioso.example.org/pagar')
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/domínio de checkout não autorizado/i).first().waitFor()
    await page.getByLabel('Link do checkout (https)').fill('http://pay.example.com/c/x')
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/deve usar https/i).first().waitFor()
  })

  await step('oferta válida: prévia do valor e gravação', async () => {
    await page.getByLabel('Link do checkout (https)').fill(CHECKOUT)
    await page.getByLabel('Oferta ativa (permite publicar o curso)').check()
    await page.getByText(/Valor final:\s*R\$\s*179,91/).waitFor()
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

  await step('publica com confirmação: página pública e vitrine do profissional atualizam na hora', async () => {
    await publishOk(page)
    const html = decode(await publicHtml(`/cursos/${SLUG}`))
    assert.match(html, /R\$ 179,91/)
    assert.match(html, /10% OFF/)
    assert.ok(html.includes(`href="${CHECKOUT}"`))
    assert.match(html, /3x de R\$ 59,97/)
    assert.doesNotMatch(html, /Lukas Campos por.*garantia/)
    assert.match(await publicHtml(`/profissionais/${PRO_SLUG}`), new RegExp(`href="/cursos/${SLUG}"`))
  })

  await step('alterar o preço não muda a página pública até republicar (snapshot)', async () => {
    await settings(page)
    await page.getByLabel('De (R$)').fill('300,00')
    await page.getByLabel('Por (R$)').fill('270,00')
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/Oferta salva/).waitFor()
    assert.match(decode(await publicHtml(`/cursos/${SLUG}`)), /R\$ 179,91/)
    assert.equal((await send('get', `/admin/courses/${id}`)).body.hasUnpublishedChanges, true)
    await publishOk(page)
    const html = decode(await publicHtml(`/cursos/${SLUG}`))
    assert.match(html, /R\$ 270,00/)
    assert.doesNotMatch(html, /R\$ 179,91/)
  })

  await step('oferta desativada: publicar aponta "Ative a oferta" e leva às Configurações; reativar libera', async () => {
    await settings(page)
    await page.getByLabel('Oferta ativa (permite publicar o curso)').uncheck()
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/Oferta salva/).waitFor()
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    // O aviso "Não publicado" cobre o editor: "Ver pendências" fecha e deixa a lista no painel.
    await page.getByRole('dialog', { name: 'Não publicado' }).getByRole('button', { name: 'Ver pendências' }).click()
    await page.locator('.ed-issues-list li', { hasText: 'Ative a oferta' }).waitFor()
    await goIssue(page, 'Ative a oferta')
    await page.getByRole('heading', { name: 'Configurações', exact: true }).waitFor()
    await page.getByLabel('Oferta ativa (permite publicar o curso)').check()
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText(/Oferta salva/).waitFor()
  })

  await step('despublicar (editor) tira a página e o cartão do ar; arquivar e restaurar pela lista', async () => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: /Despublicar/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Despublicar' }).click()
    await waitUntil('curso em rascunho na API', async () => (await send('get', `/admin/courses/${id}`)).body.status === 'draft')
    await page.waitForLoadState('load')
    // A invalidação do cache público termina logo depois da resposta: espera em vez de checar no mesmo instante.
    await waitUntil('página do curso fora do ar', async () => (await publicStatus(`/cursos/${SLUG}`)) === 404)
    await waitUntil('cartão fora da vitrine do profissional', async () => !new RegExp(SLUG).test(await publicHtml(`/profissionais/${PRO_SLUG}`)))
    await page.goto(`${BASE}/admin/cursos?q=${encodeURIComponent(SLUG)}`)
    await page.getByRole('button', { name: `Mais ações para ${TITLE}` }).click()
    await page.getByRole('menuitem', { name: 'Arquivar' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Arquivar' }).click()
    await waitUntil('arquivado', async () => (await send('get', `/admin/courses/${id}`)).body.status === 'archived')
    await page.goto(`${BASE}/admin/cursos?status=archived&q=${encodeURIComponent(SLUG)}`)
    await page.getByRole('button', { name: `Mais ações para ${TITLE}` }).click()
    await page.getByRole('menuitem', { name: 'Restaurar' }).click()
    await waitUntil('restaurado', async () => (await send('get', `/admin/courses/${id}`)).body.status === 'draft')
  })

  await step('lista filtra por profissional (cartões) e o link antigo do cadastro leva ao editor', async () => {
    await page.goto(`${BASE}/admin/cursos`)
    await page.locator('.pf-chip', { hasText: PRO_NAME }).click()
    await page.waitForURL(new RegExp(`professionalId=${professionalId}`))
    await page.getByRole('link', { name: SEED_TITLE }).first().waitFor()
    await page.goto(`${BASE}/admin/cursos/${id}`)
    await page.waitForURL(`**/admin/editor/cursos/${id}`)
  })

  await step('mobile 390px: páginas do módulo sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 800 })
    for (const url of [`${BASE}/admin/cursos`, editUrl, `${BASE}/cursos/${SEED_SLUG}`]) {
      await page.goto(url)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 1, `overflow horizontal de ${overflow}px em ${url}`)
    }
  })

  await step('sem erros ou avisos de console, exceto as 4 recusas 422 provocadas de propósito (2 publicações com pendência, link fora da lista e http)', async () => {
    const expected = consoleErrors.filter((e) => e.includes('status of 422'))
    assert.equal(expected.length, 4)
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
    // Apaga (não só arquiva) o que o teste criou: cursos antes do profissional.
    for (const courseId of createdCourses) {
      await send('post', `/admin/courses/${courseId}/unpublish`)
      await send('delete', `/admin/courses/${courseId}`)
    }
    if (professionalId) {
      await send('post', `/admin/professionals/${professionalId}/unpublish`)
      await send('delete', `/admin/professionals/${professionalId}`)
    }
  } catch (error) {
    console.error('limpeza falhou:', error)
  }
  await browser.close()
}
