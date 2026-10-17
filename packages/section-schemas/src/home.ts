import { z } from 'zod';
import { plainTextSchema as text, safeMediaSchema, safeUrlSchema } from '@academia/page-schema';

const link = z.object({ label: text(60), href: safeUrlSchema });
const image = z.object({ src: safeMediaSchema, alt: text(300) });

export const navSchema = z.object({
  ariaLabel: text(60),
  brandLead: text(30),
  brandAccent: text(30),
  brandHref: safeUrlSchema,
  links: z.array(link).max(6),
  account: link,
});

export const heroSchema = z.object({
  kicker: text(80),
  titleLead: text(60),
  titleOutline: text(60),
  /** Parágrafos da cópia; `highlight` marca o trecho em dourado. */
  copy: z.array(z.object({ text: text(240), highlight: z.boolean().optional() })).max(4),
  cta: link,
  miniProof: text(80),
  image,
});

export const professionalsSchema = z.object({
  marquee: text(120),
  titleLead: text(40),
  titleInner: text(30),
  titleTail: text(30),
  prevLabel: text(40),
  nextLabel: text(40),
  cardLabel: text(30),
  /** Profissionais publicados e visíveis na Home, na ordem de exibição. */
  items: z.array(z.object({ name: text(60), photo: safeMediaSchema, href: safeUrlSchema })).max(24),
});

export const coursesSchema = z.object({
  eyebrow: text(60),
  titleLead: text(60),
  titleAccent: text(60),
  intro: text(300),
  items: z.array(z.object({
    image,
    tags: z.array(z.object({ label: text(30), gold: z.boolean().optional() })).max(3),
    person: text(60),
    title: text(120),
    plusLabel: text(120),
    href: safeUrlSchema,
  })).max(12),
});

export const benefitsSchema = z.object({
  eyebrow: text(60),
  titleLead: text(80),
  titleAccent: text(40),
  paragraphs: z.array(text(400)).min(1).max(3),
  items: z.array(z.object({ num: text(4), title: text(60), text: text(300) })).max(6),
});

export const brandsSchema = z.object({
  eyebrow: text(60),
  titleLead: text(60),
  titleAccent: text(40),
  copy: text(400),
  logos: z.array(image).max(12),
});

export const ctaSchema = z.object({
  outlineWord: text(30),
  eyebrow: text(60),
  title: text(80),
  text: text(240),
  cta: link,
});

export const footerSchema = z.object({
  brandLead: text(30),
  brandAccent: text(30),
  socialLabel: text(40),
  socials: z.array(z.object({ icon: z.enum(['facebook', 'instagram', 'youtube', 'tiktok', 'x']), label: text(30), href: safeUrlSchema })).max(8),
  copyright: text(120),
});

export type NavContent = z.infer<typeof navSchema>;
export type HeroContent = z.infer<typeof heroSchema>;
export type ProfessionalsContent = z.infer<typeof professionalsSchema>;
export type CoursesContent = z.infer<typeof coursesSchema>;
export type BenefitsContent = z.infer<typeof benefitsSchema>;
export type BrandsContent = z.infer<typeof brandsSchema>;
export type CtaContent = z.infer<typeof ctaSchema>;
export type FooterContent = z.infer<typeof footerSchema>;
