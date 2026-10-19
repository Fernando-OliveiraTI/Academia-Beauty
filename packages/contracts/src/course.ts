import { z } from 'zod';
import { isSafeMediaPath } from '@academia/page-schema';
import { professionalDataSchema, slugSchema, type ReadinessIssue } from './professional.js';

const plain = (max: number) =>
  z.string().trim().max(max).refine((v) => !/[<>]/.test(v), 'Marcação não é permitida');

const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v.length <= 2048 && !/[\u0000-\u0020\u007f-\u009f\\]/.test(v) && /^(https:\/\/|\/(?!\/))/i.test(v), 'Use https:// ou um caminho interno iniciado por /');
const optionalUrl = z.union([z.literal(''), safeUrl]);

/** Mídia: arquivo do site, da biblioteca (`/media/<id>`) ou https de host de CDN autorizado (ver `isSafeMediaPath`). */
const mediaPath = z.string().trim().max(2048).refine(isSafeMediaPath, 'Use um arquivo da biblioteca de mídia ou um caminho /site/...');
const optionalMedia = z.union([z.literal(''), mediaPath]);

export const COURSE_STATUSES = ['draft', 'published', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const COURSE_MODALITIES = ['online', 'presencial', 'hibrido'] as const;
export const COURSE_MODALITY_LABEL = { online: 'Online', presencial: 'Presencial', hibrido: 'Híbrido' } as const;

export const COURSE_LEVELS = ['iniciante', 'intermediario', 'avancado', 'profissional'] as const;
export const COURSE_LEVEL_LABEL = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
  profissional: 'Profissional',
} as const;

/** Dados editáveis do curso (rascunho e snapshot publicado). Preço e checkout ficam em `commercial`. */
export const courseDataSchema = z.object({
  title: plain(80).min(3, 'Informe o título'),
  lead: plain(400).default(''),
  modality: z.enum(COURSE_MODALITIES).default('online'),
  level: z.enum(COURSE_LEVELS).default('profissional'),
  workloadHours: z.number().int().min(1).max(2000).nullable().default(null),
  audience: plain(80).default(''),
  coverSrc: optionalMedia.default(''),
  coverAlt: plain(300).default(''),
  benefits: z.array(z.object({ title: plain(60).min(1), text: plain(200).min(1) })).max(4).default([]),
  modules: z
    .array(z.object({
      title: plain(120).min(1),
      text: plain(600).default(''),
      bullets: z.array(plain(120).min(1)).max(6).default([]),
    }))
    .max(12)
    .default([]),
  deliverables: z.array(z.object({ title: plain(100).min(1), text: plain(200).min(1) })).max(8).default([]),
  faq: z.array(z.object({ title: plain(160).min(1), text: plain(800).min(1) })).max(10).default([]),
  testimonials: z
    .array(z.object({ quote: plain(300).min(1), name: plain(60).min(1), role: plain(60).default('') }))
    .max(6)
    .default([]),
  /** Dias de garantia; `null` = o curso não oferece garantia (a seção não é exibida). */
  guaranteeDays: z.number().int().min(1).max(90).nullable().default(null),
  metaDescription: plain(200).default(''),
});
export type CourseData = z.infer<typeof courseDataSchema>;

export const createCourseSchema = z.object({
  professionalId: z.number().int().positive(),
  slug: slugSchema,
  data: courseDataSchema,
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z.object({
  slug: slugSchema.optional(),
  data: courseDataSchema,
  revision: z.number().int().positive(),
});
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const courseShowcaseSchema = z.object({
  showcaseVisible: z.boolean(),
  showcaseOrder: z.number().int().min(0).max(9999),
  featured: z.boolean(),
});
export type CourseShowcaseInput = z.infer<typeof courseShowcaseSchema>;

export const listCoursesQuerySchema = z.object({
  status: z.enum(COURSE_STATUSES).optional(),
  professionalId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;

/* ----------------------------- Comércio (Modo A) ----------------------------- */

export const CHECKOUT_ENVIRONMENTS = ['production', 'sandbox'] as const;

/**
 * Quem processa a compra. `academia` é o checkout da página (3 etapas, termina no link do provedor);
 * `themembers` embute o checkout hospedado da The Members num iframe (a URL fica em `checkoutUrl`).
 */
export const CHECKOUT_PROVIDERS = ['academia', 'themembers'] as const;
export type CheckoutProvider = (typeof CHECKOUT_PROVIDERS)[number];

/** Preço mínimo/máximo em centavos (R$ 1,00 a R$ 100.000,00). */
export const PRICE_MIN_CENTS = 100;
export const PRICE_MAX_CENTS = 10_000_000;
/** Parcela mínima exibida (R$ 5,00): evita "12x de R$ 0,83". */
export const MIN_INSTALLMENT_CENTS = 500;

const externalCourseIdField = z.string().trim().max(128).regex(/^[A-Za-z0-9_.:-]*$/, 'Use apenas letras, números e _ . : -');

export const commercialInputSchema = z.object({
  listCents: z.number().int().min(PRICE_MIN_CENTS).max(PRICE_MAX_CENTS),
  discountPct: z.number().int().min(0).max(90),
  maxInstallments: z.number().int().min(1).max(12),
  /** Vazio enquanto não houver link; para ativar precisa ser https e de domínio autorizado. */
  checkoutUrl: z.union([z.literal(''), z.string().trim().max(2048)]),
  /** Ausente em ofertas antigas = `academia`. */
  provider: z.enum(CHECKOUT_PROVIDERS).default('academia'),
  /** ID do curso na The Members (só referência; vazio = não informado). */
  externalCourseId: externalCourseIdField.default(''),
  environment: z.enum(CHECKOUT_ENVIRONMENTS),
  active: z.boolean(),
});
export type CommercialInput = z.infer<typeof commercialInputSchema>;

export const updateCommercialSchema = commercialInputSchema.extend({
  /** No PUT, ausente = mantém o valor atual (um cliente antigo não zera o vínculo nem o provedor). */
  provider: z.enum(CHECKOUT_PROVIDERS).optional(),
  externalCourseId: externalCourseIdField.optional(),
  /** Revisão da configuração comercial que o cliente leu (0 = ainda não existe). */
  revision: z.number().int().min(0),
});
export type UpdateCommercialInput = z.infer<typeof updateCommercialSchema>;

export const commercialViewSchema = commercialInputSchema.extend({
  revision: z.number().int().min(0),
  /** Fixo no Modo A: redirecionamento para o checkout do provedor. */
  mode: z.literal('redirect'),
  currency: z.literal('BRL'),
});
export type CommercialView = z.infer<typeof commercialViewSchema>;

export type ComputedOffer = {
  listCents: number;
  discountPct: number;
  discountCents: number;
  totalCents: number;
  /** Primeira opção é sempre à vista (count = 1). O valor da parcela nunca ultrapassa o total. */
  installments: Array<{ count: number; amountCents: number }>;
};

/**
 * Oferta exibida na página. Só o backend chama isto; o renderer apenas formata o resultado.
 * A parcela é arredondada para baixo: `count × amount ≤ total`, então a página nunca anuncia um
 * valor maior que o devido. O provedor de pagamento define as parcelas finais (Modo A).
 */
export function computeOffer(input: Pick<CommercialInput, 'listCents' | 'discountPct' | 'maxInstallments'>): ComputedOffer {
  const discountCents = Math.round((input.listCents * input.discountPct) / 100);
  const totalCents = input.listCents - discountCents;
  const installments = [{ count: 1, amountCents: totalCents }];
  for (let count = 2; count <= input.maxInstallments; count += 1) {
    const amountCents = Math.floor(totalCents / count);
    if (amountCents < MIN_INSTALLMENT_CENTS) break;
    installments.push({ count, amountCents });
  }
  return { listCents: input.listCents, discountPct: input.discountPct, discountCents, totalCents, installments };
}

export const computedOfferSchema = z.object({
  listCents: z.number().int().nonnegative(),
  discountPct: z.number().int().min(0).max(100),
  discountCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  installments: z.array(z.object({ count: z.number().int().positive(), amountCents: z.number().int().nonnegative() })),
});

export type CheckoutUrlResult = { ok: true; url: string } | { ok: false; reason: string };

/** Interpreta `CHECKOUT_ALLOWED_HOSTS` (lista separada por vírgula). */
export function parseAllowedHosts(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);
}

/**
 * Modo A: o navegador só é redirecionado a uma URL https de domínio autorizado. Sem lista de
 * domínios autorizados nada é aceito. Cada entrada vale só para o host exato; subdomínios exigem
 * o curinga explícito (`*.dominio.com`), para não aceitar o checkout de outro vendedor num domínio compartilhado.
 * Não aceita credenciais na URL, porta diferente de 443, IP, `localhost` nem host sem ponto.
 */
export function validateCheckoutUrl(raw: string, allowedHosts: readonly string[]): CheckoutUrlResult {
  const value = raw.trim();
  if (allowedHosts.length === 0) return { ok: false, reason: 'Nenhum domínio de checkout está autorizado neste ambiente' };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'Informe uma URL completa (https://…)' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'O checkout deve usar https://' };
  if (url.username || url.password) return { ok: false, reason: 'A URL não pode conter usuário ou senha' };
  if (url.port && url.port !== '443') return { ok: false, reason: 'Porta não permitida' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    return { ok: false, reason: 'Informe um domínio (não IP nem localhost)' };
  }
  const allowed = allowedHosts.some((entry) => (entry.startsWith('*.') ? host.endsWith(entry.slice(1)) : host === entry));
  if (!allowed) return { ok: false, reason: 'Domínio de checkout não autorizado' };
  return { ok: true, url: url.toString() };
}

/* ------------------------------- Publicação ------------------------------- */

/** Pendências do conteúdo do curso. O rascunho pode ser salvo incompleto; publicar exige isto. */
export function courseReadiness(data: CourseData): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  if (!data.lead) issues.push({ field: 'lead', message: 'Escreva a descrição do curso' });
  if (!data.audience) issues.push({ field: 'audience', message: 'Informe para quem é o curso' });
  if (!data.coverSrc) issues.push({ field: 'coverSrc', message: 'Informe a imagem de capa' });
  if (!data.coverAlt) issues.push({ field: 'coverAlt', message: 'Descreva a capa (texto alternativo)' });
  if (data.benefits.length === 0) issues.push({ field: 'benefits', message: 'Informe ao menos um benefício' });
  if (data.modules.length === 0) issues.push({ field: 'modules', message: 'Informe ao menos um módulo do conteúdo' });
  if (data.deliverables.length === 0) issues.push({ field: 'deliverables', message: 'Informe o que o aluno recebe' });
  return issues;
}

/** Pendências da oferta. Sem link de checkout autorizado e ativo não há como vender. */
export function commercialReadiness(
  commercial: CommercialInput | null,
  allowedHosts: readonly string[]
): ReadinessIssue[] {
  if (!commercial) return [{ field: 'commercial', message: 'Configure a oferta (preço e link de checkout)' }];
  const issues: ReadinessIssue[] = [];
  if (!commercial.active) issues.push({ field: 'active', message: 'Ative a oferta' });
  if (!commercial.checkoutUrl) {
    issues.push({ field: 'checkoutUrl', message: 'Informe o link de checkout' });
  } else {
    const check = validateCheckoutUrl(commercial.checkoutUrl, allowedHosts);
    if (!check.ok) issues.push({ field: 'checkoutUrl', message: check.reason });
  }
  return issues;
}

/* ------------------------------- Respostas ------------------------------- */

export const adminCourseSchema = z.object({
  id: z.number().int().positive(),
  professionalId: z.number().int().positive(),
  professionalName: z.string(),
  slug: z.string(),
  status: z.enum(COURSE_STATUSES),
  revision: z.number().int().positive(),
  data: courseDataSchema,
  commercial: commercialViewSchema.nullable(),
  showcaseVisible: z.boolean(),
  showcaseOrder: z.number().int(),
  featured: z.boolean(),
  publishedVersion: z.number().int().nullable(),
  publishedAt: z.string().nullable(),
  hasUnpublishedChanges: z.boolean(),
  /** 0 = página nunca personalizada no editor. */
  documentRevision: z.number().int().min(0),
  updatedAt: z.string(),
});
export type AdminCourse = z.infer<typeof adminCourseSchema>;

export const publicCourseSchema = z.object({
  slug: z.string(),
  version: z.number().int().positive(),
  publishedAt: z.string(),
  templateKey: z.string(),
  templateVersion: z.number().int().positive(),
  data: courseDataSchema,
  offer: computedOfferSchema,
  /** `url` é null quando o link deixou de ser autorizado: a página mostra a compra indisponível. */
  checkout: z.object({ mode: z.enum(['redirect', 'embed']), url: z.string().nullable() }),
  professional: z.object({ slug: z.string(), data: professionalDataSchema }),
  /** Documento editado no editor visual (D-020); null = página derivada do cadastro. */
  document: z.unknown().nullable().default(null),
});
export type PublicCourse = z.infer<typeof publicCourseSchema>;
