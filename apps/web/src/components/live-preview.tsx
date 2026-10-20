'use client'

import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import type { PageDocument } from '@academia/page-schema'
import { validatePageDocument } from '@academia/section-schemas'
import { matchSectionNodes, sectionNodes } from '@/lib/section-dom'
import type { CourseCard, CourseData, HomeCourseCard, ProfessionalData, ShowcaseItem } from '@academia/contracts'
import { NO_OFFER, PageRenderer, resolveCourseDocument, resolveHomeDocument, resolveProfessionalDocument, type CheckoutMode, type OfferView } from '@academia/page-renderer'

export const EDITOR_MESSAGE = 'academia-editor-document'
/** Editor → quadro: destaca (e, se pedido, rola até) a seção. */
export const EDITOR_FOCUS = 'academia-editor-focus'
/** Editor → quadro: liga/desliga o clique para editar (desligado na tela cheia). */
export const EDITOR_INTERACTIVE = 'academia-editor-interactive'
/** Quadro → editor: o usuário clicou num elemento da página. */
export const EDITOR_PICK = 'academia-editor-pick'

const BRIDGE_CSS = `
[data-ed-section][data-ed-selected]{outline:1px solid #e3c98a !important;outline-offset:-1px}
[data-ed-hover]{outline:1px dashed rgba(227,201,138,.75) !important;outline-offset:-1px}
[data-ed-on] [data-ed-section], [data-ed-on] [data-ed-section] *{cursor:pointer !important}
#ed-frame{position:fixed;z-index:2147483646;pointer-events:none;display:none;box-sizing:border-box;border:2px solid #e3c98a;box-shadow:0 0 0 1px rgba(11,10,9,.65),inset 0 0 0 1px rgba(11,10,9,.35)}
#ed-frame[data-hover]{border-style:dashed;border-color:rgba(227,201,138,.85)}
#ed-frame[data-quiet]{border-width:1px;border-color:rgba(227,201,138,.45)}
#ed-pick{position:fixed;z-index:2147483647;pointer-events:none;display:none;box-sizing:border-box;border:2px solid #e3c98a;background:rgba(227,201,138,.1);box-shadow:0 0 0 1px rgba(11,10,9,.7)}
#ed-pick::after{content:attr(data-label);position:absolute;left:-2px;bottom:100%;padding:2px 6px;background:#e3c98a;color:#17130c;font:600 9px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}
#ed-badge{position:fixed;z-index:2147483647;pointer-events:none;display:none;padding:3px 8px;background:#e3c98a;color:#17130c;font:600 10px/1.4 ui-monospace,'SFMono-Regular',Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;border-radius:0 0 4px 0;white-space:nowrap}
`

type Props =
  | { kind: 'professional'; initial: PageDocument | null; data: ProfessionalData; courseCards: CourseCard[]; templateKey: string }
  | { kind: 'course'; initial: PageDocument | null; data: CourseData; professional: ProfessionalData; offer: OfferView; checkout?: CheckoutMode }
  | { kind: 'home'; initial: PageDocument | null; professionals: ShowcaseItem[]; courses: HomeCourseCard[] }

class Boundary extends Component<{ children: ReactNode; resetKey: unknown }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidUpdate(prev: { resetKey: unknown }) { if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }) }
  render() {
    return this.state.failed ? <p role="alert" style={{ padding: 24, color: '#f5b5b5', font: '16px system-ui' }}>Não foi possível renderizar esta versão da página.</p> : this.props.children
  }
}

/**
 * Pré-visualização ao vivo dentro do iframe do editor. Recebe o documento por postMessage (mesma origem,
 * só do quadro pai), valida com o registry e renderiza com o mesmo renderer do site público.
 */
export function LivePreview(props: Props) {
  const [document, setDocument] = useState<PageDocument | null>(props.initial)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Só aceita o quadro pai (se a rota for aberta numa aba própria, parent === window e nada é aceito).
      if (window.parent === window || event.origin !== window.location.origin || event.source !== window.parent) return
      const msg = event.data as { type?: string; document?: unknown }
      if (msg?.type !== EDITOR_MESSAGE) return
      const result = validatePageDocument(msg.document)
      if (result.ok) setDocument(result.document)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'academia-editor-ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const resolved = useRef<PageDocument | null>(null)
  const nodeMap = useRef<Map<string, HTMLElement> | null>(null)
  const selected = useRef<string | null>(null)
  const interactive = useRef(true)

  // Ponte com o editor: marca o bloco de cada seção, destaca a selecionada e avisa cliques. Só dentro do quadro do editor.
  useEffect(() => {
    if (window.parent === window) return
    const style = window.document.createElement('style')
    // O painel roda com CSP por nonce: o <style> criado aqui precisa carregar o mesmo nonce dos scripts da página.
    const nonce = window.document.querySelector<HTMLElement>('script[nonce]')?.nonce
    if (nonce) style.nonce = nonce
    style.textContent = BRIDGE_CSS
    window.document.head.appendChild(style)
    window.document.documentElement.setAttribute('data-ed-on', '')

    const frameEl = window.document.createElement('div')
    frameEl.id = 'ed-frame'
    window.document.body.appendChild(frameEl)
    const pickEl = window.document.createElement('div')
    pickEl.id = 'ed-pick'
    window.document.body.appendChild(pickEl)
    let picked: { el: Element; label: string } | null = null
    const badge = window.document.createElement('div')
    badge.id = 'ed-badge'
    badge.textContent = 'Editar seção'
    window.document.body.appendChild(badge)
    let hovered: HTMLElement | null = null
    // O selo acompanha a seção em foco (a sob o mouse ou, senão, a selecionada) e fica visível enquanto ela estiver na tela.
    const updateBadge = () => {
      const selectedNode = selected.current ? nodeMap.current?.get(selected.current) ?? null : null
      const node = interactive.current ? (hovered ?? selectedNode) : null
      // Elemento clicado (imagem/texto): moldura própria; a da seção fica discreta.
      const pickedNode = interactive.current && picked?.el.isConnected && selectedNode?.contains(picked.el) ? picked : null
      if (pickedNode) {
        const pr = pickedNode.el.getBoundingClientRect()
        pickEl.style.display = 'block'
        pickEl.setAttribute('data-label', pickedNode.label)
        pickEl.style.left = `${pr.left}px`
        pickEl.style.top = `${pr.top}px`
        pickEl.style.width = `${pr.width}px`
        pickEl.style.height = `${pr.height}px`
      } else pickEl.style.display = 'none'
      if (!node || !node.isConnected) { badge.style.display = 'none'; frameEl.style.display = 'none'; return }
      const r = node.getBoundingClientRect()
      if (r.bottom < 4 || r.top > window.innerHeight) { badge.style.display = 'none'; frameEl.style.display = 'none'; return }
      // Moldura por cima de tudo (o contorno do próprio elemento pode ficar coberto pelas camadas de efeito da página).
      frameEl.style.display = 'block'
      frameEl.toggleAttribute('data-hover', node !== selectedNode)
      frameEl.toggleAttribute('data-quiet', Boolean(pickedNode) && node === selectedNode)
      frameEl.style.left = `${r.left}px`
      frameEl.style.top = `${r.top}px`
      frameEl.style.width = `${r.width}px`
      frameEl.style.height = `${r.height}px`
      badge.style.display = 'block'
      badge.style.left = `${Math.max(r.left, 0)}px`
      badge.style.top = `${Math.max(r.top, 0)}px`
    }
    // Acompanha animações e efeitos de rolagem da página, que movem a seção sem disparar scroll.
    let raf = window.requestAnimationFrame(function tick() { updateBadge(); raf = window.requestAnimationFrame(tick) })
    const clearHover = () => { hovered = null; window.document.querySelectorAll('[data-ed-hover]').forEach((el) => el.removeAttribute('data-ed-hover')); updateBadge() }
    const sectionOf = (el: Element | null): HTMLElement | null => (el?.closest('[data-ed-section]') as HTMLElement | null) ?? null
    const applySelected = () => {
      window.document.querySelectorAll('[data-ed-selected]').forEach((el) => el.removeAttribute('data-ed-selected'))
      if (selected.current) nodeMap.current?.get(selected.current)?.setAttribute('data-ed-selected', '')
      updateBadge()
    }
    const retag = () => {
      const doc = resolved.current
      if (!doc) return
      window.document.querySelectorAll('[data-ed-section]').forEach((el) => el.removeAttribute('data-ed-section'))
      const map = matchSectionNodes(doc.sections, sectionNodes(window.document))
      nodeMap.current = map
      map?.forEach((el, id) => el.setAttribute('data-ed-section', id))
      applySelected()
    }
    const retagSoon = () => window.requestAnimationFrame(retag)
    window.addEventListener('academia-editor-retag', retagSoon)

    const onOver = (e: MouseEvent) => {
      if (!interactive.current) return
      clearHover()
      const section = sectionOf(e.target as Element)
      if (section) { section.setAttribute('data-ed-hover', ''); hovered = section; updateBadge() }
    }
    const onLeave = () => clearHover()
    const onClick = (e: MouseEvent) => {
      if (!interactive.current) return
      const section = sectionOf(e.target as Element)
      if (!section) return
      e.preventDefault()
      e.stopPropagation()
      // O que foi clicado é decidido pela geometria, não por `elementsFromPoint`: imagens e camadas de efeito costumam ter
      // `pointer-events: none` e nunca aparecem ali. Vale o menor texto (com texto próprio) ou imagem/vídeo que contém o ponto.
      const x = e.clientX
      const y = e.clientY
      const candidates: { el: Element; area: number; text?: string; src?: string }[] = []
      section.querySelectorAll('*').forEach((el) => {
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2 || x < r.left || x > r.right || y < r.top || y > r.bottom) return
        const st = window.getComputedStyle(el)
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return
        const area = r.width * r.height
        if (el instanceof HTMLImageElement) { const src = el.getAttribute('src'); if (src) candidates.push({ el, area, src }) }
        else if (el instanceof HTMLVideoElement) { const src = el.getAttribute('src') ?? el.querySelector('source')?.getAttribute('src'); if (src) candidates.push({ el, area, src }) }
        else {
          const own = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join(' ').trim()
          if (own) candidates.push({ el, area, text: own })
        }
      })
      candidates.sort((a, b) => a.area - b.area)
      const primary = candidates[0]
      const texts: string[] = []
      const srcs: string[] = []
      if (primary?.src) srcs.push(primary.src)
      else {
        if (primary?.text) texts.push(primary.text)
        // Sem texto próprio sob o cursor (ex.: entre as linhas de um título): textos dos elementos que o envolvem.
        for (const el of window.document.elementsFromPoint(x, y)) {
          const t = (el.textContent ?? '').trim()
          if (section.contains(el) && el !== section && t && t.length <= 400) texts.push(t)
        }
      }
      picked = primary ? { el: primary.el, label: primary.el instanceof HTMLImageElement ? 'Imagem' : primary.el instanceof HTMLVideoElement ? 'Vídeo' : 'Texto' } : null
      // A seleção muda já aqui; o editor confirma em seguida (sem apagar o elemento marcado).
      selected.current = section.getAttribute('data-ed-section')
      applySelected()
      window.parent.postMessage({ type: EDITOR_PICK, sectionId: section.getAttribute('data-ed-section'), texts: texts.slice(0, 6), srcs: srcs.slice(0, 3) }, window.location.origin)
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return
      const msg = e.data as { type?: string; sectionId?: string | null; scroll?: boolean; on?: boolean }
      if (msg?.type === EDITOR_INTERACTIVE) {
        interactive.current = Boolean(msg.on)
        window.document.documentElement.toggleAttribute('data-ed-on', interactive.current)
        updateBadge()
        if (!interactive.current) { clearHover(); picked = null; window.document.querySelectorAll('[data-ed-selected]').forEach((el) => el.removeAttribute('data-ed-selected')) } else applySelected()
      }
      if (msg?.type === EDITOR_FOCUS) {
        // Trocar de seção (ou escolher na lista) limpa o elemento marcado.
        if (msg.scroll || msg.sectionId !== selected.current) picked = null
        selected.current = msg.sectionId ?? null
        if (interactive.current) applySelected()
        const node = selected.current ? nodeMap.current?.get(selected.current) : null
        if (msg.scroll && node) {
          const nav = window.document.querySelector('.cb-nav, .header') as HTMLElement | null
          const offset = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().height + 8 : 8
          window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' })
        }
      }
    }
    window.document.addEventListener('mouseover', onOver)
    window.document.addEventListener('mouseleave', onLeave)
    window.document.addEventListener('click', onClick, true)
    window.addEventListener('message', onMessage)
    window.addEventListener('scroll', updateBadge, { passive: true })
    window.addEventListener('resize', updateBadge)
    retagSoon()
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('scroll', updateBadge)
      window.removeEventListener('resize', updateBadge)
      badge.remove()
      frameEl.remove()
      pickEl.remove()
      window.cancelAnimationFrame(raf)
      window.removeEventListener('academia-editor-retag', retagSoon)
      window.document.removeEventListener('mouseover', onOver)
      window.document.removeEventListener('mouseleave', onLeave)
      window.document.removeEventListener('click', onClick, true)
      style.remove()
    }
  }, [])
  useEffect(() => { if (window.parent !== window) window.dispatchEvent(new Event('academia-editor-retag')) }, [document])

  let ctx: Parameters<typeof PageRenderer>[0]['ctx']
  let doc: PageDocument
  if (props.kind === 'professional') {
    doc = resolveProfessionalDocument({ data: props.data, document, courseCards: props.courseCards, templateKey: props.templateKey })
    ctx = { offer: NO_OFFER, year: new Date().getFullYear() }
  } else if (props.kind === 'home') {
    doc = resolveHomeDocument({ document, professionals: props.professionals, courses: props.courses })
    ctx = { offer: NO_OFFER, year: new Date().getFullYear() }
  } else {
    doc = resolveCourseDocument({ data: props.data, professional: props.professional, document })
    ctx = { offer: props.offer, year: new Date().getFullYear(), checkout: props.checkout ?? { mode: 'redirect', url: null } }
  }
  resolved.current = doc
  const rendered: ReactNode = <PageRenderer document={doc} ctx={ctx} />
  return <Boundary resetKey={document}>{rendered}</Boundary>
}
