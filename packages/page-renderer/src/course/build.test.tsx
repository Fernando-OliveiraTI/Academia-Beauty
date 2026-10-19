import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsePageDocument } from '@academia/page-schema';
import { computeOffer, courseDataSchema, professionalDataSchema } from '@academia/contracts';
import { PageRenderer, buildCourseDocument, buildProfessionalDocument, professionalCourseCards, registerSections, splitTitle } from '../index';

const pro = professionalDataSchema.parse({
  name: 'Bruno Alves',
  specialty: 'Barber',
  tagline: 'Fade e navalha.',
  experienceYears: 8,
  instagramHandle: '@brunoalves',
  instagramFollowers: '12 mil seguidores',
  instagramUrl: 'https://instagram.com/brunoalves',
  portraitSrc: '/site/b.png',
  cardPhotoSrc: '/site/c.png',
  bio: ['Barbeiro há oito anos.'],
});

const course = courseDataSchema.parse({
  title: 'Navalha Moderna',
  lead: 'Fade e acabamento na navalha.',
  modality: 'online',
  level: 'intermediario',
  workloadHours: 6,
  audience: 'Barbeiros',
  coverSrc: '/site/capa.png',
  coverAlt: 'Capa do curso',
  benefits: [{ title: 'Fade limpo', text: 'Transições perfeitas.' }],
  modules: [{ title: 'Fundamentos', text: 'Postura e ferramentas.', bullets: ['Navalha', 'Pente'] }],
  deliverables: [{ title: 'Aulas gravadas', text: 'Acesso ao conteúdo.' }],
});

const offer = (discountPct: number) => computeOffer({ listCents: 20000, discountPct, maxInstallments: 4 });
const render = (doc: unknown, discountPct: number, checkout: { mode: 'redirect'; url: string | null } | undefined = { mode: 'redirect', url: 'https://pay.example.com/c/1' }) => {
  registerSections();
  return renderToStaticMarkup(<PageRenderer document={doc} ctx={{ offer: offer(discountPct), year: 2026, checkout }} />);
};

/** Textos específicos do curso aprovado: nunca podem vazar para outro curso/profissional. */
const LEAKS = ['Lukas', 'Morena', 'ROM CONCEPT', 'Victoria', 'Tassia', 'lucascam', '53,6', 'Moscou', 'castanha', 'Ambiente de demonstração', '4111'];

describe('buildCourseDocument', () => {
  it('gera documento válido com os dados do cadastro e nada do template aprovado', () => {
    const doc = buildCourseDocument({ data: course, professional: pro });
    expect(parsePageDocument(doc).ok).toBe(true);
    const html = render(doc, 30);
    expect(html).toContain('Navalha <span>Moderna.</span>');
    expect(html).toContain('Bruno Alves');
    expect(html).toContain('Fade e acabamento na navalha.');
    expect(html).toContain('Aprenda com Bruno Alves.');
    for (const leak of LEAKS) expect(html, leak).not.toContain(leak);
  });

  it('é determinístico e não altera o template compartilhado', () => {
    const a = JSON.stringify(buildCourseDocument({ data: course, professional: pro }));
    const b = JSON.stringify(buildCourseDocument({ data: course, professional: pro }));
    expect(a).toBe(b);
    const c = buildCourseDocument({ data: course, professional: pro });
    (c.sections[0]!.content as { brandLead: string }).brandLead = 'X';
    expect(JSON.stringify(buildCourseDocument({ data: course, professional: pro }))).toBe(a);
  });

  it('Modo A: checkout próprio sem campos de cartão; botões levam à URL do provedor com rel seguro', () => {
    const html = render(buildCourseDocument({ data: course, professional: pro }), 30);
    expect(html).toContain('id="checkout"');
    expect(html).toContain('id="buyer-0"');
    expect(html).not.toMatch(/cardNumber|cvv|Ambiente de demonstração/i);
    const ctas = [...html.matchAll(/<a [^>]*data-cta[^>]*>/g)].map((m) => m[0]);
    expect(ctas.length).toBeGreaterThanOrEqual(5);
    for (const cta of ctas) {
      expect(cta).toContain('href="https://pay.example.com/c/1"');
      expect(cta).toContain('rel="noopener noreferrer"');
    }
  });

  it('preço vem da oferta do backend: com e sem desconto', () => {
    const doc = buildCourseDocument({ data: course, professional: pro });
    const withDiscount = render(doc, 25);
    expect(withDiscount).toContain('25% OFF');
    expect(withDiscount).toContain('R$ 150,00');
    expect(withDiscount).toContain('<s>R$ 200,00</s>');
    const none = render(doc, 0);
    expect(none).not.toContain('OFF');
    expect(none).not.toContain('<s>');
    expect(none).toContain('R$ 200,00');
  });

  it('compra indisponível: botões desativados, sem link externo e aviso na oferta', () => {
    const html = render(buildCourseDocument({ data: course, professional: pro }), 0, { mode: 'redirect', url: null });
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('temporariamente indisponível');
    expect(html).not.toContain('pay.example.com');
    expect(html).not.toMatch(/<a [^>]*data-cta/);
  });

  it('o renderer recusa navegar para URL que não seja https', () => {
    for (const url of ['javascript:alert(1)', 'http://pay.example.com', '//evil.com', 'data:text/html,x']) {
      const html = render(buildCourseDocument({ data: course, professional: pro }), 0, { mode: 'redirect', url });
      expect(html, url).not.toMatch(/<a [^>]*data-cta/);
      expect(html, url).toContain('aria-disabled="true"');
    }
  });

  it('só mostra garantia, FAQ e depoimentos quando cadastrados', () => {
    const bare = render(buildCourseDocument({ data: course, professional: pro }), 0);
    for (const absent of ['id="garantia"', 'id="faq"', 'id="depoimentos"', 'Garantia de', 'dias de garantia']) expect(bare, absent).not.toContain(absent);

    const full = courseDataSchema.parse({
      ...course,
      guaranteeDays: 14,
      faq: [{ title: 'Como acesso?', text: 'Pelo e-mail.' }],
      testimonials: [{ quote: 'Muito bom.', name: 'Carlos', role: 'Barbeiro' }],
    });
    const html = render(buildCourseDocument({ data: full, professional: pro }), 0);
    expect(html).toContain('id="garantia"');
    expect(html).toContain('Garantia de 14 dias');
    expect(html).toContain('Como acesso?');
    expect(html).toContain('Muito bom.');
    expect(html).not.toContain('Depoimentos de exemplo');
  });

  it('conteúdo em texto simples: marcação digitada vira texto escapado', () => {
    // O contrato recusa `<`; aqui garantimos que, mesmo se chegasse, o React escapa.
    const sneaky = { ...course, lead: 'Aprenda <img src=x onerror=alert(1)>' };
    const parsed = parsePageDocument(buildCourseDocument({ data: sneaky, professional: pro }));
    expect(parsed.ok).toBe(false);
  });

  it('título de uma palavra e textos longos continuam válidos', () => {
    expect(splitTitle('Fade')).toEqual({ lead: '', accent: 'Fade.' });
    const long = courseDataSchema.parse({ ...course, title: 'A'.repeat(80), audience: 'B'.repeat(80) });
    const longPro = professionalDataSchema.parse({ ...pro, name: 'N'.repeat(80), instagramFollowers: 'F'.repeat(40) });
    expect(parsePageDocument(buildCourseDocument({ data: long, professional: longPro })).ok).toBe(true);
  });
});

describe('vitrine de cursos na página do profissional', () => {
  const cards = [
    { slug: 'navalha-moderna', title: 'Navalha Moderna', coverSrc: '/site/capa.png', coverAlt: 'Capa', discountPct: 30 },
    { slug: 'fade-classico', title: 'Fade', coverSrc: '/site/capa2.png', coverAlt: '', discountPct: 0 },
  ];

  it('mapeia cartões: link, desconto e título', () => {
    const mapped = professionalCourseCards(cards, 'Bruno Alves');
    expect(mapped[0]).toMatchObject({ href: '/cursos/navalha-moderna', titleLead: 'Navalha', titleAccent: 'Moderna.', badge: '30% OFF', person: 'Bruno Alves' });
    expect(mapped[1]).not.toHaveProperty('badge');
    expect(mapped[1]!.image.alt).toBe('Fade');
  });

  it('a seção de cursos aparece com os cartões e some sem cursos', () => {
    registerSections();
    const ctx = { offer: offer(0), year: 2026 };
    const withCourses = buildProfessionalDocument(pro, { courseCards: cards });
    expect(parsePageDocument(withCourses).ok).toBe(true);
    const html = renderToStaticMarkup(<PageRenderer document={withCourses} ctx={ctx} />);
    expect(html).toContain('href="/cursos/navalha-moderna"');
    expect(html).toContain('href="/cursos/fade-classico"');
    expect(html).toContain('Cursos de Bruno.');
    const without = renderToStaticMarkup(<PageRenderer document={buildProfessionalDocument(pro)} ctx={ctx} />);
    expect(without).not.toContain('/cursos/');
    expect(without).not.toContain('id="cursos"');
  });
});
