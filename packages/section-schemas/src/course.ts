import { z } from 'zod';
import { plainTextSchema as text, safeMediaSchema, safeUrlSchema } from '@academia/page-schema';

export const ICON_NAMES = [
  'check', 'shield', 'lock', 'bolt', 'card', 'pix', 'barcode', 'star', 'arrow',
  'scissors', 'face', 'sun', 'gem', 'info', 'alert', 'chev', 'user',
] as const;
export const iconSchema = z.enum(ICON_NAMES);
export type IconName = z.infer<typeof iconSchema>;

const link = z.object({ label: text(60), href: safeUrlSchema });
const image = z.object({ src: safeMediaSchema, alt: text(300) });

export const headerSchema = z.object({
  brandLead: text(30),
  brandAccent: text(30),
  brandLabel: text(120),
  logoSrc: safeMediaSchema,
  navLabel: text(60),
  nav: z.array(link).min(1).max(8),
  ctaLabel: text(40),
});

export const heroSchema = z.object({
  eyebrow: text(80),
  titleLead: text(40),
  titleAccent: text(40),
  lead: text(400),
  byInitials: text(4),
  byPrefix: text(20),
  byName: text(60),
  bySuffix: text(120),
  ctaLabel: text(60),
  secondary: link,
  trust: z.array(z.object({ icon: iconSchema, label: text(60) })).max(5),
  image,
  frameKicker: text(40),
  frameTitle: text(60),
  frameBadge: text(40),
  huds: z.array(z.object({ kicker: text(30), accent: text(12).optional(), value: text(30) })).max(2),
  toneScale: z.object({
    ariaLabel: text(200),
    steps: z.array(text(3)).length(6),
    from: text(40),
    to: text(40),
  }).optional(),
});

export const factsSchema = z.object({
  ariaLabel: text(120),
  items: z.array(z.object({ label: text(30), value: text(80) })).min(1).max(4),
});

export const benefitsSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  /** Citação opcional (o template aprovado a traz; cursos criados no painel não). */
  quoteBefore: text(300).optional(),
  quoteEmphasis: text(120).optional(),
  quoteAfter: text(300).optional(),
  cards: z.array(z.object({ icon: iconSchema, title: text(60), text: text(200) })).min(1).max(4),
});

const accordionItem = z.object({ title: text(120), text: text(600), bullets: z.array(text(120)).max(6).optional() });

export const curriculumSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  lead: text(400),
  ctaLabel: text(40),
  modules: z.array(accordionItem).min(1).max(12),
});

export const deliverablesSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  items: z.array(z.object({ title: text(100), text: text(200) })).min(1).max(8),
  specsTitle: text(60),
  specs: z.array(z.object({ label: text(40), value: text(80) })).max(10),
});

export const instructorSchema = z.object({
  monogram: text(4),
  /** Retrato opcional: sem ele aparece só o monograma. */
  photo: image.optional(),
  handle: text(40),
  eyebrow: text(60),
  title: text(160),
  paragraphs: z.array(text(1200)).min(1).max(6),
  placesLabel: text(120),
  places: z.array(text(30)).max(12),
});

export const proofSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  stats: z.array(z.object({
    value: z.number().nonnegative(),
    prefix: text(4).optional(),
    suffix: text(12).optional(),
    label: text(60),
  })).max(4),
  testimonials: z.array(z.object({ quote: text(300), name: text(60), role: text(60) })).max(6),
  /** Aviso de depoimentos de exemplo: remover quando houver depoimentos reais. */
  sampleNote: text(120).optional(),
});

export const offerSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  lead: text(300),
  cardTitle: text(80),
  perks: z.array(text(100)).max(6),
  ctaLabel: text(40),
});

export const faqSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  lead: text(300),
  items: z.array(z.object({ title: text(160), text: text(800) })).min(1).max(20),
});

export const checkoutSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  productName: text(80),
  productCaption: text(80),
  productImage: z.object({ src: safeMediaSchema }),
  notice: text(300),
  seals: z.array(z.object({ icon: iconSchema, label: text(40) })).length(3),
});

export const guaranteeSchema = z.object({
  sealValue: text(4),
  sealUnit: text(12),
  ringText: text(80),
  eyebrow: text(60),
  title: text(100),
  lead: text(400),
  items: z.array(z.object({ icon: iconSchema, label: text(80) })).max(6),
});

export const finalCtaSchema = z.object({
  eyebrow: text(60),
  titleLead: text(120),
  titleAccent: text(60),
  leadBefore: text(120),
  leadAfter: text(120),
  ctaLabel: text(40),
});

export const footerSchema = z.object({
  brandLead: text(30),
  brandAccent: text(30),
  logoSrc: safeMediaSchema,
  copyright: text(120),
  socialLabel: text(60),
  links: z.array(z.object({ label: text(30), href: safeUrlSchema, external: z.boolean().optional() })).max(8),
});

export const stickyCtaSchema = z.object({ ctaLabel: text(40) });

export type HeaderContent = z.infer<typeof headerSchema>;
export type HeroContent = z.infer<typeof heroSchema>;
export type FactsContent = z.infer<typeof factsSchema>;
export type BenefitsContent = z.infer<typeof benefitsSchema>;
export type CurriculumContent = z.infer<typeof curriculumSchema>;
export type DeliverablesContent = z.infer<typeof deliverablesSchema>;
export type InstructorContent = z.infer<typeof instructorSchema>;
export type ProofContent = z.infer<typeof proofSchema>;
export type OfferContent = z.infer<typeof offerSchema>;
export type FaqContent = z.infer<typeof faqSchema>;
export type CheckoutContent = z.infer<typeof checkoutSchema>;
export type GuaranteeContent = z.infer<typeof guaranteeSchema>;
export type FinalCtaContent = z.infer<typeof finalCtaSchema>;
export type FooterContent = z.infer<typeof footerSchema>;
export type StickyCtaContent = z.infer<typeof stickyCtaSchema>;
