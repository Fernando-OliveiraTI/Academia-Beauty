import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { professionalDataSchema, type ProfessionalData } from '@academia/contracts'
import env from '#start/env'
import Professional from '#models/professional'
import ProfessionalService from '#services/professional_service'
import User from '#models/user'

const HOME = '/site/home'
const PRO = '/site/profissional'

/** Conteúdo da página aprovada (Lukas_20). A grafia "Lucas Kampos" × "Lukas Campos" segue pendente de decisão do negócio. */
const lukas: ProfessionalData = professionalDataSchema.parse({
  name: 'Lukas Campos',
  specialty: 'Hair',
  tagline: 'Seus sucessos na carreira e sua jornada profissional.',
  experienceYears: 15,
  instagramHandle: '@lucascam',
  instagramFollowers: '53,6 Mil seguidores',
  instagramUrl: 'https://instagram.com/lucascam',
  portraitSrc: `${PRO}/lukas_perfil.png`,
  cardPhotoSrc: `${HOME}/lukas-campos.png`,
  bio: [
    'Lucas Kampos iniciou sua carreira há 15 anos, inspirado por seus tios. Ele começou em um renomado salão na zona sul, onde trabalhou por um longo período.',
    "Posteriormente, juntou-se a Romeu Felipe, o que elevou ainda mais sua qualificação profissional. Em apenas dois meses, tornou-se colorista e atendeu celebridades como Tassia Naves, Fernanda Souza, modelos da Victoria's Secret, Ticiane Pinheiro e Munik Nunes. Lucas também ministrou cursos em todo o Brasil e visitou cidades como Moscou, Berlim, Istambul, Londres, além dos EUA e Portugal, acumulando um currículo impressionante. Atualmente, é um dos principais profissionais da equipe ROM CONCEPT.",
  ],
  works: [
    {
      imageSrc: `${PRO}/trabLukas01.png`,
      alt: 'Morena Iluminada',
      title: 'Morena Iluminada – Técnica & Contraste',
      tags: ['mechas'],
    },
    {
      imageSrc: `${PRO}/trabLukas02.png`,
      alt: 'Loiro Dourado Suave',
      title: 'Loiro Dourado – Transição Natural',
      tags: ['loiro'],
    },
    {
      imageSrc: `${PRO}/trabLukas03.png`,
      alt: 'Corte e Textura',
      title: 'Corte & Textura – Movimento e Brilho',
      tags: ['corte & cor'],
    },
  ],
  videoSrc: `${PRO}/video.mp4`,
})

// Os demais só têm nome e foto na Home aprovada: ficam como rascunho até alguém completar o cadastro.
const others = [
  { slug: 'cleber-venancio', name: 'Cleber Venâncio', photo: 'cleber-venancio.png' },
  { slug: 'neandro-ferreira', name: 'Neandro Ferreira', photo: 'neandro-ferreira.png' },
  { slug: 'paolo-civita', name: 'Paolo Civita', photo: 'paolo-civita.png' },
  { slug: 'miro-rodrigues', name: 'Miro Rodrigues', photo: 'miro-rodrigues.png' },
]

/** Somente desenvolvimento: dados de demonstração a partir do conteúdo aprovado. Idempotente. */
export default class extends BaseSeeder {
  static environment = ['development']

  async run() {
    if (env.get('NODE_ENV') !== 'development') return
    const admin = await User.findBy('email', env.get('ADMIN_EMAIL')?.toLowerCase() ?? '')
    const actorId = admin?.id ?? 0

    if (!(await Professional.findBy('slug', 'lukas-campos'))) {
      const created = await ProfessionalService.create('lukas-campos', lukas, actorId)
      await ProfessionalService.publish(created.id, actorId)
      await ProfessionalService.setShowcase(
        created.id,
        { homeVisible: true, homeOrder: 10, featured: true },
        actorId
      )
    }

    for (const [index, other] of others.entries()) {
      if (await Professional.findBy('slug', other.slug)) continue
      const data = professionalDataSchema.parse({
        name: other.name,
        specialty: 'A definir',
        cardPhotoSrc: `${HOME}/${other.photo}`,
      })
      const created = await ProfessionalService.create(other.slug, data, actorId)
      await ProfessionalService.setShowcase(
        created.id,
        { homeVisible: true, homeOrder: 20 + index, featured: false },
        actorId
      )
    }
  }
}
