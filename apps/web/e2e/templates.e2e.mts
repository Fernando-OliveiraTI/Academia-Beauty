/**
 * E2E dos modelos de página do Profissional (Fase 7C): escolher o modelo no assistente (com exemplo), criar e
 * publicar com cada um dos seis modelos, conferir composição e tema na página pública, trocar de modelo antes de
 * personalizar, bloqueio depois de editar, editor com as seções Números/Chamada e 390px sem rolagem horizontal.
 * Cria profissionais `e2e-tpl-*` (arquivados no fim).
 * Requer API (3333) migrada e o build de produção do web (3100).
 * Uso: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web e2e:templates
 */
import { chromium, type Page } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
assert.ok(EMAIL && PASSWORD, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD')

const stamp = Date.now().toString(36)
const TEMPLATES = [
  { key: 'professional-original', label: 'Original', order: ['numeros'], dom: [] as string[] },
  { key: 'professional-authority', label: 'Autoridade', order: ['hero', 'numeros', 'bio'], dom: ['#numeros'] },
  { key: 'professional-video', label: 'Vídeo', order: [], dom: [] },
  { key: 'professional-conversion', label: 'Conversão', order: [], dom: ['#chamada'] },
  { key: 'professional-immersive', label: 'Imersivo', order: [], dom: [] },
  { key: 'professional-premium', label: 'Premium', order: [], dom: ['#numeros', '#chamada'] },
]

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
const until = async (fn: () => Promise<boolean>, what: string, ms = 15_000) => {
  const end = Date.now() + ms
  while (Date.now() < end) { if (await fn()) return; await new Promise((r) => setTimeout(r, 300)) }
  assert.fail(`Tempo esgotado: ${what}`)
}
const html = async (path: string) => (await fetch(`${BASE}${path}`, { cache: 'no-store' })).text()

const data = (name: string) => ({
  name, specialty: 'Hair', tagline: 'Técnica e carreira.', experienceYears: 12, instagramHandle: '@e2e', instagramFollowers: '53,6 Mil seguidores',
  instagramUrl: 'https://instagram.com/e2e', portraitSrc: '/site/profissional/lukas_perfil.png', cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: ['Trajetória de doze anos.'], works: [{ imageSrc: '/site/profissional/trabLukas01.png', alt: 'Trabalho', title: 'Morena', tags: ['mechas'] }],
})

const ids = new Map<string, { id: number; slug: string }>()
try {
  await step('login', async () => {
    await page.goto(`${BASE}/admin/login`)
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/admin`)
  })

  await step('exemplos públicos dos seis modelos renderizam com o tema e sem erro', async () => {
    for (const t of TEMPLATES) {
      const res = await fetch(`${BASE}/preview/modelos/${t.key}`, { cache: 'no-store' })
      assert.equal(res.status, 200, t.key)
      const body = await res.text()
      assert.match(body, new RegExp(`data-tpl="${t.key}"`), t.key)
      for (const sel of t.dom) assert.match(body, new RegExp(`id="${sel.slice(1)}"`), `${t.key} ${sel}`)
    }
    assert.equal((await fetch(`${BASE}/preview/modelos/professional-inexistente`)).status, 404)
  })

  await step('assistente: escolhe o modelo Premium, vê o exemplo e cria o rascunho', async () => {
    await page.goto(`${BASE}/admin/profissionais/novo`)
    await page.getByLabel('Nome completo').fill(`Modelo Premium ${stamp}`)
    await page.getByLabel('Especialidade').fill('Hair')
    const slug = `e2e-tpl-premium-${stamp}`
    await page.getByLabel('Endereço da página (slug)').fill(slug)
    const premium = page.getByRole('radio', { name: /^Premium/ })
    assert.equal(await page.getByRole('radio', { name: /^Original/ }).isChecked(), true, 'o Original é o padrão')
    await premium.check()
    const link = page.getByRole('link', { name: /Ver exemplo do modelo Premium/ })
    assert.equal(await link.getAttribute('href'), '/preview/modelos/professional-premium')
    assert.equal(await link.getAttribute('target'), '_blank')
    await page.getByRole('button', { name: 'Criar rascunho' }).click()
    await page.waitForURL(/\/admin\/profissionais\/\d+$/)
    const id = Number(page.url().split('/').pop())
    ids.set('professional-premium', { id, slug })
    assert.equal((await get(`/admin/professionals/${id}`)).body.templateKey, 'professional-premium')
    assert.equal(await page.getByRole('radio', { name: /^Premium/ }).isChecked(), true)
  })

  await step('cria e publica um profissional por modelo (via API) e confere a página pública', async () => {
    for (const t of TEMPLATES) {
      if (!ids.has(t.key)) {
        const slug = `e2e-tpl-${t.key.replace('professional-', '')}-${stamp}`
        const created = await send('post', '/admin/professionals', { slug, data: data(`Modelo ${t.label} ${stamp}`), templateKey: t.key })
        assert.equal(created.status, 201, JSON.stringify(created.body))
        ids.set(t.key, { id: created.body.id, slug })
      }
      const { id, slug } = ids.get(t.key)!
      if (t.key === 'professional-premium') {
        const row = await get(`/admin/professionals/${id}`)
        await send('put', `/admin/professionals/${id}`, { revision: row.body.revision, data: data(`Modelo ${t.label} ${stamp}`) })
      }
      const published = await send('post', `/admin/professionals/${id}/publish`)
      assert.equal(published.status, 200, `${t.key}: ${JSON.stringify(published.body)}`)
      await until(async () => (await html(`/profissionais/${slug}`)).includes(`data-tpl="${t.key}"`), `página pública com o tema ${t.key}`)
      const body = await html(`/profissionais/${slug}`)
      for (const sel of t.dom) assert.match(body, new RegExp(`id="${sel.slice(1)}"`), `${t.key} ${sel}`)
      if (!t.dom.includes('#numeros')) assert.doesNotMatch(body, /id="numeros"/, `${t.key} não tem a faixa de números`)
      assert.match(body, new RegExp(`Modelo ${t.label} ${stamp}`.split(' ')[0]!))
    }
  })

  await step('a ordem das seções na página pública segue o modelo (Autoridade: números antes da trajetória)', async () => {
    const body = await html(`/profissionais/${ids.get('professional-authority')!.slug}`)
    assert.ok(body.indexOf('id="numeros"') > 0 && body.indexOf('id="numeros"') < body.indexOf('bio-section'), 'números antes da bio')
    const conv = await html(`/profissionais/${ids.get('professional-conversion')!.slug}`)
    assert.ok(conv.indexOf('id="chamada"') > 0, 'chamada presente')
    const video = await html(`/profissionais/${ids.get('professional-video')!.slug}`)
    assert.ok(video.indexOf('id="video"') < video.indexOf('bio-section') || !video.includes('id="video"'), 'vídeo (se houver) antes da bio')
  })

  await step('trocar o modelo de um rascunho pela tela, antes de personalizar', async () => {
    const created = await send('post', '/admin/professionals', { slug: `e2e-tpl-troca-${stamp}`, data: data(`Troca ${stamp}`) })
    const id = created.body.id
    ids.set('troca', { id, slug: `e2e-tpl-troca-${stamp}` })
    await page.goto(`${BASE}/admin/profissionais/${id}`)
    await page.getByRole('radio', { name: /^Imersivo/ }).check()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Alterações salvas.').waitFor()
    assert.equal((await get(`/admin/professionals/${id}`)).body.templateKey, 'professional-immersive')
  })

  await step('editor: o modelo Premium oferece Números e Chamada; editar e publicar mantém o tema', async () => {
    const { id, slug } = ids.get('professional-premium')!
    await page.goto(`${BASE}/admin/editor/profissionais/${id}`)
    await page.locator('.ed-item').first().waitFor()
    const names = await page.locator('.ed-item .ed-name').allTextContents()
    assert.ok(names.includes('Números') && names.includes('Chamada'), names.join(', '))
    await page.getByRole('button', { name: /Chamada/ }).first().click()
    const text = `Chamada editada ${stamp}`
    await page.getByLabel('Título', { exact: true }).fill(text)
    await page.frameLocator('iframe[title="Pré-visualização da página"]').getByText(text).waitFor({ timeout: 10_000 })
    await page.getByRole('status').filter({ hasText: 'Salvo' }).waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await page.getByText('Publicado. O site será atualizado em instantes.').waitFor()
    await until(async () => (await html(`/profissionais/${slug}`)).includes(text), 'chamada editada no ar')
    assert.match(await html(`/profissionais/${slug}`), /data-tpl="professional-premium"/)
  })

  await step('depois de personalizar no editor, trocar o modelo é bloqueado (e o assistente avisa)', async () => {
    const { id } = ids.get('professional-premium')!
    const row = await get(`/admin/professionals/${id}`)
    const res = await send('put', `/admin/professionals/${id}`, { revision: row.body.revision, data: row.body.data, templateKey: 'professional-video' })
    assert.equal(res.status, 422)
    assert.equal(res.body.code, 'template_locked')
    await page.goto(`${BASE}/admin/profissionais/${id}`)
    assert.equal(await page.getByRole('radio', { name: /^Vídeo/ }).isDisabled(), true)
    await page.getByText(/personalizada no editor/).first().waitFor()
  })

  await step('"Restaurar do cadastro" libera a troca e a página volta ao modelo escolhido', async () => {
    const { id } = ids.get('professional-premium')!
    const state = await get(`/admin/professionals/${id}/document`)
    assert.equal((await send('delete', `/admin/professionals/${id}/document`, { revision: state.body.documentRevision })).status, 200)
    const row = await get(`/admin/professionals/${id}`)
    const res = await send('put', `/admin/professionals/${id}`, { revision: row.body.revision, data: row.body.data, templateKey: 'professional-video' })
    assert.equal(res.status, 200)
    assert.equal(res.body.templateKey, 'professional-video')
  })

  await step('390px: exemplos dos seis modelos e assistente sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 800 })
    for (const t of TEMPLATES) {
      await page.goto(`${BASE}/preview/modelos/${t.key}`)
      await page.waitForLoadState('load')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow em ${t.key}`)
    }
    await page.goto(`${BASE}/admin/profissionais/novo`)
    await page.getByRole('radio', { name: /^Premium/ }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'overflow no assistente')
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  await step('modelo inválido é recusado pela API (422)', async () => {
    const res = await send('post', '/admin/professionals', { slug: `e2e-tpl-x-${stamp}`, data: data('X Inválido'), templateKey: 'professional-xyz' })
    assert.equal(res.status, 422)
  })
} finally {
  try {
    for (const { id } of ids.values()) {
      await send('post', `/admin/professionals/${id}/unpublish`)
      await send('post', `/admin/professionals/${id}/archive`)
    }
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
