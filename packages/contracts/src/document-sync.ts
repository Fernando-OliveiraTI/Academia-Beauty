import { z } from 'zod';
import { professionalDataSchema, type ProfessionalData } from './professional.js';
import { courseDataSchema, type CourseData } from './course.js';

/**
 * Editor visual como fonte do conteúdo (editor único). O que aparece na página é editado nas seções do documento;
 * este módulo copia esses valores para o cadastro (`data`), que continua alimentando SEO, cartões, vitrine e a
 * regra de publicação. Funções puras, sem dependência de React: usadas pela API (ao salvar e ao publicar) e pelo editor.
 *
 * Só os campos listados aqui vêm do documento; o restante do cadastro (nome, endereço, especialidade, foto do cartão,
 * público, garantia…) é editado no painel "Configurações" do editor e nunca é sobrescrito pela página.
 */

/** Imagem provisória dos rascunhos (o editor abre com ela até a troca); no cadastro vale como "sem imagem". */
export const PLACEHOLDER_MEDIA = '/site/placeholder.svg';
/** Parágrafo provisório da trajetória de um rascunho novo; no cadastro vale como "sem trajetória". */
export const PLACEHOLDER_BIO = 'Escreva aqui a trajetória do profissional.';
/**
 * Item provisório das listas do curso (benefícios, módulos, entregáveis) sem conteúdo: a seção precisa de ao menos
 * um item, e o exemplo do template (texto de outro curso) não pode parecer preenchido. Vale como "lista vazia".
 */
export const PLACEHOLDER_ITEM = { title: 'Preencha este item', text: 'Troque este texto pelo conteúdo real do curso.' } as const;
const notPlaceholder = (item: { title: string }) => item.title !== PLACEHOLDER_ITEM.title;

type Section = { type: string; visibility?: { enabled?: boolean }; content?: unknown };

const sectionsOf = (doc: unknown): Section[] => {
  const sections = (doc as { sections?: unknown } | null)?.sections;
  return Array.isArray(sections) ? (sections.filter((s) => s && typeof s === 'object') as Section[]) : [];
};
/** Primeira seção do tipo (as seções que alimentam o cadastro são únicas por página). */
const first = (doc: unknown, type: string) => sectionsOf(doc).find((s) => s.type === type);
const enabled = (s: Section | undefined) => Boolean(s && s.visibility?.enabled !== false);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Valor validado pelo schema do campo do cadastro; inválido vira o valor vazio (a publicação aponta a pendência). */
function field<T>(schema: z.ZodType<T>, value: unknown, empty: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : empty;
}

/** Itens de lista: mantém só os válidos para o cadastro e corta no limite do campo (o schema do campo decide). */
function items<T>(schema: z.ZodDefault<z.ZodArray<z.ZodType<T>>>, values: unknown[]): T[] {
  const element = schema.unwrap().element;
  const out: T[] = [];
  for (const v of values) {
    const parsed = element.safeParse(v);
    if (parsed.success) out.push(parsed.data);
  }
  while (out.length && !schema.safeParse(out).success) out.pop();
  return out;
}

const media = (v: unknown) => {
  const src = str(v);
  return src === PLACEHOLDER_MEDIA ? '' : src;
};

/** "15", "15 anos", "15+" → 15. Sem número no começo → null (pendência "anos de experiência"). */
export function parseYears(value: unknown): number | null {
  const m = /^(\d{1,2})(?!\d)/.exec(str(value));
  if (!m) return null;
  const n = Number(m[1]);
  return n <= 80 ? n : null;
}

const P = professionalDataSchema.shape;
const C = courseDataSchema.shape;

export type ProfessionalPageFields = Pick<
  ProfessionalData,
  'tagline' | 'experienceYears' | 'portraitSrc' | 'bio' | 'instagramHandle' | 'instagramFollowers' | 'instagramUrl' | 'works' | 'videoSrc'
>;

/** Campos do cadastro do profissional que vêm da página. Documento nulo (página nunca editada) → nada a copiar. */
export function professionalFieldsFromDocument(doc: unknown): Partial<ProfessionalPageFields> {
  if (!doc) return {};
  const out: Partial<ProfessionalPageFields> = {};
  const hero = first(doc, 'professional.hero');
  if (hero) {
    const c = obj(hero.content);
    out.tagline = field(P.tagline, str(c.sub), '');
    out.experienceYears = parseYears(obj(c.hud).accent);
    out.portraitSrc = field(P.portraitSrc, media(obj(c.portrait).src), '');
  }
  const bio = first(doc, 'professional.bio');
  if (bio) {
    const c = obj(bio.content);
    const paragraphs = enabled(bio) ? list(c.paragraphs).map(str).filter((p) => p && p !== PLACEHOLDER_BIO) : [];
    out.bio = items(P.bio, paragraphs);
    const ig = obj(c.instagram);
    out.instagramHandle = field(P.instagramHandle, str(ig.handle), '');
    out.instagramFollowers = field(P.instagramFollowers, str(ig.followers), '');
    const href = str(ig.href);
    out.instagramUrl = field(P.instagramUrl, href === '#' ? '' : href, '');
  }
  // Trabalhos e vídeo: só contam com a seção visível (oculta, ela guarda o exemplo do template).
  const works = first(doc, 'professional.works');
  if (works) {
    out.works = enabled(works)
      ? items(P.works, list(obj(works.content).items).map((w) => ({
        imageSrc: media(obj(obj(w).image).src),
        alt: str(obj(obj(w).image).alt),
        title: str(obj(w).title),
        tags: list(obj(w).tags).map((t) => str(obj(t).label)).filter(Boolean),
      })))
      : [];
  }
  const video = first(doc, 'professional.video');
  if (video) out.videoSrc = enabled(video) ? field(P.videoSrc, media(obj(obj(video.content).video).src), '') : '';
  return out;
}

export type CoursePageFields = Pick<CourseData, 'lead' | 'coverSrc' | 'coverAlt' | 'benefits' | 'modules' | 'deliverables'>;

/**
 * Campos do cadastro do curso que vêm da página. Listas só contam se a seção está visível: seção oculta guarda o
 * conteúdo de exemplo do template, que não pode valer como conteúdo do curso.
 */
export function courseFieldsFromDocument(doc: unknown): Partial<CoursePageFields> {
  if (!doc) return {};
  const out: Partial<CoursePageFields> = {};
  const hero = first(doc, 'course.hero');
  if (hero) {
    const c = obj(hero.content);
    out.lead = field(C.lead, str(c.lead), '');
    out.coverSrc = field(C.coverSrc, media(obj(c.image).src), '');
    out.coverAlt = field(C.coverAlt, str(obj(c.image).alt), '');
  }
  const benefits = first(doc, 'course.benefits');
  if (benefits) out.benefits = enabled(benefits) ? items(C.benefits, list(obj(benefits.content).cards).map((b) => ({ title: str(obj(b).title), text: str(obj(b).text) })).filter(notPlaceholder)) : [];
  const curriculum = first(doc, 'course.curriculum');
  if (curriculum) {
    out.modules = enabled(curriculum)
      ? items(C.modules, list(obj(curriculum.content).modules).map((m) => ({ title: str(obj(m).title), text: str(obj(m).text), bullets: list(obj(m).bullets).map(str).filter(Boolean) })).filter(notPlaceholder))
      : [];
  }
  const deliverables = first(doc, 'course.deliverables');
  if (deliverables) out.deliverables = enabled(deliverables) ? items(C.deliverables, list(obj(deliverables.content).items).map((d) => ({ title: str(obj(d).title), text: str(obj(d).text) })).filter(notPlaceholder)) : [];
  return out;
}

/** JSON com chaves ordenadas (o MySQL reordena chaves de colunas JSON): compara cadastros sem falso "mudou". */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}

/**
 * Cadastro com os campos da página aplicados. `changed` = algo mudou de fato (só então a revisão do cadastro sobe).
 * Se o resultado não passar no schema do cadastro (não deveria: cada campo já é validado), devolve o original.
 */
export function syncDataFromDocument<T extends Record<string, unknown>>(
  kind: 'professional' | 'course',
  data: T,
  document: unknown
): { data: T; changed: boolean } {
  const fields = kind === 'professional' ? professionalFieldsFromDocument(document) : courseFieldsFromDocument(document);
  if (Object.keys(fields).length === 0) return { data, changed: false };
  const schema = kind === 'professional' ? professionalDataSchema : courseDataSchema;
  const parsed = schema.safeParse({ ...data, ...fields });
  if (!parsed.success) return { data, changed: false };
  const next = parsed.data as unknown as T;
  // Compara com o cadastro normalizado: chaves com valor padrão ausentes em linhas antigas não contam como mudança.
  const before = schema.safeParse(data);
  const same = canonicalJson(next) === canonicalJson(before.success ? before.data : data);
  return same ? { data, changed: false } : { data: next, changed: true };
}

/**
 * Onde cada pendência de publicação se resolve no editor: numa seção da página (tipo + caminho do campo no
 * formulário da seção) ou no painel "Configurações". Campos fora da tabela também vão para Configurações.
 */
export type FieldLocation =
  | { section: string; path: string | null; /** Qual campo do formulário da seção preencher (os rótulos são genéricos). */ hint: string }
  | { settings: true };

export const PROFESSIONAL_FIELD_LOCATION: Record<string, FieldLocation> = {
  tagline: { section: 'professional.hero', path: 'sub', hint: 'Escreva a frase de apresentação em «Subtítulo».' },
  experienceYears: { section: 'professional.hero', path: 'hud.accent', hint: 'Em «Painel (HUD)», escreva só o número em «Destaque» (ex.: 15) e «anos» em «Valor».' },
  portraitSrc: { section: 'professional.hero', path: 'portrait.src', hint: 'Troque a imagem provisória em «Retrato».' },
  bio: { section: 'professional.bio', path: 'paragraphs', hint: 'Escreva ao menos um parágrafo em «Parágrafos».' },
  instagramHandle: { section: 'professional.bio', path: 'instagram.handle', hint: 'Em «Instagram», preencha «Perfil» (ex.: @usuario).' },
  instagramUrl: { section: 'professional.bio', path: 'instagram.href', hint: 'Em «Instagram», preencha «Perfil» e o «Link» completo (https://instagram.com/…).' },
};

export const COURSE_FIELD_LOCATION: Record<string, FieldLocation> = {
  lead: { section: 'course.hero', path: 'lead', hint: 'Escreva a descrição do curso em «Chamada».' },
  coverSrc: { section: 'course.hero', path: 'image.src', hint: 'Troque a imagem provisória em «Imagem».' },
  coverAlt: { section: 'course.hero', path: 'image.alt', hint: 'Descreva a capa em «Imagem › Texto alternativo».' },
  benefits: { section: 'course.benefits', path: 'cards', hint: 'Troque «Preencha este item» pelo título e texto de ao menos um benefício.' },
  modules: { section: 'course.curriculum', path: 'modules', hint: 'Troque «Preencha este item» pelo título de ao menos um módulo.' },
  deliverables: { section: 'course.deliverables', path: 'items', hint: 'Troque «Preencha este item» pelo título e texto de ao menos um item.' },
};

export function locateField(kind: 'professional' | 'course', fieldName: string): FieldLocation {
  const table = kind === 'professional' ? PROFESSIONAL_FIELD_LOCATION : COURSE_FIELD_LOCATION;
  return table[fieldName] ?? { settings: true };
}
