import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { validatePageDocument, SECTION_META } from '@academia/section-schemas';
import { ALL_SECTIONS } from './registry';
import { NO_OFFER, PageRenderer, buildProfessionalDocument, professionalOriginalTemplate, resolveProfessionalDocument, resolveHomeDocument, courseOriginalTemplate, homeOriginalTemplate } from './index';
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

describe('resolveHomeDocument', () => {
  const people = [{ slug: 'ana', name: 'Ana Souza', cardPhotoSrc: '/site/home/lukas-campos.png' }];
  const courses = [
    { slug: 'curso-um', title: 'Curso Um', person: 'Ana Souza', coverSrc: '/site/home/curso-classic-bob.png', coverAlt: '', featured: true, modality: 'online' as const },
    { slug: 'curso-dois', title: 'Curso Dois', person: 'Ana Souza', coverSrc: '/site/home/curso-classic-bob.png', coverAlt: 'Capa dois', featured: false, modality: 'hibrido' as const },
  ];
  const sectionOf = (doc: ReturnType<typeof resolveHomeDocument>, type: string) => doc.sections.find((s) => s.type === type)!;

  it('sem documento parte do template e injeta as vitrines do catálogo', () => {
    const doc = resolveHomeDocument({ professionals: people, courses });
    expect(validatePageDocument(doc).ok).toBe(true);
    const items = sectionOf(doc, 'home.courses').content.items as { href: string; tags: { label: string; gold?: boolean }[]; person: string; plusLabel: string; image: { alt: string } }[];
    expect(items.map((i) => i.href)).toEqual(['/cursos/curso-um', '/cursos/curso-dois']);
    expect(items[0]?.tags).toEqual([{ label: 'destaques', gold: true }, { label: 'online' }]);
    expect(items[1]?.tags).toEqual([{ label: 'híbrido' }]);
    expect(items[0]?.image.alt).toBe('Curso Um');
    expect(items[0]?.plusLabel).toBe('Ver curso Curso Um');
    expect(sectionOf(doc, 'home.professionals').content.items).toEqual([{ name: 'Ana Souza', photo: '/site/home/lukas-campos.png', href: '/profissionais/ana' }]);
  });

  it('sem cursos ou profissionais publicados a seção correspondente some (nada de link para 404)', () => {
    const doc = resolveHomeDocument({});
    expect(sectionOf(doc, 'home.courses').visibility.enabled).toBe(false);
    expect(sectionOf(doc, 'home.professionals').visibility.enabled).toBe(false);
    const html = renderToStaticMarkup(<PageRenderer document={doc} ctx={ctx} />);
    expect(html).not.toContain('/cursos/');
  });

  it('com documento do editor, o texto editado vale e as vitrines continuam do catálogo', () => {
    const edited = structuredClone(homeOriginalTemplate);
    (sectionOf(edited, 'home.hero').content as { kicker: string }).kicker = 'Texto do editor';
    (sectionOf(edited, 'home.courses').content as { items: unknown[] }).items = [{ congelado: true }];
    const doc = resolveHomeDocument({ document: edited, professionals: people, courses });
    expect((sectionOf(doc, 'home.hero').content as { kicker: string }).kicker).toBe('Texto do editor');
    expect(JSON.stringify(sectionOf(doc, 'home.courses').content.items)).not.toContain('congelado');
    expect(sectionOf(doc, 'home.courses').visibility.enabled).toBe(true);
    expect(edited.sections.length).toBe(homeOriginalTemplate.sections.length);
  });

  it('mais cursos que o limite do schema e textos longos continuam válidos', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...courses[0]!, slug: `c-${i}`, title: 'T'.repeat(200), person: 'P'.repeat(200), coverAlt: 'A'.repeat(500) }));
    const doc = resolveHomeDocument({ professionals: people, courses: many });
    const r = validatePageDocument(doc);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect((sectionOf(doc, 'home.courses').content.items as unknown[]).length).toBe(12);
  });
});
