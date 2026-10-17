import type { PageDocument } from '@academia/page-schema';
import { SCHEMA_VERSION } from '../schemas-version';
import type * as S from './schemas';

export const HOME_TEMPLATE_KEY = 'home-original';

const BASE = '/site/home';

const section = <C,>(id: string, type: string, content: C) => ({
  id, type, schemaVersion: SCHEMA_VERSION, visibility: { enabled: true }, settings: {}, content: content as Record<string, unknown>,
});

const nav: S.NavContent = {
  ariaLabel: 'Navegação principal',
  brandLead: 'ACADEMIA', brandAccent: 'BEAUTY', brandHref: '#',
  links: [{ label: 'CURSOS', href: '#cursos-home' }, { label: 'PROFISSIONAIS', href: '#profissionais' }, { label: 'QUEM SOMOS', href: '#beneficios' }],
  // O destino real é o login da plataforma (a definir); o original apontava para a loja Shopify.
  account: { label: 'ACESSAR CONTA', href: '#' },
};

const hero: S.HeroContent = {
  kicker: 'Academia Beauty / Educação profissional',
  titleLead: 'Aprenda e cresça', titleOutline: 'com os melhores.',
  copy: [
    { text: 'Falta pouco para transformar a sua carreira em sucesso.' },
    { text: 'Aprenda com grandes profissionais técnicas, cortes e estratégias de gestão.', highlight: true },
    { text: 'Encontre produtos com os melhores preços e veja a sua marca brilhar.' },
  ],
  cta: { label: 'Quero aprender', href: '#cursos-home' },
  miniProof: 'conteúdo • técnica • evolução',
  image: { src: `${BASE}/elenco-hero.png`, alt: 'Profissionais Academia Beauty' },
};

// Os destinos /profissionais/[slug] e /cursos/[slug] passam a existir com o CMS (Fases 3 e 4).
const professionals: S.ProfessionalsContent = {
  marquee: 'PROFISSIONAIS • ACADEMIA BEAUTY • PROFISSIONAIS • ACADEMIA BEAUTY • ',
  titleLead: 'QUEM FAZ PARTE DA', titleInner: 'ACADEMIA', titleTail: 'BEAUTY',
  prevLabel: 'Profissional anterior', nextLabel: 'Próximo profissional', cardLabel: 'Conheça',
  items: [
    { name: 'Lukas Campos', photo: `${BASE}/lukas-campos.png`, href: '/preview/profissional' },
    { name: 'Cleber Venâncio', photo: `${BASE}/cleber-venancio.png`, href: '/profissionais/cleber-venancio' },
    { name: 'Neandro Ferreira', photo: `${BASE}/neandro-ferreira.png`, href: '/profissionais/neandro-ferreira' },
    { name: 'Paolo Civita', photo: `${BASE}/paolo-civita.png`, href: '/profissionais/paolo-civita' },
    { name: 'Miro Rodrigues', photo: `${BASE}/miro-rodrigues.png`, href: '/profissionais/miro-rodrigues' },
  ],
};

const tags = [{ label: 'destaques', gold: true }, { label: 'online' }];
const courses: S.CoursesContent = {
  eyebrow: 'Foco na carreira',
  titleLead: 'O curso certo', titleAccent: 'para você.',
  intro: 'Descubra os segredos da beleza de profissionais renomados em nossos cursos online. Aprimore suas habilidades e transforme sua carreira.',
  items: [
    { image: { src: `${BASE}/curso-camadas-desconectadas.png`, alt: 'Camadas Desconectadas Internas' }, tags, person: 'Neandro Ferreira', title: 'Camadas Desconectadas Internas', plusLabel: 'Ver curso Camadas Desconectadas Internas', href: '/cursos/camadas-desconectadas-internas' },
    { image: { src: `${BASE}/curso-classic-bob.png`, alt: 'Corte Profissional – Classic Bob' }, tags, person: 'Miro Rodrigues', title: 'Corte Profissional – Classic Bob', plusLabel: 'Ver curso Corte Profissional Classic Bob', href: '/cursos/corte-profissional-classic-bob' },
    { image: { src: `${BASE}/curso-loiro-iluminada.png`, alt: 'Loiro Iluminada | Artista Wella' }, tags, person: 'Cleber Venâncio', title: 'Loiro Iluminada | Artista Wella', plusLabel: 'Ver curso Loiro Iluminada', href: '/cursos/loiro-iluminada-artista-wella' },
  ],
};

const benefits: S.BenefitsContent = {
  eyebrow: 'Benefícios',
  titleLead: 'Desbloqueie o todo potencial do seu', titleAccent: 'talento.',
  paragraphs: [
    'Os cursos da Academia Beauty são projetados para fornecer a você as habilidades e técnicas essenciais para transformar sua jornada profissional.',
    'Desde dominar as últimas tendências de estilo até entender a saúde e os cuidados com o cabelo, nossos especialistas o guiarão em cada etapa do caminho.',
  ],
  items: [
    { num: '01', title: 'Currículo Abrangente', text: 'Explore uma ampla gama de técnicas de estilo de cabelo, desde corte e coloração até estilos e tratamentos avançados.' },
    { num: '02', title: 'Aprendizado Interativo', text: 'Participe de sessões de perguntas e respostas ao vivo, demonstrações práticas e feedback personalizado de nossos instrutores especialistas.' },
    { num: '03', title: 'Networking Poderoso', text: 'Entre para uma rede de profissionais e marcas conectados, dividindo experiências e conhecimento em eventos, podcasts e mentorias.' },
  ],
};

const brands: S.BrandsContent = {
  eyebrow: 'Produtos da linha profissional',
  titleLead: 'As marcas que fazem seu', titleAccent: 'talento brilhar.',
  copy: 'Nenhum artista brilha sem suas tintas e pincéis. Por isso é que negociamos com grandes marcas para que você possa encontrar produtos de qualidade profissional com condições únicas e estoque exclusivo.',
  logos: [
    { src: `${BASE}/marca-loreal.png`, alt: 'L’Oréal' },
    { src: `${BASE}/marca-kerastase.png`, alt: 'Kérastase' },
    { src: `${BASE}/marca-schwarzkopf.png`, alt: 'Schwarzkopf Professional' },
  ],
};

const cta: S.CtaContent = {
  // "CARREIRA" é a palavra decorativa do CTA ("virar carreira"), não o nome da marca.
  outlineWord: 'CARREIRA',
  eyebrow: '05 / Seu próximo movimento',
  title: 'Faça seu talento virar carreira.',
  text: 'Escolha um curso, aprenda com quem vive o mercado e dê o próximo passo na sua evolução profissional.',
  cta: { label: 'Quero aprender', href: '#cursos-home' },
};

const footer: S.FooterContent = {
  brandLead: 'ACADEMIA', brandAccent: 'BEAUTY', socialLabel: 'Redes sociais',
  socials: [
    { icon: 'facebook', label: 'Facebook', href: '#' }, { icon: 'instagram', label: 'Instagram', href: '#' },
    { icon: 'youtube', label: 'YouTube', href: '#' }, { icon: 'tiktok', label: 'TikTok', href: '#' }, { icon: 'x', label: 'X', href: '#' },
  ],
  copyright: 'Todos os direitos reservados © {year} Academia Beauty',
};

/** Template "Home Original" v1: conteúdo e ordem da página aprovada (Home.html). */
export const homeOriginalTemplate: PageDocument = {
  schemaVersion: 1,
  template: { key: HOME_TEMPLATE_KEY, version: 1 },
  sections: [
    section('nav', 'home.nav', nav),
    section('hero', 'home.hero', hero),
    section('professionals', 'home.professionals', professionals),
    section('courses', 'home.courses', courses),
    section('benefits', 'home.benefits', benefits),
    section('brands', 'home.brands', brands),
    section('cta', 'home.cta', cta),
    section('footer', 'home.footer', footer),
  ],
};
