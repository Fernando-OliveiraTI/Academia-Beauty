import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsePageDocument } from '@academia/page-schema';
import { InvalidPageDocumentError, PageRenderer, professionalOriginalTemplate, registerSections } from './index';
import { PROFESSIONAL_SECTIONS } from './professional/registry';
import { sampleOffer } from './fixtures';

const ctx = { offer: sampleOffer, year: 2026 };
const html = (doc: unknown = professionalOriginalTemplate) => renderToStaticMarkup(<PageRenderer document={doc} ctx={ctx} />);
const clone = () => structuredClone(professionalOriginalTemplate);

describe('template Profissional Original', () => {
  it('é válido e cobre todas as seções registradas', () => {
    registerSections();
    expect(parsePageDocument(professionalOriginalTemplate).ok).toBe(true);
    const types = new Set(professionalOriginalTemplate.sections.map((s) => s.type));
    expect(PROFESSIONAL_SECTIONS.every((e) => types.has(e.type))).toBe(true);
  });

  it('renderiza a estrutura do original com a marca Academia Beauty', () => {
    const out = html();
    expect(out).toContain('<div class="pg-pro">');
    expect(out).toContain('<nav class="cb-nav">');
    expect(out).toContain('<header class="profile-hero cb-hero">');
    expect(out).toContain('<h1 class="hero-name reveal">Lukas<span>Campos.</span></h1>');
    for (const id of ['trabalhos', 'video', 'cursos']) expect(out).toContain(`id="${id}"`);
    expect(out).toContain('ACADEMIA <span>BEAUTY</span>');
    expect(out).not.toMatch(/carreira beauty/i);
    expect(out).toContain('© 2026 Academia Beauty');
  });

  it('renderiza as 3 camadas de canvas na ordem do original e não gera partículas no servidor', () => {
    const out = html();
    const order = ['cbTelemetryCanvasLeft', 'cbTelemetryCanvas"', 'cbTelemetryCanvasBoost'].map((id) => out.indexOf(`id="${id.replace('"', '')}`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(out).toContain('<div class="cb-particle-field"></div>');
  });

  it('o ticker repete a unidade 4 vezes (como o script final do original)', () => {
    const unit = 'LUKAS • ACADEMIA BEAUTY • ';
    expect(html()).toContain(`<div class="bio-bg" aria-hidden="true">${unit.repeat(4)}</div>`);
  });

  it('o vídeo não tem autoplay e a URL do Instagram é válida', () => {
    const out = html();
    expect(out).toContain('<video controls="" playsInline');
    expect(out).not.toMatch(/autoplay/i);
    expect(out).toContain('href="https://instagram.com/lucascam"');
    expect(out).toContain('rel="noopener"');
  });

  it('sem cursos publicados a seção de cursos não é renderizada (estado vazio)', () => {
    const doc = clone();
    (doc.sections.find((s) => s.id === 'courses')!.content as { cards: unknown[] }).cards = [];
    expect(html(doc)).not.toContain('id="cursos"');
  });

  it('vários cursos ficam em sequência (espaçamento vem do CSS)', () => {
    const doc = clone();
    const c = doc.sections.find((s) => s.id === 'courses')!.content as { cards: { href: string }[] };
    c.cards = [c.cards[0]!, { ...c.cards[0]!, href: '/preview/curso-2' }];
    expect(html(doc).match(/class="course-card reveal"/g)).toHaveLength(2);
  });

  it('rejeita HTML em texto e URL perigosa', () => {
    const bad = clone();
    (bad.sections[1]!.content as { sub: string }).sub = '<b>x</b>';
    expect(() => html(bad)).toThrow(InvalidPageDocumentError);
    const bad2 = clone();
    (bad2.sections[0]!.content as { account: { href: string } }).account.href = 'javascript:alert(1)';
    expect(() => html(bad2)).toThrow(/URL não permitida/);
  });
});
