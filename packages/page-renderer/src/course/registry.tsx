import {
  Benefits, CheckoutSection, Curriculum, Deliverables, Faq, Facts, FinalCta, Footer, Guarantee, Header, Hero, Instructor,
  Offer, Proof, StickyBar,
} from './sections';
import * as s from './schemas';

import { entry, type SectionEntry } from '../section-entry';

export const COURSE_SECTIONS: SectionEntry[] = [
  entry('course.header', s.headerSchema, 'banner', Header),
  entry('course.hero', s.heroSchema, 'main', Hero),
  entry('course.facts', s.factsSchema, 'main', Facts),
  entry('course.benefits', s.benefitsSchema, 'main', Benefits),
  entry('course.curriculum', s.curriculumSchema, 'main', Curriculum),
  entry('course.deliverables', s.deliverablesSchema, 'main', Deliverables),
  entry('course.instructor', s.instructorSchema, 'main', Instructor),
  entry('course.proof', s.proofSchema, 'main', Proof),
  entry('course.offer', s.offerSchema, 'main', Offer),
  entry('course.faq', s.faqSchema, 'main', Faq),
  entry('course.checkout', s.checkoutSchema, 'main', CheckoutSection),
  entry('course.guarantee', s.guaranteeSchema, 'main', Guarantee),
  entry('course.final-cta', s.finalCtaSchema, 'main', FinalCta),
  entry('course.footer', s.footerSchema, 'contentinfo', Footer),
  entry('course.sticky-cta', s.stickyCtaSchema, 'overlay', StickyBar),
];
