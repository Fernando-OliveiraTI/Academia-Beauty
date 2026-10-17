import type { PageDocument } from '@academia/page-schema';
import type { CourseCard, CourseData, ProfessionalData } from '@academia/contracts';
import { buildProfessionalDocument } from './professional/build';
import { buildCourseDocument, professionalCourseCards } from './course/build';

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
}): PageDocument {
  const { data, document, courseCards = [] } = input;
  if (!document) return buildProfessionalDocument(data, { courseCards });

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
  if (input.document) return structuredClone(input.document);
  return buildCourseDocument({ data: input.data, professional: input.professional });
}
