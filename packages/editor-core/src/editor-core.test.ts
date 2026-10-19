import { describe, expect, it } from 'vitest';
import { DOCUMENT_SCHEMA_VERSION, clearRegistryForTests, parsePageDocument, registerSection, type PageDocument } from '@academia/page-schema';
import { z } from 'zod';
import {
  addSection, canRedo, canUndo, commit, createHistory, duplicateSection, moveSection, newSectionId, redo, removeSection,
  setBackground, setVariant, setVisibility, undo, updateContent, type EditorRules, type Section,
} from './index';

const sec = (id: string, type: string, content: Record<string, unknown> = { t: id }): Section => ({
  id, type, schemaVersion: 1, visibility: { enabled: true }, settings: {}, content,
});
const doc = (...sections: Section[]): PageDocument => ({ schemaVersion: DOCUMENT_SCHEMA_VERSION, template: { key: 'x', version: 1 }, sections });

const region: Record<string, string> = { 'p.nav': 'banner', 'p.hero': 'main', 'p.bio': 'main', 'p.works': 'main', 'p.footer': 'contentinfo' };
const rules: EditorRules = {
  placementOf: (t) => region[t],
  singleton: new Set(['p.nav', 'p.hero', 'p.footer']),
  required: new Set(['p.hero']),
};
const base = () => doc(sec('nav', 'p.nav'), sec('hero', 'p.hero'), sec('bio', 'p.bio'), sec('works', 'p.works'), sec('footer', 'p.footer'));
const ids = (d: PageDocument) => d.sections.map((s) => s.id);
const must = (r: ReturnType<typeof addSection>) => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.doc; };

describe('comandos', () => {
  it('não muta o documento de entrada', () => {
    const d = base();
    const snap = structuredClone(d);
    must(removeSection(d, 'bio'));
    must(moveSection(d, 'bio', 2));
    must(updateContent(d, 'bio', { t: 'novo' }));
    must(setVisibility(d, 'bio', false));
    expect(d).toEqual(snap);
  });

  it('adiciona na posição pedida e recusa id duplicado, índice inválido e tipo único repetido', () => {
    const d = base();
    expect(ids(must(addSection(d, sec('bio-2', 'p.bio'), 3, rules)))).toEqual(['nav', 'hero', 'bio', 'bio-2', 'works', 'footer']);
    expect(addSection(d, sec('bio', 'p.bio'), 1, rules)).toEqual({ ok: false, error: { code: 'duplicate_id', id: 'bio' } });
    expect(addSection(d, sec('x', 'p.bio'), 99, rules)).toEqual({ ok: false, error: { code: 'out_of_range', index: 99 } });
    expect(addSection(d, sec('hero-2', 'p.hero'), 1, rules)).toEqual({ ok: false, error: { code: 'singleton', type: 'p.hero' } });
    expect(addSection(d, sec('z', 'p.bio'), 1, { maxSections: 5 })).toEqual({ ok: false, error: { code: 'too_many', max: 5 } });
  });

  it('remove, mas não seção obrigatória nem inexistente', () => {
    const d = base();
    expect(ids(must(removeSection(d, 'works', rules)))).toEqual(['nav', 'hero', 'bio', 'footer']);
    expect(removeSection(d, 'hero', rules)).toEqual({ ok: false, error: { code: 'required', type: 'p.hero' } });
    expect(removeSection(d, 'nada', rules)).toEqual({ ok: false, error: { code: 'not_found', id: 'nada' } });
  });

  it('move dentro da região e recusa atravessar regiões', () => {
    const d = base();
    expect(ids(must(moveSection(d, 'works', 2, rules)))).toEqual(['nav', 'hero', 'works', 'bio', 'footer']);
    expect(ids(must(moveSection(d, 'bio', 3, rules)))).toEqual(['nav', 'hero', 'works', 'bio', 'footer']);
    // antes do nav e depois do footer saem da região "main"
    expect(moveSection(d, 'bio', 0, rules).ok).toBe(false);
    expect(moveSection(d, 'bio', 4, rules).ok).toBe(false);
    // nav (sozinho na região) não viaja para o meio da página
    expect(moveSection(d, 'nav', 2, rules).ok).toBe(false);
    expect(moveSection(d, 'nav', 0, rules)).toEqual({ ok: true, doc: d });
    expect(moveSection(d, 'bio', 9, rules)).toEqual({ ok: false, error: { code: 'out_of_range', index: 9 } });
  });

  it('duplica com id novo e conteúdo independente; tipos únicos não duplicam', () => {
    const d = doc(sec('bio', 'p.bio', { list: [1] }), sec('hero', 'p.hero'));
    const out = must(duplicateSection(d, 'bio', rules));
    expect(ids(out)).toEqual(['bio', 'bio-2', 'hero']);
    (out.sections[1]!.content.list as number[]).push(2);
    expect(d.sections[0]!.content.list).toEqual([1]);
    expect(duplicateSection(d, 'hero', rules)).toEqual({ ok: false, error: { code: 'singleton', type: 'p.hero' } });
  });

  it('newSectionId gera ids únicos e curtos', () => {
    const d = doc(sec('hero', 'p.hero'), sec('hero-2', 'p.hero'));
    expect(newSectionId(d, 'p.hero')).toBe('hero-3');
    expect(newSectionId(d, 'professional.works')).toBe('works');
    expect(newSectionId(doc(), 'a.' + 'x'.repeat(100)).length).toBeLessThanOrEqual(64);
  });

  it('edita conteúdo, visibilidade e variante', () => {
    const d = base();
    const a = must(updateContent(d, 'bio', { t: 'novo' }));
    expect(a.sections[2]!.content).toEqual({ t: 'novo' });
    expect(must(setVisibility(a, 'bio', false)).sections[2]!.visibility.enabled).toBe(false);
    const v = must(setVariant(d, 'bio', 'dark'));
    expect(v.sections[2]!.variant).toBe('dark');
    expect('variant' in must(setVariant(v, 'bio', undefined)).sections[2]!).toBe(false);
    expect(updateContent(d, 'nada', {})).toEqual({ ok: false, error: { code: 'not_found', id: 'nada' } });
  });

  it('o resultado continua válido para o parsePageDocument', () => {
    clearRegistryForTests();
    for (const type of Object.keys(region)) registerSection({ type, schemaVersion: 1, content: z.object({ t: z.string() }) });
    let d = base();
    d = must(duplicateSection(d, 'bio', rules));
    d = must(moveSection(d, 'works', 2, rules));
    d = must(removeSection(d, 'bio', rules));
    expect(parsePageDocument(d).ok).toBe(true);
    expect(new Set(ids(d)).size).toBe(ids(d).length);
    expect(parsePageDocument(must(updateContent(d, 'works', { t: 1 }))).ok).toBe(false);
    clearRegistryForTests();
  });
});

describe('histórico', () => {
  it('undo/redo restauram estados e o commit descarta o futuro', () => {
    const d0 = base();
    const d1 = must(removeSection(d0, 'works'));
    const d2 = must(removeSection(d1, 'bio'));
    let h = commit(commit(createHistory(d0), d1, { now: 0 }), d2, { now: 5000 });
    expect([canUndo(h), canRedo(h)]).toEqual([true, false]);
    h = undo(h);
    expect(h.present).toBe(d1);
    h = undo(h);
    expect(h.present).toBe(d0);
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.present).toBe(d1);
    expect(canRedo(h)).toBe(true);
    h = commit(h, must(setVisibility(d1, 'hero', false)), { now: 9000 });
    expect(canRedo(h)).toBe(false);
    expect(redo(h)).toBe(h);
  });

  it('agrupa edições contínuas da mesma chave dentro da janela e separa fora dela', () => {
    const d0 = base();
    const type = (text: string, d = d0) => must(updateContent(d, 'bio', { t: text }));
    let h = createHistory(d0);
    h = commit(h, type('a'), { coalesceKey: 'content:bio', now: 0 });
    h = commit(h, type('ab'), { coalesceKey: 'content:bio', now: 400 });
    h = commit(h, type('abc'), { coalesceKey: 'content:bio', now: 800 });
    expect(h.past).toEqual([d0]);
    expect(undo(h).present).toBe(d0);

    h = commit(h, type('abcd'), { coalesceKey: 'content:bio', now: 5000 });
    expect(h.past).toHaveLength(2);
    h = commit(h, must(setVisibility(h.present, 'bio', false)), { coalesceKey: 'vis:bio', now: 5100 });
    expect(h.past).toHaveLength(3);
  });

  it('o primeiro commit nunca é absorvido e a mesma referência não cria entrada', () => {
    const d0 = base();
    const h0 = createHistory(d0);
    expect(commit(h0, d0)).toBe(h0);
    const h1 = commit(h0, must(updateContent(d0, 'bio', { t: 'x' })), { coalesceKey: 'k', now: 0 });
    expect(undo(h1).present).toBe(d0);
  });

  it('respeita o limite de passos desfazíveis', () => {
    let h = createHistory(base());
    for (let i = 0; i < 10; i += 1) h = commit(h, must(updateContent(h.present, 'bio', { t: String(i) })), { limit: 3, now: i * 10_000 });
    expect(h.past).toHaveLength(3);
    let steps = 0;
    while (canUndo(h)) { h = undo(h); steps += 1; }
    expect(steps).toBe(3);
  });
});

describe('bordas', () => {
  it('addSection respeita a região do template', () => {
    const d = base();
    expect(addSection(d, sec('bio-2', 'p.bio'), 0, rules)).toMatchObject({ ok: false, error: { code: 'cross_region' } }); // antes do nav
    expect(addSection(d, sec('bio-2', 'p.bio'), 5, rules)).toMatchObject({ ok: false, error: { code: 'cross_region' } }); // depois do footer
    expect(addSection(d, sec('bio-2', 'p.bio'), 2, rules).ok).toBe(true);
    expect(addSection(d, sec('x', 'p.bio'), -1, rules)).toEqual({ ok: false, error: { code: 'out_of_range', index: -1 } });
  });

  it('moveSection sem placementOf e para o próprio índice', () => {
    const d = base();
    expect(moveSection(d, 'bio', 0).ok).toBe(true); // sem regras de região vale qualquer posição
    expect(moveSection(d, 'bio', 2, rules)).toEqual({ ok: true, doc: d });
  });

  it('conteúdo ou visibilidade idênticos devolvem o mesmo documento (sem entrada no histórico)', () => {
    const d = base();
    expect(must(updateContent(d, 'bio', { t: 'bio' }))).toBe(d);
    expect(must(setVisibility(d, 'bio', true))).toBe(d);
    const h = commit(createHistory(d), must(updateContent(d, 'bio', { t: 'bio' })));
    expect(canUndo(h)).toBe(false);
  });

  it('updateContent clona: mutar o objeto enviado depois não altera o documento', () => {
    const d = base();
    const content: Record<string, unknown> = { t: 'a', list: [1] };
    const out = must(updateContent(d, 'bio', content));
    (content.list as number[]).push(2);
    expect(out.sections[2]!.content.list).toEqual([1]);
  });

  it('limit inválido (0, negativo) usa o padrão e não apaga o histórico', () => {
    let h = createHistory(base());
    for (let i = 0; i < 5; i += 1) h = commit(h, must(updateContent(h.present, 'bio', { t: `v${i}` })), { limit: 0, now: i * 10_000 });
    expect(h.past).toHaveLength(5);
    h = commit(h, must(updateContent(h.present, 'bio', { t: 'fim' })), { limit: -3, now: 99_000 });
    expect(h.past).toHaveLength(6);
  });

  it('newSectionId trunca em 64 caracteres mesmo com sufixo numérico', () => {
    const longType = `a.${'x'.repeat(100)}`;
    let d = doc();
    for (let i = 0; i < 12; i += 1) {
      const id = newSectionId(d, longType);
      expect(id.length).toBeLessThanOrEqual(64);
      d = must(addSection(d, sec(id, longType)));
    }
    expect(new Set(d.sections.map((s) => s.id)).size).toBe(12);
  });

  it('coalescência não atravessa undo e redo seguido de commit descarta o futuro', () => {
    const d0 = base();
    let h = commit(createHistory(d0), must(updateContent(d0, 'bio', { t: 'a' })), { coalesceKey: 'k', now: 0 });
    h = undo(h);
    h = commit(h, must(updateContent(h.present, 'bio', { t: 'b' })), { coalesceKey: 'k', now: 100 });
    expect(h.past).toEqual([d0]);
    h = undo(h);
    h = redo(h);
    h = commit(h, must(updateContent(h.present, 'bio', { t: 'c' })), { coalesceKey: 'k', now: 200 });
    expect(canRedo(h)).toBe(false);
  });
});

describe('9B/9C: tipos repetíveis e fundo da seção', () => {
  const rules: EditorRules = { maxPerType: new Map([['p.bio', 2]]), singleton: new Set(['p.hero']) };

  it('aceita instâncias de um tipo repetível até o limite e recusa a seguinte', () => {
    let d = doc(sec('hero', 'p.hero'), sec('bio', 'p.bio'));
    const second = duplicateSection(d, 'bio', rules);
    expect(second.ok).toBe(true);
    if (second.ok) d = second.doc;
    expect(d.sections.map((s) => s.id)).toEqual(['hero', 'bio', 'bio-2']);
    const third = duplicateSection(d, 'bio', rules);
    expect(third).toEqual({ ok: false, error: { code: 'too_many_of_type', type: 'p.bio', max: 2 } });
  });

  it('tipo único continua recusando a segunda instância; a cópia é clonada, sem compartilhar conteúdo', () => {
    const d = doc(sec('hero', 'p.hero'), sec('bio', 'p.bio', { t: 'a', list: [1] }));
    expect(duplicateSection(d, 'hero', rules)).toMatchObject({ ok: false, error: { code: 'singleton' } });
    const dup = duplicateSection(d, 'bio', rules);
    expect(dup.ok).toBe(true);
    if (!dup.ok) return;
    (dup.doc.sections[2]!.content.list as number[]).push(2);
    expect(d.sections[1]!.content.list).toEqual([1]);
  });

  it('setBackground troca, remove e não cria histórico quando o valor é o mesmo', () => {
    const d = doc(sec('bio', 'p.bio'));
    const gold = setBackground(d, 'bio', 'gold');
    expect(gold.ok && gold.doc.sections[0]!.settings).toEqual({ background: 'gold' });
    if (!gold.ok) return;
    expect(setBackground(gold.doc, 'bio', 'gold')).toEqual({ ok: true, doc: gold.doc });
    const cleared = setBackground(gold.doc, 'bio', undefined);
    expect(cleared.ok && cleared.doc.sections[0]!.settings).toEqual({});
    expect(setBackground(d, 'nada', 'dark')).toEqual({ ok: false, error: { code: 'not_found', id: 'nada' } });
  });
});
