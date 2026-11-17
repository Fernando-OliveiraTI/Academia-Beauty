import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { courseJsonLd, jsonLd, pageMetadata, personJsonLd, siteJsonLd } from './seo'

/** Id de mídia da biblioteca: 32 caracteres hexadecimais. */
const ID = 'a'.repeat(32)

beforeEach(() => vi.stubEnv('SITE_URL', 'https://academiabeauty.com.br'))
afterEach(() => vi.unstubAllEnvs())

describe('pageMetadata', () => {
  it('canonical, Open Graph e Twitter com imagem grande; título com o sufixo da marca só no compartilhamento', () => {
    const m = pageMetadata({ path: '/cursos/morena', title: 'Morena Iluminada · Lukas', description: 'Curso.', image: '/site/curso/capa.png' })
    expect(m.title).toBe('Morena Iluminada · Lukas')
    expect(m.alternates?.canonical).toBe('/cursos/morena')
    expect(m.openGraph).toMatchObject({ type: 'website', locale: 'pt_BR', title: 'Morena Iluminada · Lukas · Academia Beauty', url: '/cursos/morena' })
    expect(m.twitter).toMatchObject({ card: 'summary_large_image' })
  })
  it('imagem da biblioteca usa a largura certa; sem imagem o cartão é pequeno', () => {
    const withMedia = pageMetadata({ path: '/x', title: 'T', image: `/media/${ID}` })
    expect(JSON.stringify(withMedia.openGraph)).toContain(`/media/${ID}?w=1200`)
    expect(pageMetadata({ path: '/x', title: 'T' }).twitter).toMatchObject({ card: 'summary' })
  })
  it('absolute: título sem o sufixo do layout (Home)', () => {
    const m = pageMetadata({ path: '/', title: 'Academia Beauty', absolute: true })
    expect(m.title).toEqual({ absolute: 'Academia Beauty' })
    expect(m.openGraph).toMatchObject({ title: 'Academia Beauty' })
  })
})

describe('jsonLd', () => {
  it('escapa "<" para o texto do cadastro não fechar a tag <script>', () => {
    const out = jsonLd({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('<')
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>')
  })
})

describe('dados estruturados', () => {
  it('sem SITE_URL não emite nada', () => {
    vi.stubEnv('SITE_URL', '')
    expect(siteJsonLd()).toBeNull()
    expect(personJsonLd({ slug: 'ana', name: 'Ana', specialty: 'Hair', tagline: '', portraitSrc: '', instagramUrl: '' })).toBeNull()
    expect(courseJsonLd({ slug: 'c', title: 'C', description: '', coverSrc: '', professional: { slug: 'ana', name: 'Ana' }, offer: null })).toBeNull()
  })

  it('Home: organização e site com URL absoluta', () => {
    const data = siteJsonLd() as { '@graph': { '@type': string; url: string }[] }
    expect(data['@graph'].map((g) => g['@type'])).toEqual(['Organization', 'WebSite'])
    expect(data['@graph'][0]?.url).toBe('https://academiabeauty.com.br/')
  })

  it('Pessoa: omite campos vazios e usa imagem absoluta', () => {
    const data = personJsonLd({ slug: 'ana', name: 'Ana', specialty: 'Hair', tagline: '', portraitSrc: `/media/${ID}`, instagramUrl: '' }) as Record<string, unknown>
    expect(data['@type']).toBe('Person')
    expect(data.url).toBe('https://academiabeauty.com.br/profissionais/ana')
    expect(data.image).toBe(`https://academiabeauty.com.br/media/${ID}?w=1200`)
    expect(data).not.toHaveProperty('description')
    expect(data).not.toHaveProperty('sameAs')
  })

  it('Curso: declara a oferta só quando há compra disponível, com preço em reais', () => {
    const base = { slug: 'morena', title: 'Morena', description: 'D', coverSrc: '', professional: { slug: 'ana', name: 'Ana' } }
    const buyable = courseJsonLd({ ...base, offer: { totalCents: 17500 } }) as Record<string, unknown>
    expect(buyable['@type']).toBe('Course')
    expect(buyable.offers).toMatchObject({ '@type': 'Offer', price: '175.00', priceCurrency: 'BRL' })
    expect(courseJsonLd({ ...base, offer: null })).not.toHaveProperty('offers')
    expect(courseJsonLd({ ...base, offer: { totalCents: 0 } })).not.toHaveProperty('offers')
  })
})
