import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsePageDocument } from '@academia/page-schema';
import { professionalDataSchema, type ShowcaseItem } from '@academia/contracts';
import { NO_OFFER, PageRenderer, buildHomeDocument, buildProfessionalDocument, registerSections, splitName } from './index';

const ctx = { offer: NO_OFFER, year: 2026 };
const html = (doc: unknown) => renderToStaticMarkup(<PageRenderer document={doc} ctx={ctx} />);

const data = professionalDataSchema.parse({
  name: 'Ana Maria Souza',
  specialty: 'Colorista',
  tagline: 'Técnica e carreira.',
  experienceYears: 1,
  instagramHandle: '@anamaria',
  instagramFollowers: '10 mil seguidores',
  instagramUrl: 'https://instagram.com/anamaria',
  portraitSrc: '/site/a.png',
  cardPhotoSrc: '/site/b.png',
  bio: ['Primeiro parágrafo.', 'Segundo parágrafo.'],
  works: [{ imageSrc: '/site/w1.png', alt: 'Trabalho 1', title: 'Loiro Frio', tags: ['loiro'] }],
  videoSrc: '/site/v.mp4',
});

describe('splitName', () => {
  it('separa o último sobrenome e tolera nome simples', () => {
    expect(splitName('Lukas Campos')).toEqual({ first: 'Lukas', accent: 'Campos.' });
    expect(splitName('Ana Maria Souza')).toEqual({ first: 'Ana Maria', accent: 'Souza.' });
    expect(splitName('Madonna')).toEqual({ first: 'Madonna', accent: '' });
  });
});

describe('buildProfessionalDocument', () => {
  it('mostra nome, trabalho e botão + quando habilitados na seção', () => {
    registerSections();
    const doc = buildProfessionalDocument(data);
    const works = doc.sections.find((x) => x.id === 'works')!;
    Object.assign(works.content as object, { showPerson: true, showTitle: true, showPlus: true, columns: '3' });
    const out = html(doc);
    expect(out).toContain('Loiro Frio');
    expect(out).toContain('cb-plus');
    expect(out).toContain('data-cols="3"');
  });
  it('gera documento válido e renderiza os dados do cadastro', () => {
    registerSections();
    const doc = buildProfessionalDocument(data);
    expect(parsePageDocument(doc).ok).toBe(true);
    const out = html(doc);
    expect(out).toContain('Ana Maria<span>Souza.</span>');
    expect(out).toContain('Técnica e carreira.');
    expect(out).toContain('Expert / Colorista');
    expect(out).toContain('Segundo parágrafo.');
    expect(out).not.toContain('Loiro Frio'); // textos da galeria ocultos por padrão
    expect(out).toContain('data-cols="4"');
    expect(out).toContain('src="/site/v.mp4"');
    expect(out).toContain('ANA • ACADEMIA BEAUTY');
    expect(out).not.toContain('Lukas');
  });

  it('é determinístico e não altera o template base', () => {
    const before = JSON.stringify(buildProfessionalDocument(data));
    expect(JSON.stringify(buildProfessionalDocument(data))).toBe(before);
    expect(html(buildProfessionalDocument(data))).not.toContain('Lukas');
    expect(JSON.stringify(buildProfessionalDocument({ ...data, name: 'Outro Nome' }))).not.toBe(before);
  });

  it('omite seções e links de navegação sem conteúdo', () => {
    const out = html(buildProfessionalDocument({ ...data, works: [], videoSrc: '' }));
    expect(out).not.toContain('id="trabalhos"');
    expect(out).not.toContain('id="video"');
    expect(out).not.toContain('id="cursos"'); // sem catálogo de cursos (Fase 4)
    expect(out).not.toContain('href="#trabalhos"');
    expect(out).not.toContain('href="#cursos"');
  });

  it('escapa texto (React) e o schema de entrada barra marcação', () => {
    const evil = { ...data, name: 'Ana <img src=x onerror=alert(1)>' };
    expect(professionalDataSchema.safeParse(evil).success).toBe(false);
    // Mesmo que dado inválido chegue ao builder, o renderer valida o documento e recusa.
    expect(() => html(buildProfessionalDocument(evil as never))).toThrow();
  });
});

describe('buildHomeDocument', () => {
  const items: ShowcaseItem[] = [
    { slug: 'ana', name: 'Ana', cardPhotoSrc: '/site/a.png' },
    { slug: 'bia', name: 'Bia', cardPhotoSrc: '/site/b.png' },
  ];

  it('usa a vitrine recebida, na ordem, com links para /profissionais/[slug]', () => {
    const out = html(buildHomeDocument(items));
    expect(out.indexOf('Ana')).toBeLessThan(out.indexOf('Bia'));
    expect(out).toContain('href="/profissionais/ana"');
    // Só a vitrine é dinâmica; os cursos seguem estáticos até a Fase 4 (por isso o nome pode aparecer lá).
    const slider = out.slice(out.indexOf('id="professoresSlider"'), out.indexOf('id="sliderNextBtn"'));
    expect(slider).not.toContain('Cleber');
    expect(slider).not.toContain('Lukas');
  });

  it('vitrine vazia não renderiza a seção de profissionais e limita a 24', () => {
    expect(html(buildHomeDocument([]))).not.toContain('id="profissionais"');
    const many = Array.from({ length: 40 }, (_, i) => ({ slug: `p-${i}`, name: `P${i}`, cardPhotoSrc: '/site/x.png' }));
    expect(parsePageDocument(buildHomeDocument(many)).ok).toBe(true);
  });
});
