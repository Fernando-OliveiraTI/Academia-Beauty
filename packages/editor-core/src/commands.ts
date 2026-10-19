import type { PageDocument, SectionBackground } from '@academia/page-schema';

export type Section = PageDocument['sections'][number];

/** Regras de edição do template, fornecidas por quem conhece o registry (o editor não importa React). */
export type EditorRules = {
  /** Região de renderização do tipo; seções só se movem dentro da própria região. */
  placementOf?: (type: string) => string | undefined;
  /** Tipos que existem no máximo uma vez por página (nav, hero, footer…). */
  singleton?: ReadonlySet<string>;
  /** Tipos que não podem ser removidos (a página perde o sentido sem eles). */
  required?: ReadonlySet<string>;
  /** Limite de seções (o schema do documento aceita até 200). */
  maxSections?: number;
  /** Tipos que podem se repetir, com o máximo de instâncias por página (os demais seguem `singleton`). */
  maxPerType?: ReadonlyMap<string, number>;
};

export type EditResult = { ok: true; doc: PageDocument } | { ok: false; error: EditError };
export type EditError =
  | { code: 'not_found'; id: string }
  | { code: 'duplicate_id'; id: string }
  | { code: 'singleton'; type: string }
  | { code: 'required'; type: string }
  | { code: 'cross_region'; id: string; from?: string; to?: string }
  | { code: 'out_of_range'; index: number }
  | { code: 'too_many'; max: number }
  | { code: 'too_many_of_type'; type: string; max: number };

const MAX_SECTIONS = 200;
const ID_MAX = 64;

const ok = (doc: PageDocument): EditResult => ({ ok: true, doc });
const fail = (error: EditError): EditResult => ({ ok: false, error });

const indexOf = (doc: PageDocument, id: string) => doc.sections.findIndex((s) => s.id === id);
const withSections = (doc: PageDocument, sections: Section[]): PageDocument => ({ ...doc, sections });

/** Id novo e único para o tipo: `hero`, `hero-2`, `hero-3`… (sempre ≤ 64 caracteres). */
export function newSectionId(doc: PageDocument, type: string): string {
  const base = (type.split('.').pop() ?? type).replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 40) || 'secao';
  const taken = new Set(doc.sections.map((s) => s.id));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`.slice(0, ID_MAX);
    if (!taken.has(candidate)) return candidate;
  }
}

/** Insere a seção na posição (padrão: fim). A validade do conteúdo é checada por `parsePageDocument`. */
export function addSection(doc: PageDocument, section: Section, index: number = doc.sections.length, rules: EditorRules = {}): EditResult {
  if (index < 0 || index > doc.sections.length) return fail({ code: 'out_of_range', index });
  if (doc.sections.length >= (rules.maxSections ?? MAX_SECTIONS)) return fail({ code: 'too_many', max: rules.maxSections ?? MAX_SECTIONS });
  if (indexOf(doc, section.id) !== -1) return fail({ code: 'duplicate_id', id: section.id });
  if (rules.singleton?.has(section.type) && doc.sections.some((s) => s.type === section.type)) {
    return fail({ code: 'singleton', type: section.type });
  }
  const perType = rules.maxPerType?.get(section.type);
  if (perType !== undefined && doc.sections.filter((s) => s.type === section.type).length >= perType) {
    return fail({ code: 'too_many_of_type', type: section.type, max: perType });
  }
  if (rules.placementOf) {
    // A seção nova só entra contígua à própria região do template (mesma regra de `moveSection`).
    const own = rules.placementOf(section.type);
    const before = doc.sections[index - 1];
    const after = doc.sections[index];
    const sameAsBefore = before ? rules.placementOf(before.type) === own : false;
    const sameAsAfter = after ? rules.placementOf(after.type) === own : false;
    if (doc.sections.length > 0 && !sameAsBefore && !sameAsAfter) {
      return fail({ code: 'cross_region', id: section.id, from: own, to: (after ?? before) && rules.placementOf((after ?? before)!.type) });
    }
  }
  const sections = doc.sections.slice();
  sections.splice(index, 0, section);
  return ok(withSections(doc, sections));
}

export function removeSection(doc: PageDocument, id: string, rules: EditorRules = {}): EditResult {
  const at = indexOf(doc, id);
  if (at === -1) return fail({ code: 'not_found', id });
  const type = doc.sections[at]!.type;
  if (rules.required?.has(type)) return fail({ code: 'required', type });
  return ok(withSections(doc, doc.sections.filter((_, i) => i !== at)));
}

/** Move para a posição `toIndex` da lista já sem o item. Recusa mover para outra região do template. */
export function moveSection(doc: PageDocument, id: string, toIndex: number, rules: EditorRules = {}): EditResult {
  const from = indexOf(doc, id);
  if (from === -1) return fail({ code: 'not_found', id });
  const rest = doc.sections.filter((_, i) => i !== from);
  if (toIndex < 0 || toIndex > rest.length) return fail({ code: 'out_of_range', index: toIndex });

  const moving = doc.sections[from]!;
  if (rules.placementOf) {
    const own = rules.placementOf(moving.type);
    // Vizinhos de destino: a seção cai entre rest[toIndex-1] e rest[toIndex]; precisa ficar contígua à própria região.
    const before = rest[toIndex - 1];
    const after = rest[toIndex];
    const sameAsBefore = before ? rules.placementOf(before.type) === own : false;
    const sameAsAfter = after ? rules.placementOf(after.type) === own : false;
    if (toIndex !== from && !sameAsBefore && !sameAsAfter) {
      const target = (after ?? before) && rules.placementOf((after ?? before)!.type);
      return fail({ code: 'cross_region', id, from: own, to: target });
    }
  }
  if (toIndex === from) return ok(doc);
  const sections = rest.slice();
  sections.splice(toIndex, 0, moving);
  return ok(withSections(doc, sections));
}

/** Duplica logo após o original, com conteúdo clonado. Recusa tipos únicos. */
export function duplicateSection(doc: PageDocument, id: string, rules: EditorRules = {}): EditResult {
  const at = indexOf(doc, id);
  if (at === -1) return fail({ code: 'not_found', id });
  const source = doc.sections[at]!;
  const copy: Section = { ...structuredClone(source), id: newSectionId(doc, source.type) };
  return addSection(doc, copy, at + 1, rules);
}

/** Substitui o conteúdo da seção (o chamador envia o objeto inteiro; validação fica no schema do registry). */
export function updateContent(doc: PageDocument, id: string, content: Record<string, unknown>): EditResult {
  const at = indexOf(doc, id);
  if (at === -1) return fail({ code: 'not_found', id });
  // Conteúdo idêntico não cria entrada de histórico nem salvamento: devolve o mesmo documento.
  if (JSON.stringify(doc.sections[at]!.content) === JSON.stringify(content)) return ok(doc);
  // Clona: o chamador pode continuar mutando o objeto que enviou sem alterar o histórico.
  return patchSection(doc, id, (s) => ({ ...s, content: structuredClone(content) }));
}

export function setVisibility(doc: PageDocument, id: string, enabled: boolean): EditResult {
  const at = indexOf(doc, id);
  if (at !== -1 && doc.sections[at]!.visibility.enabled === enabled) return ok(doc);
  return patchSection(doc, id, (s) => ({ ...s, visibility: { ...s.visibility, enabled } }));
}

export function setVariant(doc: PageDocument, id: string, variant: string | undefined): EditResult {
  return patchSection(doc, id, (s) => {
    const { variant: _drop, ...rest } = s;
    return variant === undefined ? rest : { ...rest, variant };
  });
}

/** Fundo da seção (9B). `undefined` volta ao padrão do modelo. Valor igual ao atual não cria histórico. */
export function setBackground(doc: PageDocument, id: string, background: SectionBackground | undefined): EditResult {
  const at = indexOf(doc, id);
  if (at !== -1 && doc.sections[at]!.settings.background === background) return ok(doc);
  return patchSection(doc, id, (s) => {
    const { background: _drop, ...rest } = s.settings;
    return { ...s, settings: background === undefined ? rest : { ...rest, background } };
  });
}

function patchSection(doc: PageDocument, id: string, fn: (s: Section) => Section): EditResult {
  const at = indexOf(doc, id);
  if (at === -1) return fail({ code: 'not_found', id });
  const sections = doc.sections.slice();
  sections[at] = fn(sections[at]!);
  return ok(withSections(doc, sections));
}
