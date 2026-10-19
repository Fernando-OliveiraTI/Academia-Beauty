import { describe, expect, it } from 'vitest'
import { MAX_PER_REPEATABLE_TYPE, MAX_SECTIONS_PER_DOCUMENT, SECTION_META, SCHEMA_VERSION, TEMPLATE_PREFIX, editorRules, isRepeatable, metaFor, sectionsOfTemplate, backgroundSchemeOf, backgroundsFor, validatePageDocument } from './index.js'

const section = (id: string, type: string, content: unknown) => ({ id, type, schemaVersion: SCHEMA_VERSION, visibility: { enabled: true }, settings: {}, content })
const doc = (template: string, ...sections: unknown[]) => ({ schemaVersion: 1, template: { key: template, version: 1 }, sections })

describe('catálogo de seções', () => {
  it('tipos únicos, com prefixo de template conhecido e exatamente uma seção obrigatória de hero por template', () => {
    const types = SECTION_META.map((s) => s.type)
    expect(new Set(types).size).toBe(types.length)
    for (const type of types) expect(Object.values(TEMPLATE_PREFIX).some((p) => type.startsWith(p)), type).toBe(true)
    for (const key of Object.keys(TEMPLATE_PREFIX)) {
      expect(sectionsOfTemplate(key).some((s) => s.required && s.type.endsWith('.hero')), key).toBe(true)
    }
    expect(sectionsOfTemplate('inexistente')).toEqual([])
    expect(metaFor('course.hero')?.placement).toBe('main')
    expect(metaFor('nada')).toBeUndefined()
  })

  it('regras do editor: tipos únicos, repetíveis com limite, obrigatórias e região por tipo', () => {
    const rules = editorRules('professional-original')
    expect(rules.singleton.has('professional.stats')).toBe(true)
    expect(rules.singleton.has('professional.bio')).toBe(false)
    expect(rules.maxPerType.get('professional.bio')).toBe(MAX_PER_REPEATABLE_TYPE)
    expect(rules.maxSections).toBe(MAX_SECTIONS_PER_DOCUMENT)
    expect(rules.maxPerType.has('professional.hero')).toBe(false)
    expect(rules.singleton.has('course.hero')).toBe(false)
    expect(rules.required.has('professional.hero')).toBe(true)
    expect(rules.placementOf('professional.nav')).toBe('banner')
    expect(rules.placementOf('professional.footer')).toBe('contentinfo')
    expect(rules.placementOf('course.hero')).toBeUndefined()
  })
})

describe('validatePageDocument', () => {
  const hero = { eyebrow: 'E', nameFirst: 'Ana', nameAccent: 'Souza.', sub: 's', meta: [], portrait: { src: '/site/a.png', alt: 'Ana' }, hud: { label: 'Expert', accent: '10', value: 'anos' } }
  const heroSec = section('hero', 'professional.hero', hero)
  const bio = { tickerUnit: 'A • ', sectionIndex: '01', titleLead: 'Lead', titleStrong: 'forte.', paragraphs: ['Texto.'], instagram: { handle: '@a', followers: '1', href: 'https://instagram.com/a' } }

  it('aceita documento válido (idempotente, sem exigir registro prévio)', () => {
    expect(validatePageDocument(doc('professional-original', heroSec, section('bio', 'professional.bio', bio))).ok).toBe(true)
    expect(validatePageDocument(doc('professional-original', heroSec, section('bio', 'professional.bio', bio))).ok).toBe(true)
  })

  it('recusa template desconhecido, seção de outro template, tipo inexistente e marcação', () => {
    expect(validatePageDocument(doc('outro', section('bio', 'professional.bio', bio)))).toMatchObject({ ok: false })
    expect(validatePageDocument(doc('professional-original', section('x', 'course.sticky-cta', { ctaLabel: 'a' })))).toMatchObject({ ok: false })
    expect(validatePageDocument(doc('professional-original', section('x', 'professional.nada', {})))).toMatchObject({ ok: false })
    expect(validatePageDocument(doc('professional-original', section('bio', 'professional.bio', { ...bio, titleLead: '<b>x</b>' })))).toMatchObject({ ok: false })
    expect(validatePageDocument(doc('professional-original', section('bio', 'professional.bio', { ...bio, instagram: { ...bio.instagram, href: 'javascript:alert(1)' } })))).toMatchObject({ ok: false })
    expect(validatePageDocument(null)).toMatchObject({ ok: false })
  })

  it('recusa ids duplicados e versão de schema futura', () => {
    const a = section('bio', 'professional.bio', bio)
    expect(validatePageDocument(doc('professional-original', a, a))).toMatchObject({ ok: false })
    expect(validatePageDocument(doc('professional-original', { ...a, schemaVersion: 99 }))).toMatchObject({ ok: false })
  })

  it('impõe o que o editor impõe: seção obrigatória presente e tipos únicos no máximo uma vez', () => {
    const bioSec = section('bio', 'professional.bio', bio)
    const noHero = validatePageDocument(doc('professional-original', bioSec))
    expect(noHero).toMatchObject({ ok: false })
    expect(JSON.stringify(noHero)).toContain('obrigatória')
    expect(validatePageDocument(doc('professional-original'))).toMatchObject({ ok: false })
    const dup = validatePageDocument(doc('professional-original', { ...heroSec, id: 'hero-2' }, heroSec, bioSec))
    expect(JSON.stringify(dup)).toContain('sections.1.type')
  })

  it('tipos repetíveis: até o limite por tipo e por documento; além disso é recusado', () => {
    const bioSec = section('bio', 'professional.bio', bio)
    expect(isRepeatable('professional.bio')).toBe(true)
    expect(isRepeatable('professional.hero')).toBe(false)
    const copies = (n: number) => Array.from({ length: n }, (_, i) => ({ ...bioSec, id: i === 0 ? 'bio' : `bio-${i + 1}` }))
    expect(validatePageDocument(doc('professional-original', heroSec, ...copies(MAX_PER_REPEATABLE_TYPE)))).toMatchObject({ ok: true })
    const over = validatePageDocument(doc('professional-original', heroSec, ...copies(MAX_PER_REPEATABLE_TYPE + 1)))
    expect(over).toMatchObject({ ok: false })
    expect(JSON.stringify(over)).toContain('acima do limite')
    // Mesmo repetíveis, o documento todo respeita o teto de seções.
    const many = [heroSec, ...Array.from({ length: MAX_SECTIONS_PER_DOCUMENT }, (_, i) => ({ ...bioSec, id: `x-${i}` }))]
    expect(JSON.stringify(validatePageDocument(doc('professional-original', ...many)))).toContain('no máximo')
  })

  it('fundo da seção: cada seção só aceita tons do próprio esquema de cores; sem suporte ou fora da lista é recusado', () => {
    const bioSec = section('bio', 'professional.bio', bio)
    // Trajetória é texto escuro sobre fundo claro: tons claros.
    expect(backgroundSchemeOf('professional-original', 'professional.bio')).toBe('light')
    expect(backgroundsFor('professional-original', 'professional.bio')).toEqual(['white', 'paper', 'gold'])
    expect(backgroundSchemeOf('professional-original', 'professional.video')).toBe('dark')
    // Trabalhos muda de esquema conforme o modelo.
    expect(backgroundSchemeOf('professional-original', 'professional.works')).toBe('light')
    expect(backgroundSchemeOf('professional-immersive', 'professional.works')).toBe('dark')
    expect(backgroundSchemeOf('professional-premium', 'professional.works')).toBe('dark')
    expect(backgroundSchemeOf('course-original', 'course.faq')).toBe('dark')
    for (const none of [['professional-original', 'professional.hero'], ['course-original', 'course.offer'], ['course-original', 'course.checkout'], ['home-original', 'home.benefits'], ['professional-original', 'professional.nav']] as const) {
      expect(backgroundsFor(none[0], none[1]), none.join(' ')).toEqual([])
    }
    const withTone = (tone: unknown) => validatePageDocument(doc('professional-original', heroSec, { ...bioSec, settings: { background: tone } }))
    expect(withTone('gold')).toMatchObject({ ok: true })
    expect(withTone('paper')).toMatchObject({ ok: true })
    // Tom escuro em seção de texto escuro (contraste ruim): recusado com a lista permitida.
    const wrongScheme = withTone('dark')
    expect(wrongScheme).toMatchObject({ ok: false })
    expect(JSON.stringify(wrongScheme)).toContain('não combina')
    expect(withTone('vermelho')).toMatchObject({ ok: false })
    expect(withTone('#ff0000')).toMatchObject({ ok: false })
    const onHero = validatePageDocument(doc('professional-original', { ...heroSec, settings: { background: 'dark' } }, bioSec))
    expect(onHero).toMatchObject({ ok: false })
    expect(JSON.stringify(onHero)).toContain('não aceita fundo')
  })

  it('settings livres, variante inválida, documento fundo demais ou grande demais são recusados', () => {
    const ok = [heroSec]
    expect(validatePageDocument(doc('professional-original', { ...heroSec, settings: { qualquer: 1 } }))).toMatchObject({ ok: false })
    expect(validatePageDocument(doc('professional-original', { ...heroSec, variant: 'A B' }))).toMatchObject({ ok: false })
    let deep: unknown = 'x'
    for (let i = 0; i < 30; i += 1) deep = { a: deep }
    expect(validatePageDocument({ ...doc('professional-original', ...ok), extra: deep })).toMatchObject({ ok: false })
    const big = { ...heroSec, content: { ...hero, sub: 'x'.repeat(600 * 1024) } }
    expect(validatePageDocument(doc('professional-original', big))).toMatchObject({ ok: false })
  })

  it('URLs: recusa barra invertida, tab/LF e //host; mídia só caminho interno', () => {
    const withHref = (href: string) => doc('professional-original', heroSec, section('bio', 'professional.bio', { ...bio, instagram: { ...bio.instagram, href } }))
    for (const bad of ['/\\evil.com', '/\t/evil.com', '/\n/evil.com', '//evil.com', 'javascript:alert(1)', 'https://a.com/ b']) {
      expect(validatePageDocument(withHref(bad)).ok, JSON.stringify(bad)).toBe(false)
    }
    for (const good of ['/rota', '#ancora', 'https://instagram.com/a', 'mailto:a@b.com']) expect(validatePageDocument(withHref(good)).ok, good).toBe(true)
    const withImage = (src: string) => doc('professional-original', section('hero', 'professional.hero', { ...hero, portrait: { src, alt: 'a' } }))
    expect(validatePageDocument(withImage('/site/a.png')).ok).toBe(true)
    expect(validatePageDocument(withImage('https://cdn.exemplo.com/a.png')).ok).toBe(false)
    expect(validatePageDocument(withImage('//cdn.exemplo.com/a.png')).ok).toBe(false)
  })
})
