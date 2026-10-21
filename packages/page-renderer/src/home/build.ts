import type { PageDocument } from '@academia/page-schema';
import { COURSE_MODALITY_LABEL, type HomeCourseCard, type ShowcaseItem } from '@academia/contracts';
import { clip } from '../clip';
import { cardPriceTexts } from '../offer';
import { homeOriginalTemplate } from './template';
import type * as S from './schemas';

/** Limite do schema da seção; a API também limita a vitrine. */
export const HOME_SHOWCASE_MAX = 24;

/**
 * Home com a vitrine de profissionais vinda do cadastro publicado, na ordem recebida.
 * O restante da página segue o template "Home Original" (cursos passam a ser dinâmicos na Fase 4).
 */
export function buildHomeDocument(showcase: readonly ShowcaseItem[]): PageDocument {
  const doc = structuredClone(homeOriginalTemplate);
  const section = doc.sections.find((s) => s.id === 'professionals');
  if (!section) throw new Error('Template da Home sem a seção professionals');
  const content = section.content as S.ProfessionalsContent;
  content.items = showcase.slice(0, HOME_SHOWCASE_MAX).map((p) => ({
    name: clip(p.name, 60),
    photo: p.cardPhotoSrc,
    href: `/profissionais/${p.slug}`,
  }));
  return doc;
}

/** Itens da seção de profissionais: vitrine publicada, na ordem recebida, cortada nos limites do schema. */
export function homeProfessionalItems(showcase: readonly ShowcaseItem[]): S.ProfessionalsContent['items'] {
  return showcase.slice(0, HOME_SHOWCASE_MAX).map((p) => ({
    name: clip(p.name, 60),
    photo: p.cardPhotoSrc,
    href: `/profissionais/${p.slug}`,
  }));
}

/** Limite do schema da seção de cursos da Home. */
export const HOME_COURSES_MAX = 12;

/** Cartões de curso da Home a partir dos cursos publicados na vitrine (cada um leva à sua página). */
export function homeCourseItems(courses: readonly HomeCourseCard[]): S.CoursesContent['items'] {
  return courses.slice(0, HOME_COURSES_MAX).map((c) => {
    const price = cardPriceTexts(c);
    return {
      image: { src: c.coverSrc, alt: clip(c.coverAlt || c.title, 300) },
      tags: [
        ...(c.featured ? [{ label: 'destaques', gold: true }] : []),
        { label: clip(COURSE_MODALITY_LABEL[c.modality].toLowerCase(), 30) },
        ...(price.badge ? [{ label: price.badge, gold: true }] : []),
      ],
      person: clip(c.person, 60),
      title: clip(c.title, 120),
      plusLabel: clip(`Ver curso ${c.title}`, 120),
      href: `/cursos/${c.slug}`,
      ...(price.price ? { price: price.price } : {}),
      ...(price.priceOld ? { priceOld: price.priceOld } : {}),
    };
  });
}
