import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_BIO,
  PLACEHOLDER_MEDIA,
  courseFieldsFromDocument,
  locateField,
  parseYears,
  professionalFieldsFromDocument,
  syncDataFromDocument,
} from './index';

const doc = (...sections: Array<{ type: string; enabled?: boolean; content: Record<string, unknown> }>) => ({
  sections: sections.map((s, i) => ({ id: `s${i}`, type: s.type, visibility: { enabled: s.enabled ?? true }, settings: {}, content: s.content })),
});

describe('parseYears', () => {
  it('lê o número do começo do texto do selo', () => {
    expect(parseYears('15')).toBe(15);
    expect(parseYears(' 8 anos')).toBe(8);
    expect(parseYears('20+')).toBe(20);
    expect(parseYears('0')).toBe(0);
  });
  it('sem número, número grande demais ou mais de dois dígitos → null', () => {
    expect(parseYears('')).toBeNull();
    expect(parseYears('quinze')).toBeNull();
    expect(parseYears('81')).toBeNull();
    expect(parseYears('150')).toBeNull();
    expect(parseYears(undefined)).toBeNull();
  });
});

describe('professionalFieldsFromDocument', () => {
  it('documento nulo não copia nada (página nunca editada segue o cadastro)', () => {
    expect(professionalFieldsFromDocument(null)).toEqual({});
  });

  it('copia frase, anos, retrato, trajetória e Instagram das seções', () => {
    const out = professionalFieldsFromDocument(doc(
      { type: 'professional.hero', content: { sub: ' Cor e corte ', hud: { accent: '12' }, portrait: { src: '/site/p.jpg', alt: 'x' } } },
      { type: 'professional.bio', content: { paragraphs: ['Um', ' ', 'Dois'], instagram: { handle: '@ana', followers: '10 mil', href: 'https://instagram.com/ana' } } },
    ));
    expect(out).toEqual({
      tagline: 'Cor e corte', experienceYears: 12, portraitSrc: '/site/p.jpg', bio: ['Um', 'Dois'],
      instagramHandle: '@ana', instagramFollowers: '10 mil', instagramUrl: 'https://instagram.com/ana',
    });
  });

  it('marcadores provisórios do rascunho valem como vazio (a publicação aponta a pendência)', () => {
    const out = professionalFieldsFromDocument(doc(
      { type: 'professional.hero', content: { sub: '', hud: { accent: '' }, portrait: { src: PLACEHOLDER_MEDIA, alt: '' } } },
      { type: 'professional.bio', content: { paragraphs: [PLACEHOLDER_BIO], instagram: { handle: '', followers: '', href: '#' } } },
    ));
    expect(out).toMatchObject({ tagline: '', experienceYears: null, portraitSrc: '', bio: [], instagramUrl: '' });
  });

  it('valor que o cadastro não aceita vira vazio, em vez de manter o antigo', () => {
    const out = professionalFieldsFromDocument(doc(
      { type: 'professional.hero', content: { sub: '<b>oi</b>', hud: { accent: '5' }, portrait: { src: 'https://outro.host/x.jpg', alt: '' } } },
    ));
    expect(out.tagline).toBe('');
    expect(out.portraitSrc).toBe('');
    expect(out.experienceYears).toBe(5);
  });
});

describe('courseFieldsFromDocument', () => {
  const full = doc(
    { type: 'course.hero', content: { lead: 'Aprenda', image: { src: '/media/0123456789abcdef0123456789abcdef', alt: 'Capa' } } },
    { type: 'course.benefits', content: { cards: [{ icon: 'gem', title: 'Técnica', text: 'Passo a passo' }, { icon: 'star', title: '', text: 'sem título' }] } },
    { type: 'course.curriculum', content: { modules: [{ title: 'M1', text: 'Intro', bullets: ['a', ' '] }] } },
    { type: 'course.deliverables', content: { items: [{ title: 'Certificado', text: 'Digital' }] } },
  );

  it('copia descrição, capa e listas das seções visíveis, descartando itens incompletos', () => {
    expect(courseFieldsFromDocument(full)).toEqual({
      lead: 'Aprenda', coverSrc: '/media/0123456789abcdef0123456789abcdef', coverAlt: 'Capa',
      benefits: [{ title: 'Técnica', text: 'Passo a passo' }],
      modules: [{ title: 'M1', text: 'Intro', bullets: ['a'] }],
      deliverables: [{ title: 'Certificado', text: 'Digital' }],
    });
  });

  it('seção oculta não conta: guarda o conteúdo de exemplo do template', () => {
    const hidden = doc(
      { type: 'course.benefits', enabled: false, content: { cards: [{ icon: 'gem', title: 'Exemplo', text: 'Exemplo' }] } },
      { type: 'course.deliverables', enabled: false, content: { items: [{ title: 'Exemplo', text: 'Exemplo' }] } },
    );
    expect(courseFieldsFromDocument(hidden)).toEqual({ benefits: [], deliverables: [] });
  });

  it('corta no limite do cadastro', () => {
    const many = doc({ type: 'course.benefits', content: { cards: Array.from({ length: 6 }, (_, i) => ({ icon: 'gem', title: `B${i}`, text: 't' })) } });
    expect(courseFieldsFromDocument(many).benefits).toHaveLength(4);
  });

  it('seção ausente não altera o campo', () => {
    expect(courseFieldsFromDocument(doc({ type: 'course.hero', content: { lead: 'x', image: { src: PLACEHOLDER_MEDIA, alt: '' } } }))).toEqual({ lead: 'x', coverSrc: '', coverAlt: '' });
  });
});

describe('locateField', () => {
  it('pendência de conteúdo aponta a seção; o resto vai para Configurações', () => {
    expect(locateField('professional', 'experienceYears')).toMatchObject({ section: 'professional.hero', path: 'hud.accent' });
    expect(locateField('professional', 'cardPhotoSrc')).toEqual({ settings: true });
    expect(locateField('course', 'deliverables')).toMatchObject({ section: 'course.deliverables', path: 'items' });
    expect(locateField('course', 'checkoutUrl')).toEqual({ settings: true });
  });
});

describe('syncDataFromDocument', () => {
  const base = { name: 'Ana', specialty: 'Cor', tagline: 'Antiga', experienceYears: null, bio: [] as string[] };
  const page = doc(
    { type: 'professional.hero', content: { sub: 'Nova', hud: { accent: '9' }, portrait: { src: PLACEHOLDER_MEDIA, alt: '' } } },
  );

  it('aplica os campos da página e preserva o resto do cadastro', () => {
    const out = syncDataFromDocument('professional', base, page);
    expect(out.changed).toBe(true);
    expect(out.data).toMatchObject({ name: 'Ana', specialty: 'Cor', tagline: 'Nova', experienceYears: 9, portraitSrc: '' });
  });

  it('sem diferença real (inclusive chaves padrão ausentes) não marca mudança', () => {
    const once = syncDataFromDocument('professional', base, page).data;
    expect(syncDataFromDocument('professional', once, page)).toEqual({ data: once, changed: false });
    expect(syncDataFromDocument('professional', base, null)).toEqual({ data: base, changed: false });
  });
});

describe('item provisório das listas do curso', () => {
  it('«Preencha este item» vale como lista vazia (a pendência continua)', async () => {
    const { PLACEHOLDER_ITEM } = await import('./index');
    const out = courseFieldsFromDocument(doc(
      { type: 'course.deliverables', content: { items: [{ ...PLACEHOLDER_ITEM }] } },
      { type: 'course.benefits', content: { cards: [{ icon: 'check', ...PLACEHOLDER_ITEM }, { icon: 'gem', title: 'Real', text: 'Escrito.' }] } },
    ));
    expect(out.deliverables).toEqual([]);
    expect(out.benefits).toEqual([{ title: 'Real', text: 'Escrito.' }]);
  });
});
