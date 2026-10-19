import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { validatePageDocument } from '@academia/section-schemas';
import { NO_OFFER, PageRenderer, courseOriginalTemplate, resolveCourseDocument } from './index';

const pro = {
  name: 'Ana Souza', specialty: 'Hair', tagline: 'Técnica.', experienceYears: 10, instagramHandle: '@ana', instagramFollowers: '10 mil',
  instagramUrl: 'https://instagram.com/ana', portraitSrc: '/site/profissional/lukas_perfil.png', cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: ['Dez anos.'], works: [], videoSrc: '',
} as never;
const ctx = { offer: NO_OFFER, year: 2026 };

/** Documento do Curso como o editor salva: instrutor com o conteúdo dado. */
function docWith(patch: Record<string, unknown>, dropPhoto = true) {
  const doc = structuredClone(courseOriginalTemplate);
  const section = doc.sections.find((s) => s.type === 'course.instructor')!;
  const content = { ...(section.content as Record<string, unknown>), ...patch };
  if (dropPhoto) delete content.photo;
  section.content = content;
  return doc;
}
const instructorOf = (doc: ReturnType<typeof resolveCourseDocument>) => doc.sections.find((s) => s.type === 'course.instructor')!.content as { photo?: { src: string }; hidePhoto?: boolean };
const resolve = (document: ReturnType<typeof docWith>) => resolveCourseDocument({ data: {} as never, professional: pro, document });

describe('retrato do instrutor: "sem retrato" explícito', () => {
  it('documento salvo sem foto herda o retrato do cadastro (comportamento para documentos antigos)', () => {
    expect(instructorOf(resolve(docWith({}))).photo?.src).toBe('/site/profissional/lukas_perfil.png');
  });

  it('com hidePhoto ligado o retrato do cadastro NÃO é reposto: o editor consegue ficar sem retrato', () => {
    const out = instructorOf(resolve(docWith({ hidePhoto: true })));
    expect(out.photo).toBeUndefined();
    expect(out.hidePhoto).toBe(true);
  });

  it('com hidePhoto ligado a página mostra o monograma, mesmo que o documento ainda guarde uma foto', () => {
    const doc = docWith({ hidePhoto: true, photo: { src: '/site/profissional/lukas_perfil.png', alt: 'Retrato' } }, false);
    const html = renderToStaticMarkup(<PageRenderer document={resolve(doc)} ctx={ctx} />);
    const instructor = html.slice(html.indexOf('id="instrutor"'), html.indexOf('id="depoimentos"'));
    expect(instructor).toContain('class="monogram"');
    expect(instructor).not.toContain('<img');
  });

  it('sem hidePhoto e com foto, a foto aparece como antes', () => {
    const doc = docWith({ photo: { src: '/site/profissional/lukas_perfil.png', alt: 'Retrato' } }, false);
    const html = renderToStaticMarkup(<PageRenderer document={resolve(doc)} ctx={ctx} />);
    const instructor = html.slice(html.indexOf('id="instrutor"'), html.indexOf('id="depoimentos"'));
    expect(instructor).toContain('<img');
    expect(instructor).not.toContain('class="monogram"');
  });

  it('o servidor valida o marcador: só booleano', () => {
    expect(validatePageDocument(docWith({ hidePhoto: true }))).toMatchObject({ ok: true });
    expect(validatePageDocument(docWith({ hidePhoto: false }))).toMatchObject({ ok: true });
    expect(validatePageDocument(docWith({ hidePhoto: 'sim' }))).toMatchObject({ ok: false });
  });
});
