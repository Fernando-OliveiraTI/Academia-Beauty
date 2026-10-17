import type { ComponentType, ReactNode } from 'react';
import { PROFESSIONAL_TEMPLATE_KEYS } from '@academia/section-schemas';
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

function ProfessionalShell({ regions, tpl }: { regions: Regions; tpl: string }) {
  return (
    // `data-tpl` liga o tema do modelo (professional.templates.css); o Original não tem tema próprio.
    <div className="pg-pro" data-tpl={tpl}>
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

const professionalShellFor = (tpl: string): ComponentType<{ regions: Regions; ctx: RenderContext }> =>
  function ProfessionalTemplateShell({ regions }) {
    return <ProfessionalShell regions={regions} tpl={tpl} />;
  };

/** Layout (landmarks, wrapper de escopo CSS e efeitos de página) de cada template. */
export const TEMPLATES: Record<string, ComponentType<{ regions: Regions; ctx: RenderContext }>> = {
  'course-original': CourseShell,
  'home-original': HomeShell,
  // Todos os modelos de Profissional compartilham o layout; o tema vem de `data-tpl`.
  ...Object.fromEntries(PROFESSIONAL_TEMPLATE_KEYS.map((key) => [key, professionalShellFor(key)])),
};
