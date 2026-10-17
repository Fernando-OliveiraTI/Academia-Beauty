import { z } from 'zod';

/** Entradas dos endpoints de documento de página (editor visual, D-020). O documento é validado no servidor pelo registry de seções. */
export const saveDocumentSchema = z.object({
  document: z.unknown(),
  /** Revisão do documento que o editor carregou (0 = primeira personalização). */
  revision: z.number().int().min(0),
});
export type SaveDocumentInput = z.infer<typeof saveDocumentSchema>;

export const documentRevisionSchema = z.object({
  revision: z.number().int().min(0),
  /** Restaurar versão também sobrescreve o cadastro: se informada, precisa ser a revisão atual do cadastro. */
  dataRevision: z.number().int().positive().optional(),
});
export type DocumentRevisionInput = z.infer<typeof documentRevisionSchema>;

export const documentStateSchema = z.object({
  document: z.unknown().nullable(),
  documentRevision: z.number().int().min(0),
  templateKey: z.string(),
  status: z.string(),
  /** Revisão do cadastro: o editor avisa quando o cadastro mudou depois da personalização. */
  revision: z.number().int().positive(),
});
export type DocumentState = z.infer<typeof documentStateSchema>;

export const documentVersionSchema = z.object({
  version: z.number().int().positive(),
  createdAt: z.string(),
  publishedBy: z.number().int().nullable(),
  hasDocument: z.boolean(),
  current: z.boolean(),
});
export type DocumentVersion = z.infer<typeof documentVersionSchema>;
