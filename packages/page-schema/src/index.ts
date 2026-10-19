import { z } from 'zod';

// Sem @types/node: só `process.env` é lido (e protegido por try/catch) para a lista de hosts de CDN.
declare const process: { env: Record<string, string | undefined> } | undefined;

/** Versão do envelope do documento. Mudanças incompatíveis exigem migração. */
export const DOCUMENT_SCHEMA_VERSION = 1;

/** Espaço, controle ou barra invertida: navegadores removem/normalizam e transformam `/\\host` em `//host`. */
const UNSAFE_CHARS = /[\u0000-\u0020\u007f-\u009f\\]/;

/** URL permitida no documento: https, caminho interno, âncora, mailto ou tel. Nunca `javascript:`, `data:` nem `//host`. */
export function isSafeUrl(v: string): boolean {
  return v.length <= 2048 && !UNSAFE_CHARS.test(v) && /^(https:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(v);
}
export const safeUrlSchema = z.string().max(2048).refine(isSafeUrl, 'URL não permitida');

/**
 * Hosts https permitidos para mídia externa (CDN). Vem de `MEDIA_CDN_HOST` (lista separada por vírgula)
 * na API e no servidor do site, ou de `NEXT_PUBLIC_MEDIA_CDN_HOST` no navegador. Vazio = só mídia do próprio site.
 * `setMediaHosts` existe para testes e para quem quiser fixar a lista por código.
 */
let mediaHostsOverride: readonly string[] | null = null;
export function setMediaHosts(hosts: readonly string[] | null): void {
  mediaHostsOverride = hosts && hosts.map((h) => h.trim().toLowerCase()).filter(Boolean);
}
export function allowedMediaHosts(): readonly string[] {
  if (mediaHostsOverride) return mediaHostsOverride;
  let raw = '';
  try {
    // Referências literais: o Next só substitui `process.env.NEXT_PUBLIC_*` escrito assim.
    raw = (typeof process !== 'undefined' && process.env.MEDIA_CDN_HOST) || (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MEDIA_CDN_HOST) || '';
  } catch {
    raw = '';
  }
  return raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}

/** Id de um arquivo da biblioteca de mídia (Fase 7): 32 hexadecimais. */
export const MEDIA_ID_PATTERN = /^[0-9a-f]{32}$/;
/** Caminho público de um arquivo da biblioteca. */
export const mediaLibraryPath = (id: string): string => `/media/${id}`;
/** Extrai o id de `/media/<id>` (com ou sem `?w=`), ou null. */
export function mediaIdOf(src: string): string | null {
  const m = /^\/media\/([0-9a-f]{32})(?:\?w=\d{2,4})?$/.exec(src);
  return m ? (m[1] as string) : null;
}

/**
 * Mídia (imagem, vídeo, logo): arquivo estático do site (`/site/...`), arquivo da biblioteca (`/media/<id>`)
 * ou `https://` de um host da lista de CDN configurada. Nunca `//host`, `data:` nem outros caminhos.
 */
export function isSafeMediaPath(v: string): boolean {
  if (v.length > 2048 || UNSAFE_CHARS.test(v)) return false;
  if (/^\/site\/[^?#]+$/.test(v)) return !v.includes('..');
  if (mediaIdOf(v)) return true;
  if (/^https:\/\//i.test(v)) {
    try {
      const url = new URL(v);
      return !url.username && !url.password && allowedMediaHosts().includes(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  }
  return false;
}
export const safeMediaSchema = z.string().max(2048).refine(isSafeMediaPath, 'Use um arquivo da biblioteca de mídia ou um caminho /site/...');

/** Texto simples: sem marcação. Rich text futuro terá estrutura própria, nunca HTML. */
export const plainTextSchema = (max: number) =>
  z.string().max(max).refine((v) => !/[<>]/.test(v), 'Marcação não é permitida');

/**
 * Tons de fundo permitidos por seção; ausente = o padrão do modelo da página. `surface`/`dark`/`glow` valem para seções de
 * texto claro (esquema escuro) e `white`/`paper`/`gold` para seções de texto escuro (esquema claro): quem decide é o catálogo.
 */
export const SECTION_BACKGROUNDS = ['surface', 'dark', 'glow', 'white', 'paper', 'gold'] as const;
export type SectionBackground = (typeof SECTION_BACKGROUNDS)[number];

export const sectionBaseSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  schemaVersion: z.number().int().positive(),
  variant: z.string().max(32).regex(/^[a-z0-9-]+$/).optional(),
  visibility: z.object({ enabled: z.boolean() }).default({ enabled: true }),
  content: z.record(z.string(), z.unknown()).default({}),
  /** Opções de estilo por seção (9B). Objeto estrito com valores de lista fechada: nunca vira canal de dados livres. */
  settings: z.object({ background: z.enum(SECTION_BACKGROUNDS).optional() }).strict().default({}),
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
