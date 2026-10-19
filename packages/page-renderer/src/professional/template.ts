import type { PageDocument } from '@academia/page-schema';
import { SCHEMA_VERSION } from '../schemas-version';
import type * as S from './schemas';
import type { ProfessionalFooterContent } from './footer-schema';

export const PROFESSIONAL_TEMPLATE_KEY = 'professional-original';

const BASE = '/site/profissional';
/** Capa local: a imagem remota da Shopify do original não é usada (D-004, item 6). */
const COURSE_COVER = '/site/curso/produto-morena-iluminada.svg';

const section = <C,>(id: string, type: string, content: C) => ({
  id, type, schemaVersion: SCHEMA_VERSION, visibility: { enabled: true }, settings: {}, content: content as Record<string, unknown>,
});

const nav: S.NavContent = {
  brandLead: 'ACADEMIA', brandAccent: 'BEAUTY',
  links: [{ label: 'Trabalhos', href: '#trabalhos' }, { label: 'Conheça', href: '#video' }, { label: 'Cursos', href: '#cursos' }],
  account: { label: 'Acessar conta ↗', href: '/admin/login' },
};

const hero: S.HeroContent = {
  eyebrow: 'Profissional / Academia Beauty',
  nameFirst: 'Lukas', nameAccent: 'Campos.',
  sub: 'Seus sucessos na carreira e sua jornada profissional.',
  meta: [{ label: 'Instagram', value: '@lucascam' }, { label: 'Comunidade', value: '53,6 Mil seguidores', gold: true }],
  portrait: { src: `${BASE}/lukas_perfil.png`, alt: 'Lukas Campos' },
  hud: { label: 'Expert / Hair', accent: '15', value: 'anos' },
};

const bio: S.BioContent = {
  tickerUnit: 'LUKAS • ACADEMIA BEAUTY • ',
  sectionIndex: '01 / TRAJETÓRIA',
  titleLead: 'Uma carreira construída com', titleStrong: 'técnica.',
  paragraphs: [
    'Lucas Kampos iniciou sua carreira há 15 anos, inspirado por seus tios. Ele começou em um renomado salão na zona sul, onde trabalhou por um longo período.',
    "Posteriormente, juntou-se a Romeu Felipe, o que elevou ainda mais sua qualificação profissional. Em apenas dois meses, tornou-se colorista e atendeu celebridades como Tassia Naves, Fernanda Souza, modelos da Victoria's Secret, Ticiane Pinheiro e Munik Nunes. Lucas também ministrou cursos em todo o Brasil e visitou cidades como Moscou, Berlim, Istambul, Londres, além dos EUA e Portugal, acumulando um currículo impressionante. Atualmente, é um dos principais profissionais da equipe ROM CONCEPT.",
  ],
  // O original apontava para instagram.com/@lucascam, que não é uma URL válida.
  instagram: { handle: '@lucascam', followers: '53,6 Mil seguidores', href: 'https://instagram.com/lucascam' },
};

const works: S.WorksContent = {
  eyebrow: 'Trabalhos em Destaque',
  titleLead: 'Assinatura que aparece', titleAccent: 'nos detalhes.',
  copy: 'Uma seleção exclusiva de trabalhos de Lukas Campos, explorando técnicas avançadas de mechas, iluminação e acabamento.',
  items: [
    { image: { src: `${BASE}/trabLukas01.png`, alt: 'Morena Iluminada' }, tags: [{ label: 'destaques', gold: true }, { label: 'mechas' }], person: 'Lukas Campos', title: 'Morena Iluminada – Técnica & Contraste', plusLabel: 'Ver detalhes de Morena Iluminada', href: '#video' },
    { image: { src: `${BASE}/trabLukas02.png`, alt: 'Loiro Dourado Suave' }, tags: [{ label: 'destaques', gold: true }, { label: 'loiro' }], person: 'Lukas Campos', title: 'Loiro Dourado – Transição Natural', plusLabel: 'Ver detalhes de Loiro Dourado', href: '#video' },
    { image: { src: `${BASE}/trabLukas03.png`, alt: 'Corte e Textura' }, tags: [{ label: 'destaques', gold: true }, { label: 'corte & cor' }], person: 'Lukas Campos', title: 'Corte & Textura – Movimento e Brilho', plusLabel: 'Ver detalhes de Corte e Textura', href: '#video' },
  ],
};

const video: S.VideoContent = {
  sectionIndex: '03 / CONHEÇA',
  titleLead: 'Conheça', titleAccent: 'Lukas Campos.',
  text: 'Veja a apresentação do profissional e conheça mais de perto sua trajetória e trabalho.',
  video: { src: `${BASE}/video.mp4`, type: 'video/mp4', ariaLabel: 'Vídeo de apresentação de Lukas Campos', fallback: 'Seu navegador não suporta reprodução de vídeo HTML5.' },
};

const courses: S.CoursesContent = {
  sectionIndex: '04 / CURSOS',
  title: 'Cursos de Lukas.',
  text: 'Conteúdo para aprofundar técnicas e aprender diretamente com o profissional.',
  // O curso e o desconto virão do catálogo publicado (Fase 4); o link do original apontava para uma loja Shopify de teste.
  cards: [{ href: '/preview/curso', image: { src: COURSE_COVER, alt: 'Morena Iluminada' }, titleLead: 'Morena', titleAccent: 'Iluminada', badge: '30% OFF', person: 'Lukas Campos' }],
};

const footer: ProfessionalFooterContent = {
  logoLead: 'ACADEMIA', logoAccent: 'BEAUTY',
  socials: [
    { icon: 'facebook', label: 'Facebook', href: '#' }, { icon: 'instagram', label: 'Instagram', href: '#' },
    { icon: 'youtube', label: 'YouTube', href: '#' }, { icon: 'tiktok', label: 'TikTok', href: '#' }, { icon: 'x', label: 'X', href: '#' },
  ],
  copyright: 'Todos os direitos reservados © {year} Academia Beauty',
};

/** Template "Profissional Original" v1: conteúdo e ordem da página aprovada (Lukas_20). */
export const professionalOriginalTemplate: PageDocument = {
  schemaVersion: 1,
  template: { key: PROFESSIONAL_TEMPLATE_KEY, version: 1 },
  sections: [
    section('nav', 'professional.nav', nav),
    section('hero', 'professional.hero', hero),
    section('bio', 'professional.bio', bio),
    section('works', 'professional.works', works),
    section('video', 'professional.video', video),
    section('courses', 'professional.courses', courses),
    section('footer', 'professional.footer', footer),
  ],
};
