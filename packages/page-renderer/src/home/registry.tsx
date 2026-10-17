import { entry } from '../section-entry';
import { Benefits, Brands, Courses, Cta, Footer, Hero, Nav, Professionals } from './sections';
import * as s from './schemas';

export const HOME_SECTIONS = [
  entry('home.nav', s.navSchema, 'banner', Nav),
  entry('home.hero', s.heroSchema, 'main', Hero),
  entry('home.professionals', s.professionalsSchema, 'main', Professionals),
  entry('home.courses', s.coursesSchema, 'main', Courses),
  entry('home.benefits', s.benefitsSchema, 'main', Benefits),
  entry('home.brands', s.brandsSchema, 'main', Brands),
  entry('home.cta', s.ctaSchema, 'main', Cta),
  entry('home.footer', s.footerSchema, 'contentinfo', Footer),
];
