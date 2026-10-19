import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { courseOriginalTemplate, homeOriginalTemplate, PageRenderer, professionalOriginalTemplate } from './index';
import { sampleOffer } from './fixtures';

const ctx = { offer: sampleOffer, year: 2026 };
const html = (doc: unknown) => renderToStaticMarkup(<PageRenderer document={doc} ctx={ctx} />);
const idsOf = (markup: string) => [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);

/** Documento do Curso com a seção `type` repetida `times` vezes logo após a original (ids de seção únicos). */
function withCopies(type: string, times: number, base: { sections: Array<{ id: string; type: string }> } = courseOriginalTemplate) {
  const doc = structuredClone(base) as typeof courseOriginalTemplate;
  const at = doc.sections.findIndex((s) => s.type === type);
  const copies = Array.from({ length: times }, (_, i) => ({ ...structuredClone(doc.sections[at]!), id: `${doc.sections[at]!.id}-${i + 2}` }));
  doc.sections.splice(at + 1, 0, ...copies);
  return doc;
}

describe('seções repetidas (9C)', () => {
  it('sem repetição o HTML não muda: ids sem sufixo e nenhum invólucro de fundo', () => {
    const out = html(courseOriginalTemplate);
    expect(out).toContain('id="faq"');
    expect(out).not.toContain('pg-bg');
    expect(out).not.toContain('id="faq--2"');
  });

  it.each([
    ['course.faq', ['faq', 'faq-title']],
    ['course.benefits', ['beneficios', 'beneficios-title']],
    ['course.proof', ['depoimentos', 'prova-title']],
    ['course.final-cta', ['final-title']],
  ])('%s repetida: a 2ª e a 3ª instância ganham ids próprios e o documento não tem id duplicado', (type, bases) => {
    const out = html(withCopies(type, 2));
    const ids = idsOf(out);
    expect(new Set(ids).size, `ids duplicados: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(', ')}`).toBe(ids.length);
    for (const base of bases) {
      expect(ids).toContain(base);
      expect(ids).toContain(`${base}--2`);
      expect(ids).toContain(`${base}--3`);
    }
  });

  it('aria-labelledby de cada instância aponta para o título da própria instância', () => {
    const out = html(withCopies('course.faq', 1));
    expect(out).toContain('aria-labelledby="faq-title"');
    expect(out).toContain('aria-labelledby="faq-title--2"');
    expect(out).toContain('id="faq--2-1"'); // itens do acordeão da 2ª instância; os da 1ª seguem `faq-1`, `faq-2`…
    expect(out).toContain('id="faq-2"'); // item 2 do acordeão da 1ª instância não colide com a seção da 2ª
  });

  it('seção oculta não conta para o HTML, mas a numeração segue a ordem do documento', () => {
    const doc = withCopies('course.faq', 1);
    const first = doc.sections.find((s) => s.id === 'faq')!;
    first.visibility = { enabled: false };
    const out = html(doc);
    expect(out).toContain('id="faq--2"');
    expect(out).not.toContain('id="faq"');
  });
});

describe('seções repetidas do Profissional e da Home', () => {
  it.each([
    ['professional.works', 'trabalhos'],
    ['professional.video', 'video'],
  ])('%s repetida: ids únicos no documento', (type, base) => {
    const doc = withCopies(type, 2, professionalOriginalTemplate);
    const ids = idsOf(html(doc));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(`${base}--2`);
    expect(ids).toContain(`${base}--3`);
  });

  it('professional.bio e home.cta repetidas renderizam sem lançar e sem id duplicado', () => {
    for (const [type, base] of [['professional.bio', professionalOriginalTemplate], ['home.cta', homeOriginalTemplate]] as const) {
      const ids = idsOf(html(withCopies(type, 1, base)));
      expect(new Set(ids).size, type).toBe(ids.length);
    }
  });
});

describe('fundo da seção (9B)', () => {
  it('tom claro na Trajetória do Profissional (esquema claro) também sai no invólucro', () => {
    const doc = structuredClone(professionalOriginalTemplate);
    doc.sections.find((x) => x.type === 'professional.bio')!.settings = { background: 'paper' };
    expect(html(doc)).toContain('<div class="pg-bg" data-bg="paper"><section class="bio-section');
  });

  it('com fundo escolhido a seção sai dentro de um invólucro com o tom; sem escolha, sem invólucro', () => {
    const doc = structuredClone(courseOriginalTemplate);
    doc.sections.find((s) => s.type === 'course.faq')!.settings = { background: 'glow' };
    const out = html(doc);
    expect(out).toContain('<div class="pg-bg" data-bg="glow"><section class="section faq');
    expect(out.match(/pg-bg/g)).toHaveLength(1);
  });

  it.each(['surface', 'dark', 'glow'])('o tom %s (esquema escuro do Curso) é aplicado ao atributo data-bg', (tone) => {
    const doc = structuredClone(courseOriginalTemplate);
    doc.sections.find((s) => s.type === 'course.benefits')!.settings = { background: tone as 'surface' };
    expect(html(doc)).toContain(`data-bg="${tone}"`);
  });

  it('valor fora da lista invalida o documento (nunca vira estilo livre)', () => {
    const doc = structuredClone(courseOriginalTemplate);
    doc.sections.find((s) => s.type === 'course.faq')!.settings = { background: 'url(javascript:alert(1))' } as never;
    expect(() => html(doc)).toThrow();
  });
});
