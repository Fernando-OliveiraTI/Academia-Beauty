import type { PageDocument } from '@academia/page-schema';
import type { CourseCard, CourseData, HomeCourseCard, ProfessionalData, ShowcaseItem } from '@academia/contracts';
import { buildProfessionalDocument } from './professional/build';
import { buildCourseDocument, professionalCourseCards } from './course/build';
import { homeCourseItems, homeProfessionalItems } from './home/build';
import { homeOriginalTemplate } from './home/template';
import { checkoutSchema } from '@academia/section-schemas/course';

/**
 * Documento da página do profissional. Sem `document` (página nunca personalizada no editor) segue o
 * caminho derivado do cadastro. Com `document`, o que o editor gravou vale, exceto as partes dinâmicas
 * do catálogo, que são sempre reinjetadas: cursos publicados do profissional (e a visibilidade da seção
 * de cursos, que depende de haver cursos). Nada dinâmico fica congelado no JSON editado.
 */
export function resolveProfessionalDocument(input: {
  data: ProfessionalData;
  document?: PageDocument | null;
  courseCards?: readonly CourseCard[];
  /** Modelo da página (padrão: Original). Só vale quando a página ainda não foi personalizada no editor. */
  templateKey?: string;
}): PageDocument {
  const { data, document, courseCards = [], templateKey } = input;
  if (!document) return buildProfessionalDocument(data, { courseCards, templateKey });

  const doc = structuredClone(document);
  const cards = professionalCourseCards(courseCards, data.name);
  doc.sections = doc.sections.map((s) =>
    s.type === 'professional.courses'
      ? { ...s, visibility: { enabled: cards.length > 0 }, content: { ...s.content, cards } }
      : s
  );
  return doc;
}

/**
 * Documento da página do curso. Sem `document` segue o caminho derivado do cadastro. Com `document`, vale o
 * que o editor gravou; preço, parcelas e link de checkout nunca estão no documento (vêm de `ctx.offer`/`ctx.checkout`).
 */
export function resolveCourseDocument(input: {
  data: CourseData;
  professional: ProfessionalData;
  document?: PageDocument | null;
}): PageDocument {
  if (input.document) return withInstructorPhoto(withCheckoutDefaults(structuredClone(input.document)), input.professional);
  return buildCourseDocument({ data: input.data, professional: input.professional });
}

/** Documentos salvos sem retrato do instrutor usam o retrato do cadastro do profissional. */
function withInstructorPhoto(doc: PageDocument, pro: ProfessionalData): PageDocument {
  if (!pro.portraitSrc) return doc;
  doc.sections = doc.sections.map((s) => {
    if (s.type !== 'course.instructor') return s;
    const content = s.content as { photo?: { src?: string } };
    if (content.photo?.src) return s;
    return { ...s, content: { ...s.content, photo: { src: pro.portraitSrc, alt: `Retrato de ${pro.name}`.slice(0, 300) } } };
  });
  return doc;
}

/** Documentos salvos antes dos campos novos do checkout ganham os textos padrão (o editor mostra o que a página exibe). */
function withCheckoutDefaults(doc: PageDocument): PageDocument {
  doc.sections = doc.sections.map((s) => {
    if (s.type !== 'course.checkout') return s;
    const parsed = checkoutSchema.safeParse(s.content);
    return parsed.success ? { ...s, content: parsed.data as Record<string, unknown> } : s;
  });
  return doc;
}

/**
 * Documento da Home. Sem `document` (Home nunca personalizada) vale o template original. Com `document`, vale o que o
 * editor gravou, exceto as vitrines do catálogo, que são sempre reinjetadas: profissionais publicados e cursos
 * publicados da vitrine (cada seção só aparece se houver itens). Nada dinâmico fica congelado no JSON editado.
 */
export function resolveHomeDocument(input: {
  document?: PageDocument | null;
  professionals?: readonly ShowcaseItem[];
  courses?: readonly HomeCourseCard[];
}): PageDocument {
  const { document, professionals = [], courses = [] } = input;
  const doc = structuredClone(document ?? homeOriginalTemplate);
  const people = homeProfessionalItems(professionals);
  const cards = homeCourseItems(courses);
  doc.sections = doc.sections.map((s) => {
    if (s.type === 'home.professionals') return { ...s, visibility: { enabled: people.length > 0 }, content: { ...s.content, items: people } };
    if (s.type === 'home.courses') return { ...s, visibility: { enabled: cards.length > 0 }, content: { ...s.content, items: cards } };
    return s;
  });
  return doc;
}
