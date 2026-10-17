import { hasSection, parsePageDocument, registerSection, type PageDocument } from '@academia/page-schema';
import { SECTION_META, TEMPLATE_PREFIX, sectionsOfTemplate } from './meta.js';

export * from './meta.js';
export { SOCIAL_ICONS } from './professional.js';

/** Versão do schema de conteúdo de todas as seções dos templates. */
export const SCHEMA_VERSION = 1;

/** Registra os schemas no registry do page-schema (idempotente). */
export function registerSections(): void {
  for (const s of SECTION_META) {
    if (!hasSection(s.type)) registerSection({ type: s.type, schemaVersion: SCHEMA_VERSION, content: s.schema });
  }
}

export type ValidationResult = { ok: true; document: PageDocument } | { ok: false; errors: string[] };

/**
 * Validação autoritativa de um documento de página: envelope, ids únicos, tipos e conteúdo de cada
 * seção (registry), template conhecido e seções pertencentes ao template. Usada pela API e pelo editor.
 */
export function validatePageDocument(input: unknown): ValidationResult {
  registerSections();
  const parsed = parsePageDocument(input);
  if (!parsed.ok) return parsed;
  const doc = parsed.document;
  const prefix = TEMPLATE_PREFIX[doc.template.key];
  if (!prefix) return { ok: false, errors: [`template: ${doc.template.key} desconhecido`] };
  const errors: string[] = [];
  const seen = new Set<string>();
  doc.sections.forEach((s, i) => {
    if (!s.type.startsWith(prefix)) errors.push(`sections.${i}.type: ${s.type} não pertence ao template ${doc.template.key}`);
    // Seções têm âncoras/ids fixos no DOM: cada tipo existe no máximo uma vez (D-021).
    else if (seen.has(s.type)) errors.push(`sections.${i}.type: ${s.type} repetida`);
    seen.add(s.type);
  });
  for (const meta of sectionsOfTemplate(doc.template.key)) {
    if (meta.required && !seen.has(meta.type)) errors.push(`sections: a seção obrigatória "${meta.label}" (${meta.type}) não pode ser removida`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, document: doc };
}

/** Regras de edição do template (consumidas pelo `editor-core`): tudo é único porque os componentes têm âncoras/ids fixos. */
export function editorRules(templateKey: string) {
  const metas = sectionsOfTemplate(templateKey);
  const byType = new Map(metas.map((m) => [m.type, m]));
  return {
    placementOf: (type: string) => byType.get(type)?.placement,
    singleton: new Set(metas.map((m) => m.type)) as ReadonlySet<string>,
    required: new Set(metas.filter((m) => m.required).map((m) => m.type)) as ReadonlySet<string>,
    maxSections: metas.length,
  };
}
