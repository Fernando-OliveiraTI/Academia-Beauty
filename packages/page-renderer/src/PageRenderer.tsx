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
  for (const section of doc.sections) {
    if (!section.visibility.enabled) continue;
    const entry = sectionRegistry.get(section.type);
    if (!entry) continue;
    const { Component } = entry;
    regions[entry.placement as Placement].push(<Component key={section.id} content={section.content as never} ctx={ctx} />);
  }
  return <Shell regions={regions} ctx={ctx} />;
}
