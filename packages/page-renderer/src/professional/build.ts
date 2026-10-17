import type { PageDocument } from '@academia/page-schema';
import type { CourseCard, ProfessionalData } from '@academia/contracts';
import { PROFESSIONAL_TEMPLATE_KEY, professionalOriginalTemplate } from './template';
import { SCHEMA_VERSION } from '../schemas-version';
import { clip } from '../clip';
import { professionalCourseCards } from '../course/build';
import type * as S from './schemas';

type Section = PageDocument['sections'][number];

const upper = (value: string) => value.toLocaleUpperCase('pt-BR');

/** "Lukas Campos" → { first: "Lukas", accent: "Campos." }; nome simples fica só no primeiro campo. */
export function splitName(name: string): { first: string; accent: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { first: parts[0] ?? '', accent: '' };
  return { first: parts.slice(0, -1).join(' '), accent: `${parts[parts.length - 1]}.` };
}

/** Ordem das seções de cada modelo (Fase 7C). Todos partem das mesmas seções do Original; `stats` e `cta` só entram onde listadas. */
const TEMPLATE_ORDER: Record<string, readonly string[]> = {
  'professional-original': ['nav', 'hero', 'bio', 'works', 'video', 'courses', 'footer'],
  'professional-authority': ['nav', 'hero', 'stats', 'bio', 'works', 'video', 'courses', 'footer'],
  'professional-video': ['nav', 'hero', 'video', 'bio', 'works', 'courses', 'footer'],
  'professional-conversion': ['nav', 'hero', 'courses', 'cta', 'bio', 'works', 'video', 'footer'],
  'professional-immersive': ['nav', 'hero', 'works', 'video', 'bio', 'courses', 'footer'],
  'professional-premium': ['nav', 'hero', 'bio', 'stats', 'works', 'cta', 'courses', 'footer'],
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "53,6 Mil seguidores" → { value: "53,6 Mil", label: "seguidores" }; texto sem número vira só o valor. */
function splitFollowers(text: string): { value: string; label: string } {
  const m = /^(\d[\d.,]*\s*(?:milh(?:ão|ões)|mil|k|m)?)\s*(.*)$/i.exec(text.trim());
  return m ? { value: m[1]!.trim(), label: m[2]?.trim() || 'na comunidade' } : { value: text.trim(), label: 'na comunidade' };
}

/** Números reais do cadastro; nada é inventado (item sem dado simplesmente não aparece). */
function statsItems(data: ProfessionalData, courseCount: number): S.StatsContent['items'] {
  const items: S.StatsContent['items'] = [];
  if (data.experienceYears !== null) items.push({ value: String(data.experienceYears), label: plural(data.experienceYears, 'ano de experiência', 'anos de experiência') });
  if (data.instagramFollowers) {
    const f = splitFollowers(data.instagramFollowers);
    items.push({ value: clip(f.value, 24), label: clip(f.label, 48) });
  }
  if (data.works.length) items.push({ value: String(data.works.length), label: plural(data.works.length, 'trabalho em destaque', 'trabalhos em destaque') });
  if (courseCount) items.push({ value: String(courseCount), label: plural(courseCount, 'curso publicado', 'cursos publicados') });
  return items.slice(0, 4);
}

/**
 * Monta o documento da página do profissional a partir dos dados cadastrados, sobre o template
 * "Profissional Original". Função pura: o mesmo dado gera sempre o mesmo documento (a publicação
 * guarda os dados e a versão do template, não HTML).
 *
 * `courseCards` vem dos cursos publicados do profissional (catálogo); sem cards a seção fica oculta.
 */
export function buildProfessionalDocument(
  data: ProfessionalData,
  options: { courses?: S.CoursesContent['cards']; courseCards?: readonly CourseCard[]; templateKey?: string } = {}
): PageDocument {
  const tpl = structuredClone(professionalOriginalTemplate);
  const byId = (id: string): Section => {
    const section = tpl.sections.find((s) => s.id === id);
    if (!section) throw new Error(`Template sem a seção ${id}`);
    return section;
  };
  const { first, accent } = splitName(data.name);
  const firstName = data.name.trim().split(/\s+/)[0] ?? data.name;
  const hasWorks = data.works.length > 0;
  const hasVideo = data.videoSrc !== '';
  const courses = options.courses ?? professionalCourseCards(options.courseCards ?? [], data.name);

  const hero = byId('hero').content as S.HeroContent;
  hero.nameFirst = clip(first, 40);
  hero.nameAccent = clip(accent, 40);
  hero.sub = clip(data.tagline, 200);
  hero.meta = [
    ...(data.instagramHandle ? [{ label: 'Instagram', value: data.instagramHandle }] : []),
    ...(data.instagramFollowers ? [{ label: 'Comunidade', value: data.instagramFollowers, gold: true }] : []),
  ];
  hero.portrait = { src: data.portraitSrc, alt: data.name };
  hero.hud = {
    label: clip(`Expert / ${data.specialty}`, 40),
    accent: data.experienceYears === null ? '' : String(data.experienceYears),
    value: data.experienceYears === null ? '' : data.experienceYears === 1 ? 'ano' : 'anos',
  };

  const bio = byId('bio').content as S.BioContent;
  bio.tickerUnit = `${clip(upper(firstName), 30)} • ACADEMIA BEAUTY • `;
  bio.paragraphs = data.bio;
  bio.instagram = { handle: data.instagramHandle, followers: data.instagramFollowers, href: data.instagramUrl };

  const works = byId('works');
  const worksContent = works.content as S.WorksContent;
  worksContent.copy = clip(`Uma seleção exclusiva de trabalhos de ${data.name}.`, 400);
  worksContent.items = data.works.map((w) => ({
    image: { src: w.imageSrc, alt: w.alt },
    tags: w.tags.map((label) => ({ label })),
    person: clip(data.name, 60),
    title: w.title,
    plusLabel: clip(`Ver detalhes de ${w.title}`, 120),
    href: hasVideo ? '#video' : '#trabalhos',
  }));
  works.visibility = { enabled: hasWorks };

  const video = byId('video');
  const videoContent = video.content as S.VideoContent;
  videoContent.titleAccent = clip(`${data.name}.`, 60);
  videoContent.video = {
    ...videoContent.video,
    src: data.videoSrc || videoContent.video.src,
    ariaLabel: clip(`Vídeo de apresentação de ${data.name}`, 160),
  };
  video.visibility = { enabled: hasVideo };

  const coursesSection = byId('courses');
  const coursesContent = coursesSection.content as S.CoursesContent;
  coursesContent.title = clip(`Cursos de ${firstName}.`, 60);
  coursesContent.cards = courses;
  coursesSection.visibility = { enabled: courses.length > 0 };

  const nav = byId('nav').content as S.NavContent;
  const present = { '#trabalhos': hasWorks, '#video': hasVideo, '#cursos': courses.length > 0 } as Record<string, boolean>;
  nav.links = nav.links.filter((link) => present[link.href] !== false);

  const templateKey = options.templateKey ?? PROFESSIONAL_TEMPLATE_KEY;
  const order = TEMPLATE_ORDER[templateKey];
  if (!order) throw new Error(`Modelo de profissional desconhecido: ${templateKey}`);
  if (templateKey === PROFESSIONAL_TEMPLATE_KEY) return tpl;

  tpl.template = { key: templateKey, version: 1 };
  const extra = (id: string, type: string, content: object, enabled: boolean): Section => ({
    id, type, schemaVersion: SCHEMA_VERSION, visibility: { enabled }, settings: {}, content: content as Record<string, unknown>,
  });
  const stats = statsItems(data, courses.length);
  tpl.sections.push(extra('stats', 'professional.stats', {
    sectionIndex: '01 / NÚMEROS',
    title: clip(`Números de ${firstName}.`, 80),
    items: stats.length ? stats : [{ value: '—', label: 'em breve' }],
  } satisfies S.StatsContent, stats.length > 0));
  const toCourses = courses.length > 0;
  tpl.sections.push(extra('cta', 'professional.cta', {
    sectionIndex: '05 / PRÓXIMO PASSO',
    title: clip(toCourses ? `Aprenda com ${firstName}.` : `Acompanhe ${firstName}.`, 80),
    text: toCourses ? 'Conheça os cursos e leve a técnica para o seu dia a dia no salão.' : 'Bastidores, técnicas e novidades no Instagram.',
    cta: toCourses ? { label: 'Ver cursos', href: '#cursos' } : { label: 'Seguir no Instagram', href: data.instagramUrl || '#' },
  } satisfies S.CtaContent, toCourses || data.instagramUrl !== ''));

  tpl.sections = order.map((id) => tpl.sections.find((x) => x.id === id)!);
  return tpl;
}
