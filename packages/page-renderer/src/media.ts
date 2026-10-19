import { mediaIdOf } from '@academia/page-schema';

/**
 * Imagem da biblioteca (`/media/<id>`) ganha `?w=<largura>`: a API serve o menor derivado que cobre essa
 * largura (um cartão de 96 px não baixa a foto de 3000 px). Caminhos `/site/...` e URLs de CDN ficam como estão.
 */
/** Imagem provisória de rascunhos ainda sem arquivo (o editor abre com ela até a troca). */
export const PLACEHOLDER_IMAGE = '/site/placeholder.svg';

export function mediaSrc(src: string, width: number): string {
  const id = mediaIdOf(src);
  return id ? `/media/${id}?w=${Math.round(width)}` : src;
}
