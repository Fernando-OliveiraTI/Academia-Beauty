import { describe, expect, it } from 'vitest'
import { SECTION_META, SCHEMA_VERSION, TEMPLATE_PREFIX, editorRules, metaFor, sectionsOfTemplate, validatePageDocument } from './index.js'

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

  it('regras do editor: tudo único, obrigatórias e região por tipo', () => {
    const rules = editorRules('professional-original')
    expect(rules.singleton.has('professional.bio')).toBe(true)
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

  it('impõe o que o editor impõe: seção obrigatória presente e cada tipo no máximo uma vez', () => {
    const bioSec = section('bio', 'professional.bio', bio)
    const noHero = validatePageDocument(doc('professional-original', bioSec))
    expect(noHero).toMatchObject({ ok: false })
    expect(JSON.stringify(noHero)).toContain('obrigatória')
    expect(validatePageDocument(doc('professional-original'))).toMatchObject({ ok: false })
    const dup = validatePageDocument(doc('professional-original', heroSec, bioSec, { ...bioSec, id: 'bio-2' }))
    expect(JSON.stringify(dup)).toContain('sections.2.type')
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
