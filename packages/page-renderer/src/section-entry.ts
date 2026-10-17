import type { ComponentType } from 'react';
import type { ZodType } from 'zod';
import type { RenderContext } from './offer';

/** Região da página em que a seção é renderizada (landmarks do template). */
export type Placement = 'banner' | 'main' | 'contentinfo' | 'overlay';

export type SectionEntry = {
  type: string;
  schema: ZodType;
  placement: Placement;
  Component: ComponentType<{ content: never; ctx: RenderContext }>;
};

export const entry = <C,>(
  type: string, schema: ZodType<C>, placement: Placement, Component: ComponentType<{ content: C; ctx: RenderContext }>,
): SectionEntry => ({ type, schema, placement, Component: Component as SectionEntry['Component'] });
