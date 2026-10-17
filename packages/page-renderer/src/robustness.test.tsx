import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InvalidPageDocumentError, PageRenderer, courseOriginalTemplate, professionalOriginalTemplate } from './index';
import { sampleOffer } from './fixtures';

const base = { offer: sampleOffer, year: 2026 };

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({
    matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    onchange: null, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  window.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } } as unknown as typeof IntersectionObserver;
  window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
});

describe('robustez do renderer com documentos vindos do editor', () => {
  it('menu do curso com href que não é âncora não quebra a página (A3)', () => {
    const doc = structuredClone(courseOriginalTemplate);
    const header = doc.sections.find((s) => s.type === 'course.header')!;
    (header.content as { nav: { label: string; href: string }[] }).nav = [
      { label: 'Externo', href: 'https://exemplo.com' }, { label: 'Interno', href: '/cursos/x' }, { label: 'Vazio', href: '#' }, { label: 'Bom', href: '#oferta' },
    ];
    expect(() => render(<PageRenderer document={doc} ctx={base} />)).not.toThrow();
  });

  it('chave de template herdada do protótipo (constructor, __proto__) é recusada com erro de documento, não TypeError', () => {
    for (const key of ['constructor', '__proto__', 'toString']) {
      const doc = { ...structuredClone(professionalOriginalTemplate), template: { key, version: 1 } };
      expect(() => renderToStaticMarkup(<PageRenderer document={doc} ctx={base} />)).toThrow(InvalidPageDocumentError);
    }
  });

  it('em curso real (Modo A) a seção de checkout de demonstração não é renderizada, mesmo visível', () => {
    const doc = structuredClone(courseOriginalTemplate);
    for (const s of doc.sections) if (s.type === 'course.checkout') s.visibility = { enabled: true };
    const redirect = renderToStaticMarkup(<PageRenderer document={doc} ctx={{ ...base, checkout: { mode: 'redirect', url: 'https://pay.example.com/c' } }} />);
    expect(redirect).not.toContain('id="checkout"');
    expect(redirect).not.toMatch(/cvv|Finalizar compra/i);
    const demo = renderToStaticMarkup(<PageRenderer document={doc} ctx={base} />);
    expect(demo).toContain('id="checkout"');
  });

  it('botão de compra: tabIndex é respeitado nos modos redirect e indisponível; barra fixa fica inerte fora da tela', () => {
    const doc = structuredClone(courseOriginalTemplate);
    const ok = renderToStaticMarkup(<PageRenderer document={doc} ctx={{ ...base, checkout: { mode: 'redirect', url: 'https://pay.example.com/c' } }} />);
    expect(ok).toMatch(/id="sticky-cta"[^>]*inert/);
    expect(ok).toMatch(/<a class="btn btn--primary" href="https:\/\/pay\.example\.com\/c" rel="noopener noreferrer" tabindex="-1" data-cta/);
    const off = renderToStaticMarkup(<PageRenderer document={doc} ctx={{ ...base, checkout: { mode: 'redirect', url: null } }} />);
    expect(off).toContain('role="button"');
    expect(off).not.toContain('role="link"');
  });

  it('itens repetidos (mesmo texto/href) não geram chaves duplicadas', () => {
    const errors: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { errors.push(String(args[0])); };
    try {
      const doc = structuredClone(professionalOriginalTemplate);
      const bio = doc.sections.find((s) => s.type === 'professional.bio')!;
      (bio.content as { paragraphs: string[] }).paragraphs = ['igual', 'igual', 'igual'];
      const nav = doc.sections.find((s) => s.type === 'professional.nav')!;
      const link = { label: 'Cursos', href: '#cursos' };
      (nav.content as { links: unknown[] }).links = [link, link, link];
      act(() => { render(<PageRenderer document={doc} ctx={base} />); });
    } finally {
      console.error = original;
    }
    expect(errors.filter((e) => /same key|unique "key"/i.test(e))).toEqual([]);
  });
});
