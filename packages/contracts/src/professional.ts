import { z } from 'zod';
import { isSafeMediaPath } from '@academia/page-schema';

/** Texto simples: sem marcação (mesma regra do documento de página). */
const plain = (max: number) =>
  z.string().trim().max(max).refine((v) => !/[<>]/.test(v), 'Marcação não é permitida');

/** Mídia/links: https ou caminho interno do site. Nunca `javascript:`, `data:` ou `//host`. */
const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v.length <= 2048 && !/[\u0000-\u0020\u007f-\u009f\\]/.test(v) && /^(https:\/\/|\/(?!\/))/i.test(v), 'Use https:// ou um caminho interno iniciado por /');

const optionalUrl = z.union([z.literal(''), safeUrl]);

/** Mídia: arquivo do site, da biblioteca (`/media/<id>`) ou https de host de CDN autorizado (ver `isSafeMediaPath`). */
const mediaPath = z.string().trim().max(2048).refine(isSafeMediaPath, 'Use um arquivo da biblioteca de mídia ou um caminho /site/...');
const optionalMedia = z.union([z.literal(''), mediaPath]);

/**
 * Modelos de página do Profissional (Fase 7C). A lista com rótulos e descrições vive em `@academia/section-schemas`
 * (`PROFESSIONAL_TEMPLATES`); um teste no renderer garante que as duas listas são iguais.
 */
export const PROFESSIONAL_TEMPLATE_KEYS = [
  'professional-original',
  'professional-authority',
  'professional-video',
  'professional-conversion',
  'professional-immersive',
  'professional-premium',
] as const;
export const professionalTemplateKeySchema = z.enum(PROFESSIONAL_TEMPLATE_KEYS);
export type ProfessionalTemplateKey = z.infer<typeof professionalTemplateKeySchema>;

export const PROFESSIONAL_STATUSES = ['draft', 'published', 'archived'] as const;
export type ProfessionalStatus = (typeof PROFESSIONAL_STATUSES)[number];

/** Slugs que colidiriam com rotas do site. */
export const RESERVED_SLUGS = ['novo', 'admin', 'api', 'preview', 'cursos', 'profissionais'] as const;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens')
  .refine((v) => !(RESERVED_SLUGS as readonly string[]).includes(v), 'Slug reservado');

/** Gera um slug a partir do nome (remove acentos). Sugestão; o usuário pode editar. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const workSchema = z.object({
  imageSrc: mediaPath,
  alt: plain(300).min(1),
  title: plain(120).min(1),
  tags: z.array(plain(30).min(1)).max(2).default([]),
});

/** Dados editáveis do profissional (rascunho de trabalho e snapshot publicado). */
export const professionalDataSchema = z.object({
  name: plain(80).min(2, 'Informe o nome'),
  specialty: plain(40).min(1, 'Informe a especialidade'),
  tagline: plain(200).default(''),
  experienceYears: z.number().int().min(0).max(80).nullable().default(null),
  instagramHandle: plain(40).default(''),
  instagramFollowers: plain(40).default(''),
  instagramUrl: optionalUrl.default(''),
  portraitSrc: optionalMedia.default(''),
  /** Foto do cartão da vitrine na Home. */
  cardPhotoSrc: optionalMedia.default(''),
  bio: z.array(plain(1200).min(1)).max(6).default([]),
  works: z.array(workSchema).max(12).default([]),
  videoSrc: optionalMedia.default(''),
  metaDescription: plain(200).default(''),
});
export type ProfessionalData = z.infer<typeof professionalDataSchema>;
export type ProfessionalDataInput = z.input<typeof professionalDataSchema>;

export const createProfessionalSchema = z.object({
  slug: slugSchema,
  data: professionalDataSchema,
  /** Modelo da página; padrão: Original. */
  templateKey: professionalTemplateKeySchema.default('professional-original'),
});
export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;

/** `revision` é a revisão que o cliente leu; diferente da atual → 409 (edição concorrente). */
export const updateProfessionalSchema = z.object({
  slug: slugSchema.optional(),
  data: professionalDataSchema,
  revision: z.number().int().positive(),
  /** Trocar o modelo só é possível enquanto a página não foi personalizada no editor. */
  templateKey: professionalTemplateKeySchema.optional(),
});
export type UpdateProfessionalInput = z.infer<typeof updateProfessionalSchema>;

export const showcaseSchema = z.object({
  homeVisible: z.boolean(),
  homeOrder: z.number().int().min(0).max(9999),
  featured: z.boolean(),
});
export type ShowcaseInput = z.infer<typeof showcaseSchema>;

export const listProfessionalsQuerySchema = z.object({
  status: z.enum(PROFESSIONAL_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListProfessionalsQuery = z.infer<typeof listProfessionalsQuerySchema>;

export type ReadinessIssue = { field: string; message: string };

/**
 * Pendências que impedem publicar (a página precisa ficar completa). O rascunho pode ser salvo
 * incompleto; esta checagem roda no assistente e, de novo, no servidor ao publicar.
 */
export function publishReadiness(data: ProfessionalData): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  if (!data.tagline) issues.push({ field: 'tagline', message: 'Informe a frase de apresentação' });
  if (data.experienceYears === null) issues.push({ field: 'experienceYears', message: 'Informe os anos de experiência' });
  if (!data.portraitSrc) issues.push({ field: 'portraitSrc', message: 'Informe o retrato' });
  if (!data.cardPhotoSrc) issues.push({ field: 'cardPhotoSrc', message: 'Informe a foto do cartão da Home' });
  if (data.bio.length === 0) issues.push({ field: 'bio', message: 'Escreva ao menos um parágrafo de trajetória' });
  if (!data.instagramHandle || !data.instagramUrl) {
    issues.push({ field: 'instagramUrl', message: 'Informe o Instagram (usuário e link)' });
  }
  return issues;
}

/** Item da vitrine pública da Home. */
export const showcaseItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  cardPhotoSrc: z.string(),
});
export type ShowcaseItem = z.infer<typeof showcaseItemSchema>;

/** Cartão de curso publicado exibido na página do profissional (montado pelo servidor). */
export const courseCardSchema = z.object({
  slug: z.string(),
  title: z.string(),
  coverSrc: z.string(),
  coverAlt: z.string(),
  discountPct: z.number().int().min(0).max(100),
});
export type CourseCard = z.infer<typeof courseCardSchema>;

/** Resposta pública de um profissional publicado. */
export const publicProfessionalSchema = z.object({
  slug: z.string(),
  version: z.number().int().positive(),
  publishedAt: z.string(),
  templateKey: z.string(),
  templateVersion: z.number().int().positive(),
  data: professionalDataSchema,
  /** Cursos publicados e marcados para a vitrine do profissional, na ordem definida. */
  courses: z.array(courseCardSchema).default([]),
  /** Documento editado no editor visual (D-020); null = página derivada do cadastro. Validado pelo renderer. */
  document: z.unknown().nullable().default(null),
});
export type PublicProfessional = z.infer<typeof publicProfessionalSchema>;

/** Resposta administrativa. */
export const adminProfessionalSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  status: z.enum(PROFESSIONAL_STATUSES),
  revision: z.number().int().positive(),
  data: professionalDataSchema,
  templateKey: z.string(),
  homeVisible: z.boolean(),
  homeOrder: z.number().int(),
  featured: z.boolean(),
  publishedVersion: z.number().int().nullable(),
  publishedAt: z.string().nullable(),
  /** O rascunho difere do publicado. */
  hasUnpublishedChanges: z.boolean(),
  /** 0 = página nunca personalizada no editor. */
  documentRevision: z.number().int().min(0),
  updatedAt: z.string(),
});
export type AdminProfessional = z.infer<typeof adminProfessionalSchema>;
