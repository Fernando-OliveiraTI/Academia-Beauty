import { metaFor } from '@academia/section-schemas'

type SectionLike = { id: string; type: string; visibility: { enabled: boolean } }

const RANK: Record<string, number> = { banner: 0, main: 1, contentinfo: 2, overlay: 3 }
// Seções automáticas sem itens não geram elemento na página.
const MAY_BE_EMPTY = ['home.courses', 'professional.courses']

/** O invólucro de fundo (`.pg-bg`, `display: contents`) não tem caixa própria: o bloco da seção é o filho dele. */
const unwrapBackground = (el: HTMLElement): HTMLElement => (el.matches('.pg-bg') && el.firstElementChild ? (el.firstElementChild as HTMLElement) : el)

/** Blocos de primeiro nível da página renderizada: um por seção (o `main` é aberto; utilitários de acessibilidade ficam de fora). */
export function sectionNodes(doc: Document): HTMLElement[] {
  const wrapper = doc.querySelector('[class*="pg-"]')
  if (!wrapper) return []
  const root = wrapper.querySelector(':scope > .cb-shell') ?? wrapper
  const nodes: HTMLElement[] = []
  for (const child of Array.from(root.children)) {
    const tag = child.tagName.toLowerCase()
    if (tag === 'svg' || tag === 'script' || tag === 'style') continue
    if (child.matches('.skip-link, .scroll-progress, .side-nav, .pro-side-nav')) continue
    if (tag === 'main') nodes.push(...(Array.from(child.children) as HTMLElement[]).map(unwrapBackground))
    else nodes.push(unwrapBackground(child as HTMLElement))
  }
  return nodes
}

/**
 * Liga cada seção visível ao seu bloco na página. A ordem do DOM segue a região (topo, conteúdo, rodapé, flutuante)
 * e, dentro dela, a ordem do documento. Se a contagem não fecha, devolve `null`: sem ligação é melhor que ligação trocada.
 */
export function matchSectionNodes(sections: SectionLike[], nodes: HTMLElement[]): Map<string, HTMLElement> | null {
  const ordered = sections
    .filter((s) => s.visibility.enabled)
    .map((s, i) => ({ s, i, r: RANK[metaFor(s.type)?.placement ?? 'main'] ?? 1 }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s)
  let list = ordered
  if (list.length !== nodes.length) {
    const attempts = [MAY_BE_EMPTY, ...MAY_BE_EMPTY.map((t) => [t])]
    const found = attempts.map((drop) => ordered.filter((s) => !drop.includes(s.type))).find((candidate) => candidate.length === nodes.length)
    if (!found) return null
    list = found
  }
  return new Map(list.map((s, i) => [s.id, nodes[i]!]))
}

const norm = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()

export type PickInfo = { sectionId: string; texts: string[]; srcs: string[] }

/** Caminho (`a.b.0.c`) do campo de texto/arquivo do conteúdo que corresponde ao que foi clicado, ou null. */
export function findFieldPath(content: unknown, pick: Pick<PickInfo, 'texts' | 'srcs'>): string | null {
  const leaves: { path: string; value: string }[] = []
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') { if (node.trim()) leaves.push({ path, value: node }); return }
    if (Array.isArray(node)) { node.forEach((item, i) => walk(item, path ? `${path}.${i}` : String(i))); return }
    if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k)
  }
  walk(content, '')
  const mediaId = (s: string) => /\/media\/(\d+)/.exec(s)?.[1]
  for (const src of pick.srcs) {
    const path = new URL(src, 'http://x').pathname
    const hit = leaves.find((l) => l.value === src || l.value === path || (mediaId(l.value) && mediaId(l.value) === mediaId(src)))
    if (hit) return hit.path
  }
  for (const text of pick.texts.map(norm).filter(Boolean)) {
    const exact = leaves.find((l) => norm(l.value) === text)
    if (exact) return exact.path
  }
  // Sem igualdade exata (texto montado por vários campos): o maior campo contido no texto clicado.
  for (const text of pick.texts.map(norm).filter(Boolean)) {
    const inside = leaves.filter((l) => { const v = norm(l.value); return v.length >= 3 && text.includes(v) }).sort((a, b) => b.value.length - a.value.length)[0]
    if (inside) return inside.path
  }
  return null
}
