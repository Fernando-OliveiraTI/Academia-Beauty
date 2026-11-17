import { z } from 'zod';

/** Aparelhos e origens agrupadas que os Insights filtram (a origem vem do host do referenciador). */
export const INSIGHT_DEVICES = ['mobile', 'tablet', 'desktop'] as const;
export const INSIGHT_ORIGINS = ['direto', 'instagram', 'facebook', 'google', 'tiktok', 'youtube', 'whatsapp', 'outros'] as const;
export type InsightDevice = (typeof INSIGHT_DEVICES)[number];
export type InsightOrigin = (typeof INSIGHT_ORIGINS)[number];

export const INSIGHT_ORIGIN_LABEL: Record<InsightOrigin, string> = {
  direto: 'Direto ou sem origem', instagram: 'Instagram', facebook: 'Facebook', google: 'Google',
  tiktok: 'TikTok', youtube: 'YouTube', whatsapp: 'WhatsApp', outros: 'Outros sites',
};

/** Maior intervalo consultável de uma vez (dias). */
export const INSIGHTS_MAX_DAYS = 366;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD');

/** Filtros da área Insights. Datas no fuso de Brasília, `to` inclusivo. */
export const insightsQuerySchema = z
  .object({
    from: ymd,
    to: ymd,
    professionalId: z.coerce.number().int().positive().optional(),
    courseId: z.coerce.number().int().positive().optional(),
    device: z.enum(INSIGHT_DEVICES).optional(),
    origin: z.enum(INSIGHT_ORIGINS).optional(),
  })
  .refine((q) => q.from <= q.to, { message: 'A data inicial precisa ser antes da final', path: ['from'] })
  .refine((q) => (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) / 86_400_000 < INSIGHTS_MAX_DAYS, {
    message: `Escolha um período de até ${INSIGHTS_MAX_DAYS} dias`,
    path: ['to'],
  });
export type InsightsQuery = z.infer<typeof insightsQuerySchema>;

/** Engajamento (páginas) + vendas (webhook) de um conjunto de cursos. */
export type InsightsMetrics = {
  views: number;
  /** Visitantes únicos por dia (resumo anônimo diário: a mesma pessoa em dois dias conta duas vezes). */
  visitors: number;
  /** Cliques em "comprar". */
  cta: number;
  /** Chegadas ao checkout (saída para o provedor ou checkout embutido na tela). */
  checkout: number;
  /** Tempo com a página visível, somado (ms). */
  timeMs: number;
  /** Compras aprovadas no período (contam mesmo se reembolsadas depois). */
  sales: number;
  revenueCents: number;
  /** Transações hoje reembolsadas/estornadas. */
  refunds: number;
  refundedCents: number;
};

export type InsightsCourseRow = InsightsMetrics & {
  id: number;
  slug: string;
  title: string;
  status: string;
  professionalId: number;
  professionalName: string;
  coverSrc: string;
};

export type InsightsDay = { date: string; views: number; visitors: number; cta: number; checkout: number; sales: number; revenueCents: number };

export type Insights = {
  range: { from: string; to: string; days: number };
  /** Filtros aplicados de fato (o servidor impõe o profissional do login). */
  scope: { professionalId: number | null; courseId: number | null; device: InsightDevice | null; origin: InsightOrigin | null; restricted: boolean };
  totals: InsightsMetrics;
  /** Visitas à página do(s) profissional(is) no período. */
  professionalPageViews: number;
  courses: InsightsCourseRow[];
  series: InsightsDay[];
  devices: { device: InsightDevice; views: number }[];
  origins: { origin: InsightOrigin; views: number }[];
  /** Aparelho/origem não existem nas vendas (vêm do webhook): o filtro vale só para o engajamento. */
  salesIgnoreAudience: boolean;
  /** Opções dos filtros dentro do que o login pode ver. */
  options: {
    professionals: { id: number; name: string; specialty: string; photo: string }[];
    courses: { id: number; title: string; professionalId: number }[];
  };
  /** Desde quando há medição de tempo na página (antes disso o tempo médio não existe). */
  timeTrackingSince: string | null;
};
