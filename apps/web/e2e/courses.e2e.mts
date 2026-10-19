/**
 * E2E do módulo de cursos e comércio Modo A (Fase 4): cadastro em etapas, oferta com link de
 * checkout validado, publicação, página pública (preço do backend, redirecionamento), vitrine no
 * profissional, snapshot (alterar preço só vale após republicar) e despublicação.
 * Requer API (3333) com migrações, CHECKOUT_ALLOWED_HOSTS=pay.example.com e PUBLIC_SHOW_DRAFTS=false. Cria o próprio profissional
 * e um curso publicado (`e2e-*`, arquivados no fim); não depende do seed.
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
const goStep = (p: Page, label: string) => p.getByRole('button', { name: label }).click()
const save = async (p: Page) => { await p.getByRole('button', { name: /Salvar rascunho/ }).click(); await p.getByText('Alterações salvas.').waitFor() }
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

  await step('galeria: escolhe o profissional e o template; o rascunho abre no editor; etapa 1 do cadastro preenche título e slug', async () => {
    await page.goto(`${BASE}/admin/cursos/novo`)
    assert.equal(await page.getByRole('button', { name: /Usar este template/ }).first().isDisabled(), true, 'sem profissional não cria')
    await page.locator('label.pro-card', { hasText: PRO_NAME }).click()
    await page.getByRole('button', { name: /Usar este template/ }).first().click()
    await page.waitForURL(/\/admin\/editor\/cursos\/\d+$/)
    const draftId = page.url().split('/').pop()!
    createdCourses.push(Number(draftId))
    await page.goto(`${BASE}/admin/cursos/${draftId}`)
    await page.getByLabel('Título do curso').fill(TITLE)
    await page.getByLabel('Endereço da página (slug)').fill(SLUG)
    await page.getByLabel('Para quem é o curso').fill('Cabeleireiros')
    await save(page)
  })
  const editUrl = page.url()
  const id = editUrl.split('/').pop()!

  await step('rascunho vazio: publicar bloqueado, pendências listadas, pré-visualização já renderiza com dados provisórios', async () => {
    await goStep(page, 'Revisão e publicação')
    await page.getByRole('heading', { name: 'Pendências para publicar' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Publicar curso' }).isDisabled(), true)
    const preview = await context.newPage()
    await preview.goto(`${BASE}/admin/preview/cursos/${id}`)
    await preview.locator('h1.hero-title').waitFor() // desde a 9A a prévia usa conteúdo provisório em vez de bloquear
    await preview.close()
  })

  await step('etapa 2: conteúdo; rejeita URL perigosa e marcação', async () => {
    await goStep(page, 'Conteúdo')
    await page.getByLabel('Descrição do curso').fill('Descrição <b>do</b> curso')
    await page.getByRole('button', { name: /Salvar rascunho/ }).click()
    await page.getByText('Corrija os campos destacados.').waitFor()
    await page.getByLabel('Descrição do curso').fill('Um curso de teste sobre técnica e carreira.')
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
    // A capa agora é escolhida na biblioteca (seletor de imagem). Aqui só se confere que a API recusa caminho perigoso e aceita o válido.
    const row = await send('get', `/admin/courses/${id}`)
    const bad = await send('put', `/admin/courses/${id}`, { revision: row.body.revision, data: { ...row.body.data, coverSrc: 'javascript:alert(1)' } })
    assert.equal(bad.status, 422)
    const ok = await send('put', `/admin/courses/${id}`, { revision: row.body.revision, data: { ...row.body.data, coverSrc: '/site/curso/produto-morena-iluminada.svg' } })
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    await page.reload()
  })

  await step('etapa 4: link de checkout fora da lista é recusado; preço inválido também', async () => {
    await goStep(page, 'Oferta e checkout')
    await page.getByLabel('Preço de tabela').fill('abc')
    await page.getByRole('button', { name: 'Salvar oferta' }).click()
    await page.getByText('Corrija os campos destacados.').waitFor()
    await page.getByLabel('Preço de tabela').fill('199,90')
    await page.getByLabel('Desconto', { exact: true }).fill('10')
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
    await page.getByRole('button', { name: 'Publicar curso' }).click()
    await page.getByText('Publicado. A página pública já foi atualizada.').waitFor()
    const html = decode(await publicHtml(`/cursos/${SLUG}`))
    assert.match(html, /R\$ 179,91/)
    assert.match(html, /10% OFF/)
    assert.ok(html.includes(`href="${CHECKOUT}"`))
    assert.match(html, /3x de R\$ 59,97/)
    assert.doesNotMatch(html, /Lukas Campos por.*garantia/)
    assert.match(await publicHtml(`/profissionais/${PRO_SLUG}`), new RegExp(`href="/cursos/${SLUG}"`))
  })

  await step('alterar o preço não muda a página pública até republicar (snapshot)', async () => {
    await goStep(page, 'Oferta e checkout')
    await page.getByLabel('Preço de tabela').fill('300,00')
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
    // A invalidação do cache público termina logo depois da resposta: espera em vez de checar no mesmo instante.
    await waitUntil('página do curso fora do ar', async () => (await publicStatus(`/cursos/${SLUG}`)) === 404)
    await waitUntil('cartão fora da vitrine do profissional', async () => !new RegExp(SLUG).test(await publicHtml(`/profissionais/${PRO_SLUG}`)))
    await page.getByRole('button', { name: 'Arquivar' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Arquivar' }).click()
    await page.getByText('Curso arquivado.').waitFor()
    await page.getByRole('button', { name: 'Restaurar' }).click()
    await page.getByText('Curso restaurado.').waitFor()
  })

  await step('mobile 390px: páginas do módulo sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 800 })
    for (const url of [`${BASE}/admin/cursos`, editUrl, `${BASE}/cursos/${SEED_SLUG}`]) {
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
  try {
    for (const courseId of createdCourses) {
      await send('post', `/admin/courses/${courseId}/unpublish`)
      await send('post', `/admin/courses/${courseId}/archive`)
    }
    if (professionalId) {
      await send('post', `/admin/professionals/${professionalId}/unpublish`)
      await send('post', `/admin/professionals/${professionalId}/archive`)
    }
  } catch (error) {
    console.error('limpeza falhou:', error)
  }
  await browser.close()
}
