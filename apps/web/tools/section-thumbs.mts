/**
 * Gera as miniaturas das seções do editor (`public/admin/section-thumbs/<tipo>.jpg`).
 * Abre o editor de cada tipo de página, esconde todas as seções menos uma (só no navegador: nada é salvo)
 * e captura a pré-visualização real em 1440 px, reduzida a 288 px de largura.
 *
 * Pré-requisitos: API (3333) e web em produção (3100) no ar, e um admin:
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web section-thumbs
 * Refaça quando o visual das seções mudar. Tipos que só existem em modelos não semeados ficam sem imagem
 * (o editor mostra o ícone do tipo no lugar).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { metaFor } from '@academia/section-schemas'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
if (!EMAIL || !PASSWORD) throw new Error('Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD')
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'admin', 'section-thumbs')
mkdirSync(OUT, { recursive: true })

type Doc = { sections: { id: string; type: string; visibility: { enabled: boolean } }[] }

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0.2 })
// Guarda o último documento que o editor enviou ao quadro de pré-visualização.
await context.addInitScript(() => {
  window.addEventListener('message', (e) => {
    const m = e.data as { type?: string; document?: unknown } | null
    if (m?.type === 'academia-editor-document') (window as unknown as { __doc: unknown }).__doc = m.document
  })
})
const page = await context.newPage()
await page.goto(`${BASE}/admin/login`)
await page.getByLabel('E-mail').fill(EMAIL)
await page.getByLabel('Senha').fill(PASSWORD)
await page.getByRole('button', { name: 'Entrar' }).click()
await page.waitForURL(`${BASE}/admin`)

const first = async (path: string) => {
  const res = await page.request.get(`${BASE}/api${path}`)
  const body = (await res.json()) as { items?: { id: number }[] }
  return body.items?.[0]?.id
}

const RANK: Record<string, number> = { banner: 0, main: 1, contentinfo: 2, overlay: 3 }
// Seções automáticas sem itens não geram elemento na página.
const MAY_BE_EMPTY = ['home.courses', 'professional.courses']

async function capture(editorPath: string, label: string) {
  await page.goto(`${BASE}${editorPath}`)
  await page.locator('.ed-preview iframe').waitFor()
  await page.waitForTimeout(2500)
  const frameHandle = await page.locator('.ed-preview iframe').elementHandle()
  const child = await frameHandle!.contentFrame()
  let doc = (await child!.evaluate(() => (window as unknown as { __doc?: unknown }).__doc)) as Doc | undefined
  if (!doc) {
    // O editor só reenvia o documento ao mudar: alterna a largura para forçar o reenvio.
    await page.getByRole('button', { name: 'Tablet' }).click()
    await page.getByRole('button', { name: 'Desktop' }).click()
    await page.waitForTimeout(800)
    doc = (await child!.evaluate(() => (window as unknown as { __doc?: unknown }).__doc)) as Doc | undefined
  }
  if (!doc) throw new Error(`${label}: documento da pré-visualização não capturado`)
  // Seções ocultas (Depoimentos, FAQ, Garantia…) também precisam de miniatura: manda ao quadro uma cópia com
  // todas ligadas (só no navegador desta captura; nada é salvo).
  const all = { ...doc, sections: doc.sections.map((x) => ({ ...x, visibility: { ...x.visibility, enabled: true } })) }
  await page.evaluate((d) => {
    const f = document.querySelector<HTMLIFrameElement>('.ed-preview iframe')!
    f.contentWindow!.postMessage({ type: 'academia-editor-document', document: d }, window.location.origin)
  }, all)
  await page.waitForTimeout(1500)
  doc = all
  // O indicador do Next (modo desenvolvimento) não pode aparecer nas miniaturas.
  await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((n) => n.remove()))
  // O quadro ocupa a janela inteira: a captura é só da página, sem a moldura do editor.
  await page.evaluate(() => {
    const f = document.querySelector<HTMLIFrameElement>('.ed-preview iframe')!
    f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;border:0;max-width:none'
  })
  await child!.evaluate(() => {
    const w = window as unknown as { __nodes?: Element[] }
    const wrapper = document.querySelector('[class*="pg-"]')!
    const root = wrapper.querySelector(':scope > .cb-shell') ?? wrapper
    const nodes: Element[] = []
    for (const c of Array.from(root.children)) {
      const tag = c.tagName.toLowerCase()
      if (tag === 'svg' || tag === 'script' || tag === 'style') continue
      if (c.matches('.skip-link, .scroll-progress, .side-nav, .pro-side-nav')) continue // utilitários de acessibilidade, não são seções
      if (tag === 'main') nodes.push(...Array.from(c.children)); else nodes.push(c)
    }
    document.querySelectorAll('nextjs-portal').forEach((n) => n.remove())
    w.__nodes = nodes
    // O quadro do editor tem esse fundo; fora dele a página ficaria branca.
    document.documentElement.style.setProperty('background', '#0b0a09', 'important')
    document.body.style.setProperty('background', '#0b0a09', 'important')
    for (const el of [wrapper, root]) (el as HTMLElement).style.setProperty('background', '#0b0a09', 'important')
  })
  const count = await child!.evaluate(() => (window as unknown as { __nodes: Element[] }).__nodes.length)

  // Ordem do DOM = região (topo, conteúdo, rodapé, flutuante) e, dentro dela, a ordem do documento.
  const ordered = doc.sections.filter((x) => x.visibility.enabled).map((x, i) => ({ ...x, i, r: RANK[metaFor(x.type)?.placement ?? 'main'] ?? 1 })).sort((x, y) => x.r - y.r || x.i - y.i)
  let list = ordered
  if (list.length !== count) {
    const tries = [MAY_BE_EMPTY, ...MAY_BE_EMPTY.map((t) => [t])]
    for (const drop of tries) { const cand = ordered.filter((x) => !drop.includes(x.type)); if (cand.length === count) { list = cand; break } }
  }
  if (list.length !== count && process.env.THUMBS_DEBUG) {
    const names = await child!.evaluate(() => (window as unknown as { __nodes: Element[] }).__nodes.map((n) => `${n.tagName.toLowerCase()}.${String(n.className).split(' ').slice(0, 2).join('.')}`))
    console.warn('  blocos:', names.join(' | '))
    console.warn('  seções:', list.map((x) => x.type).join(' | '))
  }
  if (list.length !== count) { console.warn(`  ${label}: ${count} blocos na página × ${list.length} seções; ignorado para não gerar miniatura trocada`); return }

  const seen = new Set<string>()
  for (let n = 0; n < list.length; n += 1) {
    const target = list[n]!
    if (seen.has(target.type)) continue
    seen.add(target.type)
    await child!.evaluate((keep) => {
      const nodes = (window as unknown as { __nodes: HTMLElement[] }).__nodes
      nodes.forEach((el, i) => { if (i === keep) el.style.removeProperty('display'); else el.style.setProperty('display', 'none', 'important') })
      window.scrollTo(0, 0)
    }, n)
    await page.waitForTimeout(1300)
    const shot = await page.screenshot({ type: 'jpeg', quality: 80, scale: 'device' })
    writeFileSync(join(OUT, `${target.type}.jpg`), shot)
    console.log(`  ${label}: ${target.type} (${shot.length} bytes)`)
  }
}

const proId = await first('/admin/professionals?q=lukas-campos')
const courseId = await first('/admin/courses')
await capture('/admin/editor/home', 'home')
if (proId) await capture(`/admin/editor/profissionais/${proId}`, 'profissional')
else console.warn('sem profissional para capturar')
if (courseId) await capture(`/admin/editor/cursos/${courseId}`, 'curso')
else console.warn('sem curso para capturar')
await browser.close()
