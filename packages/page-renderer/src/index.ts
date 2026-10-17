export { PageRenderer, InvalidPageDocumentError } from './PageRenderer';
export { courseOriginalTemplate, COURSE_TEMPLATE_KEY } from './course/template';
export { professionalOriginalTemplate, PROFESSIONAL_TEMPLATE_KEY } from './professional/template';
export { PROFESSIONAL_TEMPLATES, isProfessionalTemplate } from '@academia/section-schemas';
export { homeOriginalTemplate, HOME_TEMPLATE_KEY } from './home/template';
export { registerSections } from './registry';
export { formatBRL, offerTexts, type CheckoutMode, type OfferView, type RenderContext } from './offer';
export { buildCourseDocument, professionalCourseCards, splitTitle } from './course/build';
export { buildProfessionalDocument, splitName } from './professional/build';
export { buildHomeDocument, homeCourseItems, homeProfessionalItems, HOME_COURSES_MAX, HOME_SHOWCASE_MAX } from './home/build';
/** `ctx.offer` só é lido pelo template do Curso; páginas de Home e Profissional usam este valor neutro. */
export { NO_OFFER } from './offer';
export { resolveCourseDocument, resolveHomeDocument, resolveProfessionalDocument } from './resolve';
export { mediaSrc } from './media';
