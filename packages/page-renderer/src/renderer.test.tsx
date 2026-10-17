import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsePageDocument } from '@academia/page-schema';
import { courseOriginalTemplate, InvalidPageDocumentError, PageRenderer, registerSections } from './index';
import { COURSE_SECTIONS } from './course/registry';
import { sampleOffer } from './fixtures';

const ctx = { offer: sampleOffer, year: 2026 };
const clone = () => structuredClone(courseOriginalTemplate);
const html = (doc: unknown = courseOriginalTemplate) => renderToStaticMarkup(<PageRenderer document={doc} ctx={ctx} />);

describe('template Curso Original', () => {
  it('é um documento válido e cobre todas as seções do registry', () => {
    registerSections();
    const r = parsePageDocument(courseOriginalTemplate);
    expect(r.ok).toBe(true);
    const types = new Set(courseOriginalTemplate.sections.map((s) => s.type));
    expect(COURSE_SECTIONS.every((e) => types.has(e.type))).toBe(true);
  });

  it('renderiza landmarks, âncoras e preços formatados como no original', () => {
    const out = html();
    expect(out).toContain('<header class="header" id="header">');
    expect(out).toContain('<main id="conteudo-principal">');
    expect(out).toContain('<footer class="footer">');
    for (const id of ['top', 'beneficios', 'conteudo', 'entrega', 'instrutor', 'depoimentos', 'oferta', 'faq', 'checkout', 'garantia']) {
      expect(out).toContain(`id="${id}"`);
    }
    expect(out).toContain('R$ 250,00');
    expect(out).toContain('R$ 175,00');
    expect(out).toContain('ou 6x de R$ 29,17 sem juros');
    expect(out).toContain('30% OFF');
    expect(out).toContain('−R$ 75,00');
    expect(out).not.toMatch(/R\$ /); // espaço comum, como o original
  });

  it('mantém o primeiro módulo aberto e o ano do rodapé vem do contexto', () => {
    const out = html();
    expect(out).toContain('class="acc-item is-open"');
    expect(out).toContain('© 2026 Academia Beauty');
  });

  it('não emite scripts nem a imagem remota da Shopify', () => {
    const out = html();
    expect(out).not.toContain('<script');
    expect(out).not.toContain('shopify');
  });

  it('o h1 do hero é único e mantém o destaque', () => {
    const out = html();
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('<h1 class="hero-title load-in" id="hero-title">Morena <span>Iluminada.</span></h1>');
  });
});

describe('segurança do documento', () => {
  it('rejeita seção fora do registry', () => {
    const doc = clone();
    doc.sections.push({ id: 'x', type: 'raw.html', schemaVersion: 1, visibility: { enabled: true }, settings: {}, content: { html: '<script>1</script>' } });
    expect(() => html(doc)).toThrow(InvalidPageDocumentError);
  });

  it('rejeita marcação HTML em texto', () => {
    const doc = clone();
    doc.sections[1]!.content = { ...doc.sections[1]!.content, lead: '<img src=x onerror=alert(1)>' };
    expect(() => html(doc)).toThrow(/Marcação não é permitida/);
  });

  it('rejeita URL javascript: em links', () => {
    const doc = clone();
    const header = doc.sections[0]!.content as { nav: { label: string; href: string }[] };
    header.nav[0]!.href = 'javascript:alert(1)';
    expect(() => html(doc)).toThrow(/URL não permitida/);
  });

  it('respeita seção desabilitada', () => {
    const doc = clone();
    doc.sections.find((s) => s.id === 'proof')!.visibility = { enabled: false };
    expect(html(doc)).not.toContain('id="depoimentos"');
  });
});
