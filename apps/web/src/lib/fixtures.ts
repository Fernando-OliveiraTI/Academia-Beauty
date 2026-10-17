import type { CourseCard, ProfessionalData } from '@academia/contracts'
import type { OfferView } from '@academia/page-renderer'

/**
 * Oferta de exemplo da pré-visualização (R$ 250,00, 30% de desconto, até 6x sem juros).
 * Provisória: na fase de comércio o backend entrega esta visão e a página nunca calcula preço.
 */
export const previewCourseOffer: OfferView = {
  listCents: 25000,
  discountPct: 30,
  discountCents: 7500,
  totalCents: 17500,
  installments: [
    { count: 1, amountCents: 17500 },
    { count: 2, amountCents: 8750 },
    { count: 3, amountCents: 5833 },
    { count: 4, amountCents: 4375 },
    { count: 5, amountCents: 3500 },
    { count: 6, amountCents: 2917 },
  ],
}

/** Profissional de exemplo (Lukas Campos) para as pré-visualizações dos modelos de página. */
export const previewProfessional: ProfessionalData = {
  name: 'Lukas Campos',
  specialty: 'Hair',
  tagline: 'Seus sucessos na carreira e sua jornada profissional.',
  experienceYears: 15,
  instagramHandle: '@lucascam',
  instagramFollowers: '53,6 Mil seguidores',
  instagramUrl: 'https://instagram.com/lucascam',
  portraitSrc: '/site/profissional/lukas_perfil.png',
  cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: [
    'Lucas Kampos iniciou sua carreira há 15 anos, inspirado por seus tios. Começou em um renomado salão na zona sul, onde trabalhou por um longo período.',
    'Posteriormente, juntou-se a Romeu Felipe, o que elevou ainda mais sua qualificação profissional.',
  ],
  works: [
    { imageSrc: '/site/profissional/trabLukas01.png', alt: 'Morena Iluminada', title: 'Morena Iluminada – Técnica & Contraste', tags: ['mechas'] },
    { imageSrc: '/site/profissional/trabLukas02.png', alt: 'Loiro Dourado Suave', title: 'Loiro Dourado – Transição Natural', tags: ['loiro'] },
    { imageSrc: '/site/profissional/trabLukas03.png', alt: 'Corte e Textura', title: 'Corte & Textura – Movimento e Brilho', tags: ['corte & cor'] },
  ],
  videoSrc: '/site/profissional/video.mp4',
  metaDescription: '',
}

export const previewCourseCards: CourseCard[] = [
  { slug: 'morena-iluminada', title: 'Morena Iluminada', coverSrc: '/site/curso/produto-morena-iluminada.svg', coverAlt: 'Morena Iluminada', discountPct: 30 },
]
