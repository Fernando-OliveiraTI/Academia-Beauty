import { describe, expect, it } from 'vitest';
import { validatePageDocument } from '@academia/section-schemas';
import { courseDataSchema, professionalDataSchema, type CourseData, type ProfessionalData } from '@academia/contracts';
import { buildCourseDocument, buildHomeDocument, buildProfessionalDocument, resolveProfessionalDocument } from './index';

const A = (n: number) => 'A'.repeat(n);
/** Todos os campos do cadastro no limite máximo permitido pelo contrato. */
const maxPro = (name: string): ProfessionalData => professionalDataSchema.parse({
  name, specialty: A(40), tagline: A(200), experienceYears: 80, instagramHandle: A(40), instagramFollowers: A(40),
  instagramUrl: `https://instagram.com/${A(30)}`, portraitSrc: '/site/p.png', cardPhotoSrc: '/site/c.png',
  bio: Array.from({ length: 6 }, () => A(1200)),
  works: Array.from({ length: 12 }, () => ({ imageSrc: '/site/w.png', alt: A(300), title: A(120), tags: [A(30), A(30)] })),
  videoSrc: '/site/v.mp4', metaDescription: A(200),
});
const maxCourse = (title: string): CourseData => courseDataSchema.parse({
  title, lead: A(400), modality: 'online', level: 'profissional', workloadHours: 2000, audience: A(80), coverSrc: '/site/c.svg', coverAlt: A(300),
  benefits: Array.from({ length: 4 }, () => ({ title: A(60), text: A(200) })),
  modules: Array.from({ length: 12 }, () => ({ title: A(120), text: A(600), bullets: Array.from({ length: 6 }, () => A(120)) })),
  deliverables: Array.from({ length: 8 }, () => ({ title: A(100), text: A(200) })),
  faq: Array.from({ length: 10 }, () => ({ title: A(160), text: A(800) })),
  testimonials: Array.from({ length: 6 }, () => ({ quote: A(300), name: A(60), role: A(60) })),
  guaranteeDays: 90, metaDescription: A(200),
});
const ok = (doc: unknown) => { const r = validatePageDocument(doc); return r.ok ? [] : r.errors; };

describe('builders aceitam qualquer dado válido do contrato (limites máximos)', () => {
  const names = [A(80), `${A(39)} ${A(40)}`, `${A(70)} ${A(9)}`, 'Ana'];
  it.each(names)('profissional "%s" gera documento válido', (name) => {
    expect(ok(buildProfessionalDocument(maxPro(name), { courseCards: [{ slug: 'c', title: A(80), coverSrc: '/site/c.svg', coverAlt: A(300), discountPct: 90 }] }))).toEqual([]);
  });
  it('profissional também é válido sem cursos e via resolve', () => {
    expect(ok(resolveProfessionalDocument({ data: maxPro(A(80)), courseCards: [] }))).toEqual([]);
  });
  it.each([A(80), `${A(40)} ${A(39)}`, 'Curso'])('curso "%s" gera documento válido', (title) => {
    expect(ok(buildCourseDocument({ data: maxCourse(title), professional: maxPro(A(80)) }))).toEqual([]);
  });
  it('Home aceita vitrine com nomes de 80 caracteres e 24 itens', () => {
    const items = Array.from({ length: 24 }, (_, i) => ({ slug: `p-${i}-aaa`, name: A(80), cardPhotoSrc: '/site/c.png' }));
    expect(ok(buildHomeDocument(items))).toEqual([]);
  });
});
