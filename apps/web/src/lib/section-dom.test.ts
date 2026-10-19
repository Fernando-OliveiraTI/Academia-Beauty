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
})
