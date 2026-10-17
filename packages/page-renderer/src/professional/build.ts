import type { PageDocument } from '@academia/page-schema';
import type { CourseCard, ProfessionalData } from '@academia/contracts';
import { professionalOriginalTemplate } from './template';
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

/**
 * Monta o documento da página do profissional a partir dos dados cadastrados, sobre o template
 * "Profissional Original". Função pura: o mesmo dado gera sempre o mesmo documento (a publicação
 * guarda os dados e a versão do template, não HTML).
 *
 * `courseCards` vem dos cursos publicados do profissional (catálogo); sem cards a seção fica oculta.
 */
export function buildProfessionalDocument(
  data: ProfessionalData,
  options: { courses?: S.CoursesContent['cards']; courseCards?: readonly CourseCard[] } = {}
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

  return tpl;
}
