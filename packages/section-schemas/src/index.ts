import { hasSection, parsePageDocument, registerSection, type PageDocument } from '@academia/page-schema';
import { MAX_PER_REPEATABLE_TYPE, MAX_SECTIONS_PER_DOCUMENT, SECTION_META, TEMPLATE_PREFIX, backgroundsFor, isRepeatable, sectionsOfTemplate } from './meta.js';

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
  const counts = new Map<string, number>();
  if (doc.sections.length > MAX_SECTIONS_PER_DOCUMENT) errors.push(`sections: no máximo ${MAX_SECTIONS_PER_DOCUMENT} seções por página`);
  doc.sections.forEach((s, i) => {
    if (!s.type.startsWith(prefix)) errors.push(`sections.${i}.type: ${s.type} não pertence ao template ${doc.template.key}`);
    const count = (counts.get(s.type) ?? 0) + 1;
    counts.set(s.type, count);
    // Tipos únicos têm âncoras/ids fixos no DOM (D-021); só os repetíveis (D-031) podem aparecer mais de uma vez, até o limite.
    if (count > 1 && !isRepeatable(s.type)) errors.push(`sections.${i}.type: ${s.type} repetida`);
    else if (count > MAX_PER_REPEATABLE_TYPE) errors.push(`sections.${i}.type: ${s.type} acima do limite de ${MAX_PER_REPEATABLE_TYPE} por página`);
    const tone = s.settings.background;
    if (tone) {
      const allowed = backgroundsFor(doc.template.key, s.type);
      if (allowed.length === 0) errors.push(`sections.${i}.settings.background: ${s.type} não aceita fundo`);
      else if (!allowed.includes(tone)) errors.push(`sections.${i}.settings.background: o tom "${tone}" não combina com o texto de ${s.type} (use ${allowed.join(', ')})`);
    }
  });
  for (const meta of sectionsOfTemplate(doc.template.key)) {
    if (meta.required && !counts.has(meta.type)) errors.push(`sections: a seção obrigatória "${meta.label}" (${meta.type}) não pode ser removida`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, document: doc };
}

/** Regras de edição do template (consumidas pelo `editor-core`): tipos únicos têm âncoras fixas; os repetíveis (D-031) têm limite por tipo. */
export function editorRules(templateKey: string) {
  const metas = sectionsOfTemplate(templateKey);
  const byType = new Map(metas.map((m) => [m.type, m]));
  return {
    placementOf: (type: string) => byType.get(type)?.placement,
    singleton: new Set(metas.filter((m) => !isRepeatable(m.type)).map((m) => m.type)) as ReadonlySet<string>,
    required: new Set(metas.filter((m) => m.required).map((m) => m.type)) as ReadonlySet<string>,
    maxSections: MAX_SECTIONS_PER_DOCUMENT,
    maxPerType: new Map(metas.filter((m) => isRepeatable(m.type)).map((m) => [m.type, MAX_PER_REPEATABLE_TYPE])) as ReadonlyMap<string, number>,
  };
}
