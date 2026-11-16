// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { matchSectionNodes, sectionNodes } from './section-dom'

const page = (html: string) => {
  document.body.innerHTML = html
  return sectionNodes(document)
}
const sec = (id: string, type: string) => ({ id, type, visibility: { enabled: true } })

describe('sectionNodes', () => {
  it('ignora a navegação lateral do curso: ela é parte do Cabeçalho, não uma seção', () => {
    const nodes = page(
      '<div class="pg-course"><a class="skip-link"></a><div class="scroll-progress"></div><header></header><nav class="nav side-nav"></nav><main><section id="a"></section><section id="b"></section></main><footer></footer></div>'
    )
    expect(nodes).toHaveLength(4)
    const map = matchSectionNodes([sec('h', 'course.header'), sec('a', 'course.hero'), sec('b', 'course.facts'), sec('f', 'course.footer')], nodes)
    expect(map).not.toBeNull()
    expect(map!.get('a')?.id).toBe('a')
  })

  it('contagem diferente continua sem ligação (melhor que ligação trocada)', () => {
    const nodes = page('<div class="pg-course"><header></header><main><section></section></main></div>')
    expect(matchSectionNodes([sec('h', 'course.header'), sec('a', 'course.hero'), sec('b', 'course.facts')], nodes)).toBeNull()
  })

  it('seção com fundo escolhido (invólucro .pg-bg) liga ao elemento da seção, não ao invólucro', () => {
    const nodes = page('<div class="pg-course"><header></header><main><section id="a"></section><div class="pg-bg" data-bg="gold"><section id="b"></section></div></main></div>')
    expect(nodes.map((n) => n.id)).toEqual(['', 'a', 'b'])
    const map = matchSectionNodes([sec('h', 'course.header'), sec('a', 'course.facts'), sec('b', 'course.faq')], nodes)
    expect(map!.get('b')?.id).toBe('b')
  })
})

describe('fieldAnchor', async () => {
  const { fieldAnchor } = await import('./section-dom')
  const hero = { sub: 'Frase', hud: { label: 'Expert / Hair', accent: '', value: '' }, portrait: { src: '/site/placeholder.svg', alt: 'Ana' }, meta: [{ label: 'Instagram', value: '@ana' }] }

  it('campo com valor: o próprio texto ou arquivo', () => {
    expect(fieldAnchor(hero, 'sub')).toEqual({ texts: ['Frase'], srcs: [], container: false })
    expect(fieldAnchor(hero, 'portrait.src')).toEqual({ texts: [], srcs: ['/site/placeholder.svg'], container: false })
  })

  it('campo vazio (pendência): os vizinhos, marcando o bloco que os envolve', () => {
    expect(fieldAnchor(hero, 'hud.accent')).toEqual({ texts: ['Expert / Hair'], srcs: [], container: true })
  })

  it('lista: o primeiro texto dentro dela; links não servem de âncora', () => {
    expect(fieldAnchor({ cards: [{ title: 'Técnica', text: 'Passo' }] }, 'cards').texts).toEqual(['Técnica', 'Passo'])
    // Sem vizinho visível: nada a marcar (fica só o destaque da seção), em vez de marcar um bloco errado.
    expect(fieldAnchor({ instagram: { handle: '', href: 'https://x.com' }, title: 'T' }, 'instagram.handle')).toEqual({ texts: [], srcs: [], container: true })
  })
})
