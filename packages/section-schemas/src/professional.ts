import { z } from 'zod';
import { plainTextSchema as text, safeMediaSchema, safeUrlSchema } from '@academia/page-schema';

const link = z.object({ label: text(60), href: safeUrlSchema });
const image = z.object({ src: safeMediaSchema, alt: text(300) });

export const navSchema = z.object({
  brandLead: text(30),
  brandAccent: text(30),
  links: z.array(link).max(6),
  account: link,
  /** Menu principal do site (topo); ausente = Cursos, Profissionais, Quem somos. `links` vira o menu lateral desta página. */
  siteLinks: z.array(link).max(5).optional(),
});

export const heroSchema = z.object({
  eyebrow: text(80),
  nameFirst: text(40),
  nameAccent: text(40),
  sub: text(200),
  meta: z.array(z.object({ label: text(30), value: text(60), gold: z.boolean().optional() })).max(3),
  portrait: image,
  hud: z.object({ label: text(40), accent: text(8), value: text(20) }),
});

export const bioSchema = z.object({
  tickerUnit: text(60),
  sectionIndex: text(40),
  titleLead: text(80),
  titleStrong: text(40),
  paragraphs: z.array(text(1200)).min(1).max(6),
  instagram: z.object({ handle: text(40), followers: text(40), href: safeUrlSchema }),
});

export const worksSchema = z.object({
  eyebrow: text(60),
  titleLead: text(80),
  titleAccent: text(60),
  copy: text(400),
  /** Colunas da galeria; ausente = 4 (todos os trabalhos em uma linha). */
  columns: z.enum(['4', '3']).optional(),
  /** Ausentes = ocultos: a galeria mostra só as fotos. */
  showPerson: z.boolean().optional(),
  showTitle: z.boolean().optional(),
  showPlus: z.boolean().optional(),
  items: z.array(z.object({
    image,
    tags: z.array(z.object({ label: text(30), gold: z.boolean().optional() })).max(3),
    person: text(60),
    title: text(120),
    plusLabel: text(120),
    href: safeUrlSchema,
  })).max(12),
});

export const videoSchema = z.object({
  sectionIndex: text(40),
  titleLead: text(40),
  titleAccent: text(60),
  text: text(300),
  video: z.object({ src: safeMediaSchema, type: z.enum(['video/mp4', 'video/webm']), ariaLabel: text(160), fallback: text(160) }),
});

export const coursesSchema = z.object({
  sectionIndex: text(40),
  title: text(60),
  text: text(300),
  /** Cursos por linha; ausente = 4. */
  columns: z.enum(['4', '3', '2']).optional(),
  /** Cursos publicados do profissional; sem cursos a seção não é renderizada. */
  cards: z.array(z.object({
    href: safeUrlSchema,
    image,
    titleLead: text(60),
    titleAccent: text(60),
    badge: text(20).optional(),
    /** Valor final e (no formato de/por) o preço de tabela; vêm do servidor, nunca do documento editado. */
    price: text(20).optional(),
    priceOld: text(20).optional(),
    person: text(60),
  })).max(12),
});

/** Faixa de números (anos, comunidade, trabalhos, cursos): prova de autoridade dos modelos Autoridade e Premium. */
export const statsSchema = z.object({
  sectionIndex: text(40),
  title: text(80),
  items: z.array(z.object({ value: text(24), label: text(48) })).min(1).max(4),
});

/** Chamada para ação (ver cursos ou seguir no Instagram) dos modelos de Conversão e Premium. */
export const ctaSchema = z.object({
  sectionIndex: text(40),
  title: text(80),
  text: text(240),
  cta: link,
});

export type NavContent = z.infer<typeof navSchema>;
export type HeroContent = z.infer<typeof heroSchema>;
export type BioContent = z.infer<typeof bioSchema>;
export type WorksContent = z.infer<typeof worksSchema>;
export type VideoContent = z.infer<typeof videoSchema>;
export type CoursesContent = z.infer<typeof coursesSchema>;
export type StatsContent = z.infer<typeof statsSchema>;
export type CtaContent = z.infer<typeof ctaSchema>;


export const SOCIAL_ICONS = ['facebook', 'instagram', 'youtube', 'tiktok', 'x'] as const;

/** Rodapé da página de Profissional. */
export const professionalFooterSchema = z.object({
  logoLead: text(30),
  logoAccent: text(30),
  socials: z.array(z.object({ icon: z.enum(SOCIAL_ICONS), label: text(30), href: safeUrlSchema })).max(8),
  copyright: text(120),
});
export type ProfessionalFooterContent = z.infer<typeof professionalFooterSchema>;
