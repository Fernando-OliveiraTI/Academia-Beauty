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

export const metaFor = (type: string) => SECTION_META.find((s) => s.type === type);
export const sectionsOfTemplate = (templateKey: string) => {
  const prefix = TEMPLATE_PREFIX[templateKey];
  return prefix ? SECTION_META.filter((s) => s.type.startsWith(prefix)) : [];
};
