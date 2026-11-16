import { describe, expect, it } from 'vitest';
import {
  PROFESSIONAL_TEMPLATE_KEYS,
  courseDataSchema,
  courseFieldsFromDocument,
  courseReadiness,
  professionalDataSchema,
  professionalFieldsFromDocument,
  publishReadiness,
} from '@academia/contracts';
import { buildCourseDocument, buildProfessionalDocument, courseOriginalTemplate, withoutTemplateSamples } from './index';

/**
 * Editor único: a página semeada do cadastro devolve ao cadastro exatamente os mesmos valores. Sem isso, a primeira
 * gravação no editor alteraria (ou apagaria) dados que o usuário nunca tocou.
 */
const pro = professionalDataSchema.parse({
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
const emptyPro = professionalDataSchema.parse({ name: 'Novo profissional', specialty: 'Especialidade' });

const course = courseDataSchema.parse({
  title: 'Morena Iluminada',
  lead: 'Do diagnóstico ao acabamento.',
  audience: 'Coloristas',
  coverSrc: '/site/capa.png',
  coverAlt: 'Mecha morena iluminada',
  benefits: [{ title: 'Técnica', text: 'Passo a passo.' }],
  modules: [{ title: 'Diagnóstico', text: 'Como avaliar.', bullets: ['Fio', 'Base'] }, { title: 'Aplicação', text: '', bullets: [] }],
  deliverables: [{ title: 'Certificado', text: 'Digital.' }],
});
const emptyCourse = courseDataSchema.parse({ title: 'Novo curso' });

describe('documento → cadastro (ida e volta)', () => {
  it.each(PROFESSIONAL_TEMPLATE_KEYS)('profissional completo, modelo %s', (templateKey) => {
    const fields = professionalFieldsFromDocument(buildProfessionalDocument(pro, { templateKey }));
    expect({ ...pro, ...fields }).toEqual(pro);
  });

  it('profissional vazio continua com as mesmas pendências', () => {
    const fields = professionalFieldsFromDocument(buildProfessionalDocument(emptyPro));
    const merged = professionalDataSchema.parse({ ...emptyPro, ...fields });
    expect(merged).toEqual(emptyPro);
    expect(publishReadiness(merged)).toEqual(publishReadiness(emptyPro));
  });

  it('curso completo', () => {
    const fields = courseFieldsFromDocument(buildCourseDocument({ data: course, professional: pro }));
    expect({ ...course, ...fields }).toEqual(course);
  });

  it('curso vazio continua com as mesmas pendências (seções ocultas com exemplo do template não contam)', () => {
    const fields = courseFieldsFromDocument(buildCourseDocument({ data: emptyCourse, professional: pro }));
    const merged = courseDataSchema.parse({ ...emptyCourse, ...fields });
    expect(merged).toEqual(emptyCourse);
    expect(courseReadiness(merged)).toEqual(courseReadiness(emptyCourse));
  });
});

describe('exemplo do template nas listas do curso', () => {
  const sample = (type: string) => courseOriginalTemplate.sections.find((s) => s.type === type)!.content as Record<string, unknown>;

  it('curso sem conteúdo não carrega o texto de outro curso nas seções ocultas', () => {
    const page = buildCourseDocument({ data: emptyCourse, professional: pro });
    const text = JSON.stringify(page.sections.filter((s) => ['course.benefits', 'course.curriculum', 'course.deliverables'].includes(s.type)));
    expect(text).not.toContain('Lukas Campos');
    expect(text).not.toContain('Mais brilho na cor');
    expect(text).toContain('Preencha este item');
  });

  it('mostrar uma seção antiga com o exemplo troca os itens pelo provisório; conteúdo real fica', () => {
    expect((withoutTemplateSamples('course.deliverables', sample('course.deliverables'))!.items as unknown[])).toHaveLength(1);
    expect(withoutTemplateSamples('course.benefits', sample('course.benefits'))!.cards).toEqual([{ icon: 'check', title: 'Preencha este item', text: 'Troque este texto pelo conteúdo real do curso.' }]);
    expect(withoutTemplateSamples('course.deliverables', { items: [{ title: 'Certificado', text: 'Digital.' }] })).toBeNull();
    expect(withoutTemplateSamples('course.hero', { lead: 'x' })).toBeNull();
  });
});

