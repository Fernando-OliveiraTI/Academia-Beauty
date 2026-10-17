import type { PageDocument } from '@academia/page-schema';
import type { ShowcaseItem } from '@academia/contracts';
import { clip } from '../clip';
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
