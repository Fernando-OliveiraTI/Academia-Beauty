'use client'

import { Component, useEffect, useState, type ReactNode } from 'react'
import type { PageDocument } from '@academia/page-schema'
import { validatePageDocument } from '@academia/section-schemas'
import type { CourseCard, CourseData, HomeCourseCard, ProfessionalData, ShowcaseItem } from '@academia/contracts'
import { NO_OFFER, PageRenderer, resolveCourseDocument, resolveHomeDocument, resolveProfessionalDocument, type OfferView } from '@academia/page-renderer'

export const EDITOR_MESSAGE = 'academia-editor-document'

type Props =
  | { kind: 'professional'; initial: PageDocument | null; data: ProfessionalData; courseCards: CourseCard[]; templateKey: string }
  | { kind: 'course'; initial: PageDocument | null; data: CourseData; professional: ProfessionalData; offer: OfferView }
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

  let rendered: ReactNode
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
    ctx = { offer: props.offer, year: new Date().getFullYear(), checkout: { mode: 'redirect', url: null } }
  }
  rendered = <PageRenderer document={doc} ctx={ctx} />
  return <Boundary resetKey={document}>{rendered}</Boundary>
}
