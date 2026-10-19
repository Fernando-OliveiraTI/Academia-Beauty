import type { PageDocument } from '@academia/page-schema';
import {
  COURSE_LEVEL_LABEL,
  COURSE_MODALITY_LABEL,
  type CourseCard,
  type CourseData,
  type ProfessionalData,
} from '@academia/contracts';
import { clip } from '../clip';
import { PLACEHOLDER_IMAGE } from '../media';
import { courseOriginalTemplate } from './template';
import type * as S from './schemas';

type Section = PageDocument['sections'][number];


/** "Morena Iluminada" → { lead: "Morena", accent: "Iluminada." }; título de uma palavra fica só no destaque. */
export function splitTitle(title: string): { lead: string; accent: string } {
  const parts = title.trim().split(/\s+/);
  if (parts.length < 2) return { lead: '', accent: `${parts[0] ?? ''}.` };
  return { lead: parts.slice(0, -1).join(' '), accent: `${parts[parts.length - 1]}.` };
}

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]!).filter((c, i, a) => i === 0 || i === a.length - 1).join('').toLocaleUpperCase('pt-BR').slice(0, 4);

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Ícones neutros: os do template aprovado (sol, rosto, tesoura) são específicos de cabelo. */
const BENEFIT_ICONS = ['gem', 'star', 'bolt', 'check'] as const;

/**
 * Monta a página do curso a partir do cadastro (curso + profissional publicados), sobre o template
 * "Curso Original". Função pura. Nada é inventado: garantia, FAQ e depoimentos só aparecem se foram
 * cadastrados, e preço/parcelas vêm do `ctx.offer` entregue pelo backend, nunca deste documento.
 *
 * Seções ocultas mantêm o conteúdo do template (o schema exige conteúdo válido), mas não são renderizadas.
 */
export function buildCourseDocument(input: { data: CourseData; professional: ProfessionalData }): PageDocument {
  const { data, professional: pro } = input;
  const tpl = structuredClone(courseOriginalTemplate);
  const byId = (id: string): Section => {
    const section = tpl.sections.find((s) => s.id === id);
    if (!section) throw new Error(`Template sem a seção ${id}`);
    return section;
  };

  const modality = COURSE_MODALITY_LABEL[data.modality];
  const level = COURSE_LEVEL_LABEL[data.level];
  const hasFaq = data.faq.length > 0;
  const hasTestimonials = data.testimonials.length > 0;
  const days = data.guaranteeDays;
  const hasBio = pro.bio.length > 0;
  const { lead: titleLead, accent: titleAccent } = splitTitle(data.title);

  const hero = byId('hero').content as S.HeroContent;
  hero.eyebrow = clip(`Curso ${modality.toLocaleLowerCase('pt-BR')} · ${pro.specialty}`, 80);
  hero.titleLead = clip(titleLead, 40);
  hero.titleAccent = clip(titleAccent, 40);
  hero.lead = data.lead;
  hero.byInitials = initials(pro.name);
  hero.byName = clip(pro.name, 60);
  hero.bySuffix = pro.experienceYears === null ? '' : `· ${pro.experienceYears} ${plural(pro.experienceYears, 'ano', 'anos')} de carreira`;
  hero.trust = [
    { icon: 'lock', label: 'Pagamento seguro' },
    ...(days ? [{ icon: 'shield' as const, label: `Garantia de ${days} ${plural(days, 'dia', 'dias')}` }] : []),
    ...(data.workloadHours ? [{ icon: 'check' as const, label: `${data.workloadHours} ${plural(data.workloadHours, 'hora', 'horas')} de conteúdo` }] : []),
  ];
  hero.image = { src: data.coverSrc || PLACEHOLDER_IMAGE, alt: data.coverAlt };
  hero.frameTitle = clip(data.title, 60);
  hero.frameBadge = clip(pro.name, 40);
  hero.huds = [
    ...(pro.experienceYears === null ? [] : [{ kicker: 'Carreira', accent: String(pro.experienceYears), value: plural(pro.experienceYears, 'ano', 'anos') }]),
    ...(pro.instagramFollowers ? [{ kicker: 'Comunidade', value: clip(pro.instagramFollowers, 30) }] : []),
  ];
  delete hero.toneScale;

  const facts = byId('facts').content as S.FactsContent;
  facts.items = [
    { label: 'Formato', value: modality },
    { label: 'Nível', value: level },
    ...(data.workloadHours ? [{ label: 'Carga', value: `${data.workloadHours} ${plural(data.workloadHours, 'hora', 'horas')}` }] : []),
    ...(data.audience ? [{ label: 'Para', value: clip(data.audience, 80) }] : []),
  ].slice(0, 4);

  const benefitsSection = byId('benefits');
  const benefits = benefitsSection.content as S.BenefitsContent;
  benefits.eyebrow = 'Por que este curso';
  benefits.title = clip(`O que você leva de ${data.title}.`, 160);
  delete benefits.quoteBefore;
  delete benefits.quoteEmphasis;
  delete benefits.quoteAfter;
  if (data.benefits.length) {
    benefits.cards = data.benefits.map((b, i) => ({ icon: BENEFIT_ICONS[i % BENEFIT_ICONS.length]!, title: b.title, text: b.text }));
  } else {
    benefitsSection.visibility = { enabled: false };
  }

  const curriculumSection = byId('curriculum');
  const curriculum = curriculumSection.content as S.CurriculumContent;
  if (data.modules.length) {
    curriculum.title = clip(`O que você vai aprender em ${data.title}.`, 160);
    curriculum.lead = `${data.modules.length} ${plural(data.modules.length, 'módulo', 'módulos')}${data.workloadHours ? ` · ${data.workloadHours} ${plural(data.workloadHours, 'hora', 'horas')} de conteúdo` : ''}.`;
    curriculum.modules = data.modules.map((m) => ({ title: m.title, text: m.text, ...(m.bullets.length ? { bullets: m.bullets } : {}) }));
  } else {
    curriculumSection.visibility = { enabled: false };
  }

  const deliverablesSection = byId('deliverables');
  const deliverables = deliverablesSection.content as S.DeliverablesContent;
  if (data.deliverables.length) {
    deliverables.title = 'O que você recebe.';
    deliverables.items = data.deliverables;
    deliverables.specs = [
      { label: 'Curso', value: clip(data.title, 80) },
      { label: 'Instrutor', value: clip(pro.name, 80) },
      { label: 'Formato', value: modality },
      { label: 'Nível', value: level },
      ...(data.workloadHours ? [{ label: 'Carga horária', value: `${data.workloadHours} ${plural(data.workloadHours, 'hora', 'horas')}` }] : []),
      ...(data.audience ? [{ label: 'Público', value: clip(data.audience, 80) }] : []),
      ...(days ? [{ label: 'Garantia', value: `${days} ${plural(days, 'dia', 'dias')}` }] : []),
    ];
  } else {
    deliverablesSection.visibility = { enabled: false };
  }

  const instructorSection = byId('instructor');
  const instructor = instructorSection.content as S.InstructorContent;
  if (hasBio) {
    instructor.monogram = initials(pro.name);
    instructor.handle = clip(pro.instagramHandle, 40);
    instructor.title = clip(`Aprenda com ${pro.name}.`, 160);
    instructor.paragraphs = pro.bio.slice(0, 6);
    instructor.places = [];
    if (pro.portraitSrc) instructor.photo = { src: pro.portraitSrc, alt: clip(`Retrato de ${pro.name}`, 300) };
    else delete instructor.photo;
  } else {
    instructorSection.visibility = { enabled: false };
  }

  const proofSection = byId('proof');
  const proof = proofSection.content as S.ProofContent;
  if (hasTestimonials) {
    proof.title = 'O que dizem os alunos.';
    proof.stats = [];
    proof.testimonials = data.testimonials;
    delete proof.sampleNote;
  } else {
    proofSection.visibility = { enabled: false };
  }

  const offer = byId('offer').content as S.OfferContent;
  offer.cardTitle = clip(data.title, 80);
  offer.perks = data.deliverables.slice(0, 3).map((d) => clip(d.title, 100));
  // O título e o texto da oferta dependem do desconto, que só o `ctx.offer` conhece; o texto fica neutro.
  offer.title = 'Garanta o seu acesso.';
  offer.lead = clip(`Você será levado à página segura de pagamento para concluir a compra.${days ? ` O curso tem garantia de ${days} ${plural(days, 'dia', 'dias')}.` : ''}`, 300);

  const faqSection = byId('faq');
  const faq = faqSection.content as S.FaqContent;
  if (hasFaq) {
    faq.lead = '';
    faq.items = data.faq;
  } else {
    faqSection.visibility = { enabled: false };
  }

  // Modo A: o checkout da página coleta os dados e leva ao link do provedor, onde a compra termina.
  const checkout = byId('checkout').content as S.CheckoutContent;
  checkout.notice = 'Você conclui o pagamento no ambiente seguro do provedor.';
  checkout.paymentNote = 'Pagamento criptografado';
  // O selo de garantia só existe se o curso tem garantia cadastrada.
  checkout.seals = checkout.seals.map((s) => (s.icon === 'shield' ? { ...s, label: days ? `${days} ${plural(days, 'dia', 'dias')} de garantia` : 'Compra protegida' } : s));
  checkout.productName = clip(data.title, 80);
  checkout.productCaption = clip(`Curso ${modality.toLocaleLowerCase('pt-BR')} · ${pro.name}`, 80);
  checkout.productImage = { src: data.coverSrc || PLACEHOLDER_IMAGE };

  const guaranteeSection = byId('guarantee');
  const guarantee = guaranteeSection.content as S.GuaranteeContent;
  if (days) {
    guarantee.sealValue = String(days);
    guarantee.sealUnit = plural(days, 'dia', 'dias');
    guarantee.eyebrow = 'Garantia';
    guarantee.lead = `O curso tem garantia de ${days} ${plural(days, 'dia', 'dias')}. Se ele não atender às suas expectativas, solicite o reembolso dentro do prazo.`;
    guarantee.items = [];
  } else {
    guaranteeSection.visibility = { enabled: false };
  }

  const finalCta = byId('final-cta').content as S.FinalCtaContent;
  finalCta.titleLead = 'Pronto para começar?';
  finalCta.titleAccent = 'Comece hoje.';
  finalCta.leadBefore = clip(`${data.title} com ${pro.name} por`, 120);
  finalCta.leadAfter = days ? `, com ${days} ${plural(days, 'dia', 'dias')} de garantia.` : '.';

  const footer = byId('footer').content as S.FooterContent;
  footer.links = pro.instagramUrl ? [{ label: 'Instagram', href: pro.instagramUrl, external: true }] : [];

  const header = byId('header').content as S.HeaderContent;
  header.nav = [
    ...(data.benefits.length ? [{ label: 'O curso', href: '#beneficios' }] : []),
    ...(data.modules.length ? [{ label: 'Conteúdo', href: '#conteudo' }] : []),
    ...(hasBio ? [{ label: 'Instrutor', href: '#instrutor' }] : []),
    ...(hasFaq ? [{ label: 'Dúvidas', href: '#faq' }] : []),
  ];
  if (header.nav.length === 0) header.nav = [{ label: 'Oferta', href: '#oferta' }];

  return tpl;
}

/** Cartões da página do profissional a partir dos cursos publicados na vitrine dele. */
export function professionalCourseCards(cards: readonly CourseCard[], personName: string) {
  return cards.map((card) => {
    const { lead, accent } = splitTitle(card.title);
    return {
      href: `/cursos/${card.slug}`,
      image: { src: card.coverSrc, alt: card.coverAlt || card.title },
      titleLead: clip(lead, 60),
      titleAccent: clip(accent, 60),
      ...(card.discountPct > 0 ? { badge: `${card.discountPct}% OFF` } : {}),
      person: clip(personName, 60),
    };
  });
}
