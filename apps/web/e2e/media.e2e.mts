/**
 * E2E da biblioteca de mídia (Fase 7A): envio de imagem e vídeo, derivados e cabeçalhos pelo proxy do site,
 * Range do vídeo, seletor no assistente do profissional, página pública com `/media/<id>?w=`, CSP sem violações,
 * detalhes de uso, exclusão bloqueada para arquivo em uso, exclusão de arquivo livre e 390px sem overflow.
 * Cria um profissional `e2e-media-*` (arquivado no fim) e remove os arquivos que enviou.
 * Requer API (3333) migrada e o build de produção do web (3100).
 * Uso: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web e2e:media
 */
import { chromium, type BrowserContext, type Page } from 'playwright-core'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
assert.ok(EMAIL && PASSWORD, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD')

const asset = (rel: string) => fileURLToPath(new URL(`../public/site/${rel}`, import.meta.url))
const stamp = Date.now().toString(36)
const SLUG = `e2e-media-${stamp}`

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

const xsrf = async (ctx: BrowserContext) => decodeURIComponent((await ctx.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? '')
const send = async (ctx: BrowserContext, method: 'post' | 'put' | 'delete', path: string, data?: unknown) => {
  const res = await ctx.request[method](`${BASE}/api${path}`, { headers: { 'x-xsrf-token': await xsrf(ctx) }, data })
  return { status: res.status(), body: await res.json().catch(() => null) as any }
}
const get = async (path: string) => {
  const res = await context.request.get(`${BASE}/api${path}`)
  return { status: res.status(), body: await res.json().catch(() => null) as any }
}

const professional = {
  name: 'Mídia E2e', specialty: 'Hair', tagline: 'Técnica e carreira.', experienceYears: 10,
  instagramHandle: '@e2e', instagramFollowers: '10 mil', instagramUrl: 'https://instagram.com/e2e',
  portraitSrc: '/site/profissional/lukas_perfil.png', cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: ['Parágrafo do cadastro.'],
  works: [{ imageSrc: '/site/profissional/trabLukas01.png', alt: 'Trabalho', title: 'Morena', tags: ['mechas'] }],
}

const uploaded: string[] = []
let id = 0
let imageId = ''
try {
  await step('login', async () => {
    await page.goto(`${BASE}/admin/login`)
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/admin`)
    await page.getByRole('link', { name: 'Mídia' }).waitFor()
  })

  await step('biblioteca: envia uma imagem pelo navegador e ela aparece na grade', async () => {
    await page.goto(`${BASE}/admin/midia`)
    await page.getByRole('heading', { name: 'Biblioteca de mídia' }).waitFor()
    const png = await readFile(asset('home/lukas-campos.png'))
    await page.getByLabel('Enviar arquivos').setInputFiles({ name: 'foto-e2e.png', mimeType: 'image/png', buffer: png })
    await page.getByText('1 arquivo(s) enviado(s).').waitFor({ timeout: 60_000 })
    const card = page.locator('.media-card', { hasText: 'foto-e2e.png' }).first()
    await card.waitFor()
    const list = await get('/admin/media?q=foto-e2e')
    imageId = list.body.items[0].id
    uploaded.push(imageId)
    assert.equal(list.body.items[0].path, `/media/${imageId}`)
  })

  await step('entrega pelo site: WebP/AVIF por Accept, largura por ?w=, cache imutável e nosniff', async () => {
    const webp = await context.request.get(`${BASE}/media/${imageId}?w=320`, { headers: { accept: 'image/webp,*/*' } })
    assert.equal(webp.status(), 200)
    assert.equal(webp.headers()['content-type'], 'image/webp')
    assert.match(webp.headers()['cache-control'] ?? '', /immutable/)
    assert.equal(webp.headers()['x-content-type-options'], 'nosniff')
    const avif = await context.request.get(`${BASE}/media/${imageId}?w=320`, { headers: { accept: 'image/avif,image/webp,*/*' } })
    assert.equal(avif.headers()['content-type'], 'image/avif')
    const full = await context.request.get(`${BASE}/media/${imageId}`, { headers: { accept: 'image/webp' } })
    assert.ok((await full.body()).length > (await webp.body()).length, 'o derivado de 320 px deve ser menor que o maior derivado')
    assert.equal((await context.request.get(`${BASE}/media/${'0'.repeat(32)}`)).status(), 404)
  })

  await step('vídeo de 28 MB: envia, serve inteiro e em partes (Range)', async () => {
    const mp4 = await readFile(asset('profissional/video.mp4'))
    await page.goto(`${BASE}/admin/midia`)
    await page.getByLabel('Enviar arquivos').setInputFiles({ name: 'video-e2e.mp4', mimeType: 'video/mp4', buffer: mp4 })
    await page.getByText('1 arquivo(s) enviado(s).').waitFor({ timeout: 120_000 })
    const list = await get('/admin/media?q=video-e2e')
    const videoId = list.body.items[0].id
    uploaded.push(videoId)
    assert.equal(list.body.items[0].kind, 'video')
    const part = await context.request.get(`${BASE}/media/${videoId}`, { headers: { range: 'bytes=0-1023' } })
    assert.equal(part.status(), 206)
    assert.equal((await part.body()).length, 1024)
    assert.match(part.headers()['content-range'] ?? '', new RegExp(`^bytes 0-1023/${mp4.length}$`))
  })

  await step('envio recusado: arquivo que finge ser imagem mostra o motivo e não entra na biblioteca', async () => {
    await page.goto(`${BASE}/admin/midia`)
    const before = (await get('/admin/media')).body.total
    await page.getByLabel('Enviar arquivos').setInputFiles({ name: 'falso.png', mimeType: 'image/png', buffer: Buffer.from('<html><script>alert(1)</script></html>') })
    await page.getByRole('alert').filter({ hasText: 'falso.png' }).waitFor()
    assert.equal((await get('/admin/media')).body.total, before)
  })

  await step('assistente do profissional: escolhe a imagem na biblioteca, salva e publica', async () => {
    const created = await send(context, 'post', '/admin/professionals', { slug: SLUG, data: professional })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    id = created.body.id
    await page.goto(`${BASE}/admin/profissionais/${id}`)
    await page.getByRole('button', { name: 'Imagens e vídeo' }).click()
    await page.getByRole('button', { name: 'Editar Retrato da página' }).click()
    const dialog = page.getByRole('dialog', { name: /Trocar retrato da página/i })
    await dialog.waitFor()
    await dialog.getByRole('button', { name: /Usar\s*foto-e2e\.png/ }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByText('Alterações salvas.').waitFor()
    assert.equal((await get(`/admin/professionals/${id}`)).body.data.portraitSrc, `/media/${imageId}`)
    await page.getByRole('button', { name: 'Revisão e publicação' }).click()
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await page.getByText('Publicado. A página pública já foi atualizada.').waitFor()
  })

  await step('página pública usa /media/<id>?w=, a imagem carrega e o CSP não reclama', async () => {
    const before = consoleErrors.length
    await page.goto(`${BASE}/profissionais/${SLUG}`)
    const img = page.locator(`img[src^="/media/${imageId}?w="]`).first()
    await img.waitFor()
    await page.waitForFunction((src) => {
      const el = document.querySelector(`img[src="${src}"]`) as HTMLImageElement | null
      return !!el && el.complete && el.naturalWidth > 0
    }, await img.getAttribute('src'))
    assert.deepEqual(consoleErrors.slice(before), [])
  })

  await step('detalhes mostram onde o arquivo é usado e a exclusão é bloqueada', async () => {
    await page.goto(`${BASE}/admin/midia`)
    await page.getByRole('button', { name: 'Detalhes de foto-e2e.png' }).click()
    await page.getByText(/Profissional: Mídia E2e \(versão publicada\)/).waitFor()
    await page.keyboard.press('Escape') // a janela de detalhes cobre a grade: fecha antes de excluir
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Excluir foto-e2e.png' }).click()
    await page.getByRole('button', { name: 'Confirmar exclusão de foto-e2e.png' }).click()
    await page.getByRole('alert').filter({ hasText: 'em uso' }).waitFor()
    assert.equal((await context.request.get(`${BASE}/media/${imageId}`, { headers: { accept: 'image/webp' } })).status(), 200)
  })

  await step('arquivo livre pode ser excluído pela tela', async () => {
    await page.goto(`${BASE}/admin/midia`)
    await page.getByRole('button', { name: 'Excluir video-e2e.mp4' }).click()
    await page.getByRole('button', { name: 'Confirmar exclusão de video-e2e.mp4' }).click()
    await page.getByText('"video-e2e.mp4" excluído.').waitFor()
    uploaded.pop()
  })

  await step('390px: biblioteca e seletor sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto(`${BASE}/admin/midia`)
    await page.locator('.media-card').first().waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'overflow em /admin/midia')
    await page.goto(`${BASE}/admin/profissionais/${id}`)
    await page.getByRole('button', { name: 'Imagens e vídeo' }).click()
    await page.getByRole('button', { name: 'Editar Retrato da página' }).click()
    await page.getByRole('dialog').waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'overflow com o seletor aberto')
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  await step('sem CSRF o envio é recusado (403)', async () => {
    const res = await context.request.post(`${BASE}/api/admin/media`, { multipart: { file: { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('x') } } })
    assert.equal(res.status(), 403)
  })
} finally {
  // Limpeza: tira a mídia do cadastro, despublica, arquiva e exclui o que enviou.
  try {
    if (id) {
      const row = await get(`/admin/professionals/${id}`)
      if (row.status === 200) {
        await send(context, 'put', `/admin/professionals/${id}`, { revision: row.body.revision, data: { ...row.body.data, portraitSrc: professional.portraitSrc } })
        await send(context, 'post', `/admin/professionals/${id}/unpublish`)
        await send(context, 'post', `/admin/professionals/${id}/archive`)
      }
    }
    for (const mid of uploaded) await send(context, 'delete', `/admin/media/${mid}`)
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
