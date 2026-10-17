import type { ComponentType, ReactNode } from 'react';
import { CourseEffects } from './course/Effects';
import { IconSprite } from './course/Icon';
import { CourseProvider } from './course/state';
import { HomeEffects } from './home/Effects';
import { ProfessionalEffects } from './professional/Effects';
import type { RenderContext } from './offer';
import type { Placement } from './section-entry';

export type Regions = Record<Placement, ReactNode[]>;

function CourseShell({ regions, ctx }: { regions: Regions; ctx: RenderContext }) {
  return (
    <div className="pg-course">
      <IconSprite />
      <a className="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
      <CourseProvider checkout={ctx.checkout}>
        <CourseEffects />
        <div className="scroll-progress" aria-hidden="true" />
        {regions.banner}
        <main id="conteudo-principal">{regions.main}</main>
        {regions.contentinfo}
        {regions.overlay}
      </CourseProvider>
    </div>
  );
}

function ProfessionalShell({ regions }: { regions: Regions }) {
  return (
    <div className="pg-pro">
      <ProfessionalEffects />
      {regions.banner}
      <main>{regions.main}</main>
      {regions.contentinfo}
      {regions.overlay}
    </div>
  );
}

function HomeShell({ regions }: { regions: Regions }) {
  return (
    <div className="pg-home">
      <HomeEffects />
      <div className="cb-shell">
        {regions.banner}
        <main>{regions.main}</main>
        {regions.contentinfo}
        {regions.overlay}
      </div>
    </div>
  );
}

/** Layout (landmarks, wrapper de escopo CSS e efeitos de página) de cada template. */
export const TEMPLATES: Record<string, ComponentType<{ regions: Regions; ctx: RenderContext }>> = {
  'course-original': CourseShell,
  'professional-original': ProfessionalShell,
  'home-original': HomeShell,
};
