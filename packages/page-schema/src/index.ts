import { z } from 'zod';

/** Versão do envelope do documento. Mudanças incompatíveis exigem migração. */
export const DOCUMENT_SCHEMA_VERSION = 1;

/** Espaço, controle ou barra invertida: navegadores removem/normalizam e transformam `/\\host` em `//host`. */
const UNSAFE_CHARS = /[\u0000-\u0020\u007f-\u009f\\]/;

/** URL permitida no documento: https, caminho interno, âncora, mailto ou tel. Nunca `javascript:`, `data:` nem `//host`. */
export function isSafeUrl(v: string): boolean {
  return v.length <= 2048 && !UNSAFE_CHARS.test(v) && /^(https:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(v);
}
export const safeUrlSchema = z.string().max(2048).refine(isSafeUrl, 'URL não permitida');

/** Mídia (imagem, vídeo, logo): só caminho interno do site (`/site/...`) até haver upload/CDN (Fase 7). */
export function isSafeMediaPath(v: string): boolean {
  return v.length <= 2048 && !UNSAFE_CHARS.test(v) && /^\/(?![\/])/.test(v);
}
export const safeMediaSchema = z.string().max(2048).refine(isSafeMediaPath, 'Use um caminho interno do site (/site/...)');

/** Texto simples: sem marcação. Rich text futuro terá estrutura própria, nunca HTML. */
export const plainTextSchema = (max: number) =>
  z.string().max(max).refine((v) => !/[<>]/.test(v), 'Marcação não é permitida');

export const sectionBaseSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  schemaVersion: z.number().int().positive(),
  variant: z.string().max(32).regex(/^[a-z0-9-]+$/).optional(),
  visibility: z.object({ enabled: z.boolean() }).default({ enabled: true }),
  content: z.record(z.string(), z.unknown()).default({}),
  /** Reservado: nenhuma opção por seção existe ainda. Objeto vazio estrito, para não virar canal de dados livres. */
  settings: z.object({}).strict().default({}),
});
export type SectionBase = z.infer<typeof sectionBaseSchema>;

/** Teto do documento serializado e da profundidade do JSON (evita abuso e erro do MySQL em JSON muito fundo). */
export const MAX_DOCUMENT_BYTES = 512 * 1024;
export const MAX_DOCUMENT_DEPTH = 12;

export function jsonDepth(value: unknown, depth = 0): number {
  if (value === null || typeof value !== 'object') return depth;
  let max = depth + 1;
  for (const child of Object.values(value as Record<string, unknown>)) max = Math.max(max, jsonDepth(child, depth + 1));
  return max;
}

export type SectionDefinition = {
  type: string;
  schemaVersion: number;
  /** Valida o `content` da seção. */
  content: z.ZodType;
  /** Migra conteúdo de versões antigas, indexado pela versão de origem. */
  migrations?: Record<number, (content: unknown) => unknown>;
};

const registry = new Map<string, SectionDefinition>();

export function registerSection(def: SectionDefinition): void {
  if (registry.has(def.type)) throw new Error(`Seção já registrada: ${def.type}`);
  registry.set(def.type, def);
}

export function hasSection(type: string): boolean {
  return registry.has(type);
}

export function clearRegistryForTests(): void {
  registry.clear();
}

export const pageDocumentSchema = z.object({
  schemaVersion: z.literal(DOCUMENT_SCHEMA_VERSION),
  template: z.object({ key: z.string().min(1).max(64), version: z.number().int().positive() }),
  sections: z.array(sectionBaseSchema).max(200),
});
export type PageDocument = z.infer<typeof pageDocumentSchema>;

export type ParseResult = { ok: true; document: PageDocument } | { ok: false; errors: string[] };

/**
 * Valida o documento inteiro: envelope, ids únicos, tipos registrados e conteúdo de cada seção.
 * Seções desconhecidas são rejeitadas: nada fora do registry é renderizado.
 */
export function parsePageDocument(input: unknown): ParseResult {
  if (jsonDepth(input) > MAX_DOCUMENT_DEPTH) return { ok: false, errors: ['documento: estrutura muito profunda'] };
  try {
    if (JSON.stringify(input)?.length > MAX_DOCUMENT_BYTES) return { ok: false, errors: ['documento: tamanho acima do limite'] };
  } catch {
    return { ok: false, errors: ['documento: não serializável'] };
  }
  const env = pageDocumentSchema.safeParse(input);
  if (!env.success) return { ok: false, errors: env.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };

  const errors: string[] = [];
  const seen = new Set<string>();
  const sections = env.data.sections.map((section, index) => {
    if (seen.has(section.id)) errors.push(`sections.${index}.id: duplicado (${section.id})`);
    seen.add(section.id);

    const def = registry.get(section.type);
    if (!def) {
      errors.push(`sections.${index}.type: seção desconhecida (${section.type})`);
      return section;
    }
    let content: unknown = section.content;
    let version = section.schemaVersion;
    if (version > def.schemaVersion) {
      errors.push(`sections.${index}.schemaVersion: ${version} é mais novo que o suportado (${def.schemaVersion})`);
      return section;
    }
    while (version < def.schemaVersion) {
      const migrate = def.migrations?.[version];
      if (!migrate) {
        errors.push(`sections.${index}.schemaVersion: sem migração de ${version}`);
        return section;
      }
      content = migrate(content);
      version += 1;
    }
    const parsed = def.content.safeParse(content);
    if (!parsed.success) {
      for (const i of parsed.error.issues) errors.push(`sections.${index}.content.${i.path.join('.')}: ${i.message}`);
      return section;
    }
    return { ...section, schemaVersion: version, content: parsed.data as Record<string, unknown> };
  });

  if (errors.length) return { ok: false, errors };
  return { ok: true, document: { ...env.data, sections } };
}
