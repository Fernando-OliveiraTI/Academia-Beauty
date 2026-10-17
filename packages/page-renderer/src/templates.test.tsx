import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PROFESSIONAL_TEMPLATE_KEYS as CONTRACT_KEYS } from '@academia/contracts';
import { PROFESSIONAL_TEMPLATES, validatePageDocument } from '@academia/section-schemas';
import { NO_OFFER, PageRenderer, buildProfessionalDocument, resolveProfessionalDocument } from './index';

const data = {
  name: 'Ana Souza', specialty: 'Hair', tagline: 'Técnica.', experienceYears: 10, instagramHandle: '@ana', instagramFollowers: '53,6 Mil seguidores',
  instagramUrl: 'https://instagram.com/ana', portraitSrc: '/site/profissional/lukas_perfil.png', cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: ['Dez anos.'], works: [{ imageSrc: '/site/profissional/trabLukas01.png', alt: 'Trabalho', title: 'Morena', tags: ['mechas'] }], videoSrc: '/site/profissional/video.mp4',
} as never;
const card = { slug: 'curso-um', title: 'Curso Um', coverSrc: '/site/curso/produto-morena-iluminada.svg', coverAlt: 'Capa', discountPct: 20 };
const ctx = { offer: NO_OFFER, year: 2026 };
const ids = (doc: { sections: { id: string; visibility: { enabled: boolean } }[] }) => doc.sections.filter((s) => s.visibility.enabled).map((s) => s.id);

describe('modelos de página do profissional', () => {
  it('as chaves do contrato e do catálogo de seções são as mesmas', () => {
    expect([...CONTRACT_KEYS]).toEqual(PROFESSIONAL_TEMPLATES.map((t) => t.key));
  });

  it.each(CONTRACT_KEYS)('%s: gera documento válido, renderiza com o tema e mantém conteúdo do cadastro', (key) => {
    const doc = buildProfessionalDocument(data, { courseCards: [card], templateKey: key });
    const result = validatePageDocument(doc);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(doc.template.key).toBe(key);
    const html = renderToStaticMarkup(<PageRenderer document={doc} ctx={ctx} />);
    expect(html).toContain(`data-tpl="${key}"`);
    expect(html).toContain('Ana');
    expect(html).toContain('/cursos/curso-um');
  });

  it('cada modelo tem a composição prometida', () => {
    const order = (key: string) => ids(buildProfessionalDocument(data, { courseCards: [card], templateKey: key }));
    expect(order('professional-original')).toEqual(['nav', 'hero', 'bio', 'works', 'video', 'courses', 'footer']);
    expect(order('professional-authority')).toEqual(['nav', 'hero', 'stats', 'bio', 'works', 'video', 'courses', 'footer']);
    expect(order('professional-video').slice(0, 3)).toEqual(['nav', 'hero', 'video']);
    expect(order('professional-conversion').slice(0, 4)).toEqual(['nav', 'hero', 'courses', 'cta']);
    expect(order('professional-immersive').slice(0, 3)).toEqual(['nav', 'hero', 'works']);
    expect(order('professional-premium')).toEqual(['nav', 'hero', 'bio', 'stats', 'works', 'cta', 'courses', 'footer']);
  });

  it('o Original continua idêntico ao que o caminho antigo gerava (sem seções novas)', () => {
    const legacy = buildProfessionalDocument(data, { courseCards: [card] });
    const original = buildProfessionalDocument(data, { courseCards: [card], templateKey: 'professional-original' });
    expect(original).toEqual(legacy);
    expect(legacy.sections.map((s) => s.type)).not.toContain('professional.stats');
  });

  it('números vêm só do cadastro: seguidores separam valor e rótulo; item sem dado não aparece', () => {
    const doc = buildProfessionalDocument(data, { courseCards: [card], templateKey: 'professional-authority' });
    const stats = doc.sections.find((s) => s.id === 'stats')!;
    expect(stats.content.items).toEqual([
      { value: '10', label: 'anos de experiência' },
      { value: '53,6 Mil', label: 'seguidores' },
      { value: '1', label: 'trabalho em destaque' },
      { value: '1', label: 'curso publicado' },
    ]);
    const sparse = buildProfessionalDocument({ ...(data as object), experienceYears: null, instagramFollowers: '', works: [] } as never, { templateKey: 'professional-authority' });
    const only = sparse.sections.find((s) => s.id === 'stats')!;
    expect(only.visibility.enabled).toBe(false); // sem nenhum dado, a seção some em vez de mostrar números inventados
    expect(validatePageDocument(sparse).ok).toBe(true);
  });

  it('a chamada leva aos cursos quando existem; sem cursos, ao Instagram; sem nada, some', () => {
    const cta = (doc: ReturnType<typeof buildProfessionalDocument>) => doc.sections.find((s) => s.id === 'cta')!;
    const withCourses = cta(buildProfessionalDocument(data, { courseCards: [card], templateKey: 'professional-conversion' }));
    expect(withCourses.content.cta).toEqual({ label: 'Ver cursos', href: '#cursos' });
    const noCourses = cta(buildProfessionalDocument(data, { templateKey: 'professional-conversion' }));
    expect(noCourses.content.cta).toEqual({ label: 'Seguir no Instagram', href: 'https://instagram.com/ana' });
    const nothing = cta(buildProfessionalDocument({ ...(data as object), instagramUrl: '' } as never, { templateKey: 'professional-conversion' }));
    expect(nothing.visibility.enabled).toBe(false);
  });

  it('nomes e textos longos nunca invalidam o documento de nenhum modelo', () => {
    const long = { ...(data as object), name: 'N'.repeat(80), instagramFollowers: '9'.repeat(40), tagline: 'T'.repeat(200) } as never;
    for (const key of CONTRACT_KEYS) {
      const result = validatePageDocument(buildProfessionalDocument(long, { courseCards: [card], templateKey: key }));
      expect(result.ok, `${key}: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it('modelo desconhecido é recusado', () => {
    expect(() => buildProfessionalDocument(data, { templateKey: 'professional-xyz' })).toThrow(/desconhecido/);
  });

  it('com documento do editor, o modelo do documento vale e os cursos continuam do catálogo', () => {
    const base = buildProfessionalDocument(data, { courseCards: [], templateKey: 'professional-premium' });
    const resolved = resolveProfessionalDocument({ data, document: base, courseCards: [card], templateKey: 'professional-original' });
    expect(resolved.template.key).toBe('professional-premium');
    expect(resolved.sections.find((s) => s.type === 'professional.courses')?.visibility.enabled).toBe(true);
    expect(resolveProfessionalDocument({ data, courseCards: [card], templateKey: 'professional-video' }).template.key).toBe('professional-video');
  });

  it('seção Chamada com link externo abre com rel noopener', () => {
    const doc = buildProfessionalDocument(data, { templateKey: 'professional-premium' });
    const html = renderToStaticMarkup(<PageRenderer document={doc} ctx={ctx} />);
    expect(html).toMatch(/class="cta-button"[^>]*target="_blank"[^>]*rel="noopener"/);
  });
});
