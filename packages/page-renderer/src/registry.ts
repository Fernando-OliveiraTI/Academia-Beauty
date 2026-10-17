import { hasSection, registerSection } from '@academia/page-schema';
import { COURSE_SECTIONS } from './course/registry';
import { HOME_SECTIONS } from './home/registry';
import { PROFESSIONAL_SECTIONS } from './professional/registry';
import { SCHEMA_VERSION } from './schemas-version';
import type { SectionEntry } from './section-entry';

export const ALL_SECTIONS: SectionEntry[] = [...COURSE_SECTIONS, ...PROFESSIONAL_SECTIONS, ...HOME_SECTIONS];

export const sectionRegistry = new Map(ALL_SECTIONS.map((e) => [e.type, e]));

/** Registra os schemas no registry do page-schema (idempotente: seguro com HMR). */
export function registerSections(): void {
  for (const e of ALL_SECTIONS) {
    if (!hasSection(e.type)) registerSection({ type: e.type, schemaVersion: SCHEMA_VERSION, content: e.schema });
  }
}
