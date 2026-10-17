import { z } from 'zod';
import { COURSE_MODALITIES } from './course.js';

/** Cartão de curso da Home (montado pelo servidor a partir dos snapshots publicados). */
export const homeCourseCardSchema = z.object({
  slug: z.string(),
  title: z.string(),
  /** Nome do profissional dono do curso. */
  person: z.string(),
  coverSrc: z.string(),
  coverAlt: z.string(),
  featured: z.boolean(),
  modality: z.enum(COURSE_MODALITIES),
});
export type HomeCourseCard = z.infer<typeof homeCourseCardSchema>;

/**
 * Resposta pública da Home: o documento publicado (nulo = nunca personalizada: vale o template original)
 * mais as partes dinâmicas do catálogo, que o site reinjeta sempre (vitrine de profissionais e de cursos).
 */
export const publicHomeSchema = z.object({
  version: z.number().int().positive().nullable(),
  document: z.unknown().nullable(),
  professionals: z.array(z.object({ slug: z.string(), name: z.string(), cardPhotoSrc: z.string() })),
  courses: z.array(homeCourseCardSchema),
});
export type PublicHome = z.infer<typeof publicHomeSchema>;

/** Estado do rascunho da Home no painel (a Home não tem cadastro: só o documento). */
export const adminHomeSchema = z.object({
  status: z.enum(['draft', 'published']),
  publishedVersion: z.number().int().positive().nullable(),
  publishedDocumentRevision: z.number().int().min(0).nullable(),
  documentRevision: z.number().int().min(0),
  hasUnpublishedChanges: z.boolean(),
});
export type AdminHome = z.infer<typeof adminHomeSchema>;
