import type { Metadata } from 'next'
import { mediaSrc } from '@academia/page-renderer'
import { absoluteUrl } from '@/lib/site'

export const SITE_NAME = 'Academia Beauty'

type MetaInput = {
  /** Caminho canônico (ex.: `/cursos/morena-iluminada`). */
  path: string
  /** Título da aba. O layout acrescenta " · Academia Beauty", exceto com `absolute`. */
  title: string
  /** Usa o título como está (Home), sem o sufixo do layout. */
  absolute?: boolean
  description?: string
  /** Caminho da imagem de compartilhamento (mídia da biblioteca ou arquivo do site). */
  image?: string
  /** `website` para a Home e os cursos; `profile` para a página de um profissional. */
  type?: 'website' | 'profile'
}

/** Canonical, Open Graph e cartão do Twitter de uma página pública (URLs relativas viram absolutas via `metadataBase`). */
export function pageMetadata({ path, title, absolute = false, description, image, type = 'website' }: MetaInput): Metadata {
  const fullTitle = absolute ? title : `${title} · ${SITE_NAME}`
  const images = image ? [{ url: mediaSrc(image, 1200) }] : undefined
  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type, locale: 'pt_BR', siteName: SITE_NAME, title: fullTitle, description, url: path, images },
    twitter: { card: images ? 'summary_large_image' : 'summary', title: fullTitle, description, images: images?.map((i) => i.url) },
  }
}

/** Serializa JSON-LD para `<script>`: `<` escapado impede fechar a tag com texto vindo do cadastro. */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

const compact = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))) as Partial<T>

/** Organização e site (Home). Sem `SITE_URL` não há URL absoluta: devolve null e a página não emite JSON-LD. */
export function siteJsonLd(): object | null {
  const url = absoluteUrl('/')
  if (!url) return null
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${url}#organization`, name: SITE_NAME, url },
      { '@type': 'WebSite', '@id': `${url}#website`, name: SITE_NAME, url, inLanguage: 'pt-BR', publisher: { '@id': `${url}#organization` } },
    ],
  }
}

type ProfessionalLdInput = { slug: string; name: string; specialty: string; tagline: string; portraitSrc: string; instagramUrl: string }

export function personJsonLd(p: ProfessionalLdInput): object | null {
  const url = absoluteUrl(`/profissionais/${p.slug}`)
  if (!url) return null
  const image = p.portraitSrc ? absoluteUrl(mediaSrc(p.portraitSrc, 1200)) : undefined
  return {
    '@context': 'https://schema.org',
    ...compact({
      '@type': 'Person',
      '@id': `${url}#person`,
      name: p.name,
      url,
      jobTitle: p.specialty,
      description: p.tagline,
      image,
      sameAs: p.instagramUrl ? [p.instagramUrl] : undefined,
      worksFor: { '@type': 'Organization', name: SITE_NAME },
    }),
  }
}

type CourseLdInput = {
  slug: string
  title: string
  description: string
  coverSrc: string
  professional: { slug: string; name: string }
  /** `null` = sem compra disponível (sem oferta ou checkout indisponível): não declara `offers`. */
  offer: { totalCents: number } | null
}

export function courseJsonLd(c: CourseLdInput): object | null {
  const url = absoluteUrl(`/cursos/${c.slug}`)
  if (!url) return null
  const image = c.coverSrc ? absoluteUrl(mediaSrc(c.coverSrc, 1200)) : undefined
  return {
    '@context': 'https://schema.org',
    ...compact({
      '@type': 'Course',
      name: c.title,
      description: c.description,
      url,
      image,
      inLanguage: 'pt-BR',
      provider: { '@type': 'Organization', name: SITE_NAME, url: absoluteUrl('/') },
      author: { '@type': 'Person', name: c.professional.name, url: absoluteUrl(`/profissionais/${c.professional.slug}`) },
      offers: c.offer && c.offer.totalCents > 0
        ? { '@type': 'Offer', price: (c.offer.totalCents / 100).toFixed(2), priceCurrency: 'BRL', availability: 'https://schema.org/InStock', url }
        : undefined,
    }),
  }
}
