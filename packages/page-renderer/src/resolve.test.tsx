import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { validatePageDocument, SECTION_META } from '@academia/section-schemas';
import { ALL_SECTIONS } from './registry';
import { NO_OFFER, PageRenderer, buildProfessionalDocument, professionalOriginalTemplate, resolveProfessionalDocument, courseOriginalTemplate, homeOriginalTemplate } from './index';
import { sampleOffer } from './fixtures';

const data = {
  name: 'Ana Souza', specialty: 'Hair', tagline: 'Técnica.', experienceYears: 10, instagramHandle: '@ana', instagramFollowers: '10 mil',
  instagramUrl: 'https://instagram.com/ana', portraitSrc: '/site/profissional/lukas_perfil.png', cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: ['Dez anos.'], works: [], videoSrc: '',
} as never;
const card = { slug: 'curso-um', title: 'Curso Um', coverSrc: '/site/curso/produto-morena-iluminada.svg', coverAlt: 'Capa', discountPct: 20 };
const ctx = { offer: NO_OFFER, year: 2026 };

describe('catálogo de seções (section-schemas × renderer)', () => {
  it('cobre exatamente os mesmos tipos e regiões do registry de componentes', () => {
    const meta = new Map(SECTION_META.map((m) => [m.type, m.placement]));
    const reg = new Map(ALL_SECTIONS.map((e) => [e.type, e.placement]));
    expect(meta).toEqual(reg);
  });

  it('os três templates originais passam na validação autoritativa', () => {
    for (const t of [courseOriginalTemplate, professionalOriginalTemplate, homeOriginalTemplate]) {
      const r = validatePageDocument(t);
      expect(r.ok, JSON.stringify(r)).toBe(true);
    }
  });

  it('recusa template desconhecido e seção de outro template', () => {
    const wrongTemplate = { ...structuredClone(professionalOriginalTemplate), template: { key: 'outro', version: 1 } };
    expect(validatePageDocument(wrongTemplate).ok).toBe(false);
    const mixed = structuredClone(professionalOriginalTemplate);
    mixed.sections.push({ ...structuredClone(courseOriginalTemplate.sections[0]!), id: 'intruso' });
    expect(validatePageDocument(mixed)).toMatchObject({ ok: false });
  });
});

describe('resolveProfessionalDocument', () => {
  it('sem documento equivale ao caminho derivado do cadastro', () => {
    expect(resolveProfessionalDocument({ data, courseCards: [card] })).toEqual(buildProfessionalDocument(data, { courseCards: [card] }));
  });

  it('com documento: preserva a edição e reinjeta os cursos publicados', () => {
    const edited = structuredClone(buildProfessionalDocument(data, { courseCards: [] }));
    const bio = edited.sections.find((s) => s.id === 'bio')!;
    (bio.content as { paragraphs: string[] }).paragraphs = ['Texto editado no editor.'];
    edited.sections = edited.sections.filter((s) => s.id !== 'video');
    expect(edited.sections.find((s) => s.id === 'courses')!.visibility.enabled).toBe(false);

    const out = resolveProfessionalDocument({ data, document: edited, courseCards: [card] });
    const courses = out.sections.find((s) => s.id === 'courses')!;
    expect(courses.visibility.enabled).toBe(true);
    expect((courses.content as { cards: unknown[] }).cards).toHaveLength(1);
    expect(out.sections.find((s) => s.id === 'video')).toBeUndefined();
    const html = renderToStaticMarkup(<PageRenderer document={out} ctx={ctx} />);
    expect(html).toContain('Texto editado no editor.');
    expect(html).toContain('/cursos/curso-um');

    // curso despublicado: a seção some mesmo que o documento tenha cards antigos
    const none = resolveProfessionalDocument({ data, document: out, courseCards: [] });
    expect(none.sections.find((s) => s.id === 'courses')!.visibility.enabled).toBe(false);
    expect(edited.sections.find((s) => s.id === 'courses')!.visibility.enabled).toBe(false); // entrada não é mutada
    void sampleOffer;
  });
});
