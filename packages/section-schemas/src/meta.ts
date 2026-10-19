import type { SectionBackground } from '@academia/page-schema';
import type { ZodType } from 'zod';
import * as course from './course.js';
import * as home from './home.js';
import * as pro from './professional.js';

/** Região do template em que a seção é renderizada (landmarks). */
export type Placement = 'banner' | 'main' | 'contentinfo' | 'overlay';

export type SectionMeta = {
  type: string;
  label: string;
  placement: Placement;
  schema: ZodType;
  /** Sem esta seção a página perde o sentido: o editor não deixa remover. */
  required?: boolean;
};

const m = (type: string, label: string, placement: Placement, schema: ZodType, required = false): SectionMeta => ({ type, label, placement, schema, required });

/**
 * Catálogo das seções conhecidas. Fonte única de tipo → schema/região/rótulo, usada pelo servidor
 * (validação autoritativa) e pelo editor. O renderer tem a lista de componentes e um teste garante
 * que as duas listas cobrem exatamente os mesmos tipos.
 */
export const SECTION_META: readonly SectionMeta[] = [
  m('course.header', 'Cabeçalho', 'banner', course.headerSchema),
  m('course.hero', 'Topo (hero)', 'main', course.heroSchema, true),
  m('course.facts', 'Fatos do curso', 'main', course.factsSchema),
  m('course.benefits', 'Benefícios', 'main', course.benefitsSchema),
  m('course.curriculum', 'Conteúdo programático', 'main', course.curriculumSchema),
  m('course.deliverables', 'O que você recebe', 'main', course.deliverablesSchema),
  m('course.instructor', 'Instrutor', 'main', course.instructorSchema),
  m('course.proof', 'Depoimentos', 'main', course.proofSchema),
  m('course.offer', 'Oferta', 'main', course.offerSchema, true),
  m('course.faq', 'Perguntas frequentes', 'main', course.faqSchema),
  m('course.checkout', 'Checkout', 'main', course.checkoutSchema),
  m('course.guarantee', 'Garantia', 'main', course.guaranteeSchema),
  m('course.final-cta', 'Chamada final', 'main', course.finalCtaSchema),
  m('course.footer', 'Rodapé', 'contentinfo', course.footerSchema),
  m('course.sticky-cta', 'Barra de compra fixa', 'overlay', course.stickyCtaSchema),
  m('professional.nav', 'Navegação', 'banner', pro.navSchema),
  m('professional.hero', 'Topo (hero)', 'main', pro.heroSchema, true),
  m('professional.bio', 'Trajetória', 'main', pro.bioSchema),
  m('professional.works', 'Trabalhos em destaque', 'main', pro.worksSchema),
  m('professional.video', 'Vídeo', 'main', pro.videoSchema),
  m('professional.stats', 'Números', 'main', pro.statsSchema),
  m('professional.cta', 'Chamada', 'main', pro.ctaSchema),
  m('professional.courses', 'Cursos', 'main', pro.coursesSchema),
  m('professional.footer', 'Rodapé', 'contentinfo', pro.professionalFooterSchema),
  m('home.nav', 'Navegação', 'banner', home.navSchema),
  m('home.hero', 'Topo (hero)', 'main', home.heroSchema, true),
  m('home.professionals', 'Profissionais', 'main', home.professionalsSchema),
  m('home.courses', 'Cursos', 'main', home.coursesSchema),
  m('home.benefits', 'Benefícios', 'main', home.benefitsSchema),
  m('home.brands', 'Marcas', 'main', home.brandsSchema),
  m('home.cta', 'Chamada final', 'main', home.ctaSchema),
  m('home.footer', 'Rodapé', 'contentinfo', home.footerSchema),
];

/**
 * Modelos de página do Profissional (Fase 7C). Todos usam as seções `professional.*`; mudam a composição
 * (quais seções e em que ordem), os textos padrão e o tema visual. O Original é a página aprovada.
 */
export const PROFESSIONAL_TEMPLATES = [
  { key: 'professional-original', label: 'Original', description: 'A página aprovada: apresentação, trajetória, trabalhos, vídeo e cursos.' },
  { key: 'professional-authority', label: 'Autoridade', description: 'Abre com números e trajetória para construir credibilidade antes dos trabalhos e cursos.' },
  { key: 'professional-video', label: 'Vídeo', description: 'O vídeo de apresentação vem logo após o topo, em tela grande. Sem vídeo, segue como o Original.' },
  { key: 'professional-conversion', label: 'Conversão', description: 'Cursos e chamada para ação em primeiro plano, para quem quer vender com a página.' },
  { key: 'professional-immersive', label: 'Imersivo', description: 'Trabalhos em galeria grande e escura, com pouco texto: a imagem conduz a página.' },
  { key: 'professional-premium', label: 'Premium', description: 'Visual sóbrio e refinado, com números e chamada discreta, em preto e dourado.' },
] as const;
export type ProfessionalTemplateKey = (typeof PROFESSIONAL_TEMPLATES)[number]['key'];
export const PROFESSIONAL_TEMPLATE_KEYS = PROFESSIONAL_TEMPLATES.map((t) => t.key) as readonly string[];
export const isProfessionalTemplate = (key: string): key is ProfessionalTemplateKey => PROFESSIONAL_TEMPLATE_KEYS.includes(key);

/** Prefixo dos tipos de seção aceitos por cada template. */
export const TEMPLATE_PREFIX: Readonly<Record<string, string>> = {
  'course-original': 'course.',
  'home-original': 'home.',
  ...Object.fromEntries(PROFESSIONAL_TEMPLATES.map((t) => [t.key, 'professional.'])),
};

/** Máximo de instâncias de um tipo repetível por página, e de seções por documento (9C, D-031). */
export const MAX_PER_REPEATABLE_TYPE = 4;
export const MAX_SECTIONS_PER_DOCUMENT = 30;

/**
 * Tipos que podem ser adicionados/duplicados: texto e destaque, vídeo e galeria, chamadas para ação, FAQ e depoimentos.
 * Só entram aqui seções cujos ids/âncoras de DOM o renderer sabe sufixar (`idSuffix`) e cujo CSS não depende de `#id`.
 */
export const REPEATABLE_TYPES: ReadonlySet<string> = new Set([
  'course.benefits', 'course.faq', 'course.proof', 'course.final-cta',
  'professional.bio', 'professional.works', 'professional.video', 'professional.cta',
  'home.cta',
]);
export const isRepeatable = (type: string) => REPEATABLE_TYPES.has(type);

/** Seções com visual próprio complexo (efeitos, preço, checkout) não aceitam troca de fundo. */
const NO_BACKGROUND: ReadonlySet<string> = new Set(['course.hero', 'course.offer', 'course.checkout', 'professional.hero', 'home.hero']);

/** Esquema de cores do texto da seção: `dark` = texto claro sobre fundo escuro; `light` = texto escuro sobre fundo claro. */
export type BackgroundScheme = 'dark' | 'light';

/** Seções do Profissional que, por modelo, trocam o esquema de cores (medido nas páginas renderizadas). */
const PROFESSIONAL_DARK_WORKS: ReadonlySet<string> = new Set(['professional-immersive', 'professional-premium']);
const PROFESSIONAL_SCHEME: Readonly<Record<string, BackgroundScheme>> = {
  'professional.bio': 'light', 'professional.courses': 'light', 'professional.works': 'light',
  'professional.video': 'dark', 'professional.stats': 'dark', 'professional.cta': 'dark',
};

/**
 * Esquema da seção no modelo, ou `null` se ela não aceita troca de fundo. A cor do texto é ligada ao fundo original
 * de cada seção; por isso cada esquema só aceita tons do mesmo tipo (sem texto escuro sobre fundo escuro).
 * A Home alterna seções claras e escuras com cores fixas por seção e fica de fora.
 */
export function backgroundSchemeOf(templateKey: string, type: string): BackgroundScheme | null {
  if (NO_BACKGROUND.has(type) || metaFor(type)?.placement !== 'main') return null;
  if (type.startsWith('course.')) return templateKey === 'course-original' ? 'dark' : null;
  if (type.startsWith('professional.')) {
    if (type === 'professional.works' && PROFESSIONAL_DARK_WORKS.has(templateKey)) return 'dark';
    return PROFESSIONAL_SCHEME[type] ?? null;
  }
  return null;
}

export const BACKGROUNDS_BY_SCHEME: Readonly<Record<BackgroundScheme, readonly SectionBackground[]>> = {
  dark: ['surface', 'dark', 'glow'],
  light: ['white', 'paper', 'gold'],
};

/** Tons de fundo aceitos pela seção no modelo (vazio = não aceita). */
export const backgroundsFor = (templateKey: string, type: string): readonly SectionBackground[] => {
  const scheme = backgroundSchemeOf(templateKey, type);
  return scheme ? BACKGROUNDS_BY_SCHEME[scheme] : [];
};

export const metaFor = (type: string) => SECTION_META.find((s) => s.type === type);
export const sectionsOfTemplate = (templateKey: string) => {
  const prefix = TEMPLATE_PREFIX[templateKey];
  return prefix ? SECTION_META.filter((s) => s.type.startsWith(prefix)) : [];
};
