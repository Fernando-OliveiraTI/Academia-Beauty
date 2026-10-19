import type { ReactNode } from 'react';
import { parsePageDocument, type PageDocument } from '@academia/page-schema';
import { registerSections, sectionRegistry } from './registry';
import type { RenderContext } from './offer';
import type { Placement } from './section-entry';
import { TEMPLATES, type Regions } from './templates';

registerSections();

export class InvalidPageDocumentError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Documento de página inválido:\n${errors.join('\n')}`);
  }
}

/**
 * Valida o documento e renderiza só seções do registry. Nada fora dele é renderizado
 * e o conteúdo é sempre texto (React escapa), nunca HTML.
 */
export function PageRenderer({ document: input, ctx }: { document: unknown; ctx: RenderContext }): ReactNode {
  const parsed = parsePageDocument(input);
  if (!parsed.ok) throw new InvalidPageDocumentError(parsed.errors);
  const doc: PageDocument = parsed.document;

  const Shell = Object.hasOwn(TEMPLATES, doc.template.key) ? TEMPLATES[doc.template.key] : undefined;
  if (!Shell) throw new InvalidPageDocumentError([`template: ${doc.template.key} sem layout`]);

  const regions: Regions = { banner: [], main: [], contentinfo: [], overlay: [] };
  const seen = new Map<string, number>();
  for (const section of doc.sections) {
    // A n-ésima instância de um tipo repetível ganha ids de DOM sufixados (`faq--2`; o `--` evita colidir com ids como `faq-2`, item do acordeão): a primeira mantém os ids/âncoras do modelo.
    const n = (seen.get(section.type) ?? 0) + 1;
    seen.set(section.type, n);
    if (!section.visibility.enabled) continue;
    const entry = sectionRegistry.get(section.type);
    if (!entry) continue;
    const { Component } = entry;
    const node = <Component key={section.id} content={section.content as never} ctx={ctx} idSuffix={n > 1 ? `--${n}` : undefined} />;
    const background = section.settings.background;
    // Sem fundo escolhido o HTML é o mesmo de antes (sem invólucro). O invólucro não afeta o layout (`display: contents`).
    regions[entry.placement as Placement].push(background ? <div key={section.id} className="pg-bg" data-bg={background}>{node}</div> : node);
  }
  return <Shell regions={regions} ctx={ctx} />;
}
