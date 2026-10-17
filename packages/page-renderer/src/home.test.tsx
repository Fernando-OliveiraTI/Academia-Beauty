import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsePageDocument } from '@academia/page-schema';
import { InvalidPageDocumentError, PageRenderer, homeOriginalTemplate, registerSections } from './index';
import { HOME_SECTIONS } from './home/registry';
import { sampleOffer } from './fixtures';

const ctx = { offer: sampleOffer, year: 2026 };
const html = (doc: unknown = homeOriginalTemplate) => renderToStaticMarkup(<PageRenderer document={doc} ctx={ctx} />);
const clone = () => structuredClone(homeOriginalTemplate);
const sectionOf = (doc: ReturnType<typeof clone>, id: string) => doc.sections.find((s) => s.id === id)!;

describe('template Home Original', () => {
  it('é válido e cobre todas as seções registradas', () => {
    registerSections();
    expect(parsePageDocument(homeOriginalTemplate).ok).toBe(true);
    const types = new Set(homeOriginalTemplate.sections.map((s) => s.type));
    expect(HOME_SECTIONS.every((e) => types.has(e.type))).toBe(true);
  });

  it('renderiza a estrutura do original', () => {
    const out = html();
    expect(out).toContain('<div class="pg-home"><div class="cb-shell">');
    expect(out).toContain('<nav class="cb-nav" aria-label="Navegação principal">');
    expect(out).toContain('<section class="cb-hero cb-grid-bg">');
    expect(out).toContain('<h1 class="cb-reveal cb-delay-1 cb-in">Aprenda e cresça<span class="outline">com os melhores.</span></h1>');
    for (const id of ['profissionais', 'cursos-home', 'beneficios', 'marcas']) expect(out).toContain(`id="${id}"`);
    expect(out).toContain('<footer class="cb-footer-fx">');
    expect(out).toContain('© 2026 Academia Beauty');
  });

  it('ordem das camadas do hero é a do DOM original e nada aleatório vem do servidor', () => {
    const out = html();
    const order = ['cb-hero-boldfx', 'cb-hero-ribbons', 'cb-hero-energy', 'cb-telemetry-layer', 'cb-video-style-fx', 'cb-noise'].map((c) => out.indexOf(`class="${c}`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(out).not.toMatch(/class="(particle|spark|flash|cb-particle)( [a-z]+)?"/);
  });

  it('usa a marca Academia Beauty (a palavra CARREIRA do CTA é decorativa)', () => {
    const out = html();
    expect(out).not.toMatch(/carreira beauty/i);
    expect(out).toContain('Os cursos da Academia Beauty');
    expect(out).toContain('<div class="outline-word">CARREIRA</div>');
  });

  it('os dois primeiros cursos já vêm revelados e o terceiro revela ao rolar', () => {
    const out = html();
    expect(out.match(/<article class="cb-course cb-reveal[^"]*"/g)).toEqual([
      '<article class="cb-course cb-reveal cb-in"',
      '<article class="cb-course cb-reveal cb-delay-1 cb-in"',
      '<article class="cb-course cb-reveal cb-delay-2"',
    ]);
  });

  it('a lista de profissionais vem do documento e sem profissionais a seção some', () => {
    const out = html();
    expect(out.match(/class="professor-card-link"/g)).toHaveLength(5);
    expect(out).toContain('href="/preview/profissional"');
    const doc = clone();
    (sectionOf(doc, 'professionals').content as { items: unknown[] }).items = [];
    expect(html(doc)).not.toContain('id="profissionais"');
  });

  it('mais de 5 profissionais continuam renderizando em ordem', () => {
    const doc = clone();
    const c = sectionOf(doc, 'professionals').content as { items: { name: string; photo: string; href: string }[] };
    c.items.push({ name: 'Novo Nome', photo: '/x.png', href: '/profissionais/novo-nome' });
    const out = html(doc);
    expect(out.match(/class="professor-card-link"/g)).toHaveLength(6);
    expect(out.indexOf('Novo Nome')).toBeGreaterThan(out.indexOf('Miro Rodrigues'));
  });

  it('rejeita HTML em texto, URL perigosa e seção desconhecida', () => {
    const a = clone();
    (sectionOf(a, 'hero').content as { kicker: string }).kicker = '<script>1</script>';
    expect(() => html(a)).toThrow(InvalidPageDocumentError);
    const b = clone();
    (sectionOf(b, 'nav').content as { account: { href: string } }).account.href = 'javascript:alert(1)';
    expect(() => html(b)).toThrow(/URL não permitida/);
    const c = clone();
    c.sections.push({ id: 'x', type: 'home.raw', schemaVersion: 1, visibility: { enabled: true }, settings: {}, content: {} });
    expect(() => html(c)).toThrow(InvalidPageDocumentError);
  });
});
