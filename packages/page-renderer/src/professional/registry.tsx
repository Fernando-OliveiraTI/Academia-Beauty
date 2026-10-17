import { entry } from '../section-entry';
import { professionalFooterSchema } from './footer-schema';
import { ProfessionalFooter } from './Footer';
import { Bio, Courses, Hero, Nav, Video, Works } from './sections';
import * as s from './schemas';

export const PROFESSIONAL_SECTIONS = [
  entry('professional.nav', s.navSchema, 'banner', Nav),
  entry('professional.hero', s.heroSchema, 'main', Hero),
  entry('professional.bio', s.bioSchema, 'main', Bio),
  entry('professional.works', s.worksSchema, 'main', Works),
  entry('professional.video', s.videoSchema, 'main', Video),
  entry('professional.courses', s.coursesSchema, 'main', Courses),
  entry('professional.footer', professionalFooterSchema, 'contentinfo', ProfessionalFooter),
];
