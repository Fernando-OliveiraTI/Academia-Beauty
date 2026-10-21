/**
 * Visão da oferta que o renderer exibe. Os valores chegam prontos do backend (centavos):
 * o renderer só formata e nunca calcula nem aceita preço vindo do documento da página.
 */
import type { PriceDisplay } from '@academia/contracts';

export type OfferView = {
  /** Formato de exibição do preço; ausente = `full` (de/por + selo, como sempre). */
  display?: PriceDisplay;
  listCents: number;
  discountPct: number;
  discountCents: number;
  totalCents: number;
  /** Opções de parcelamento sem juros; a primeira é a à vista (count = 1). */
  installments: ReadonlyArray<{ count: number; amountCents: number }>;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ 250,00" com espaço comum, como no original (o Intl devolve espaço sem quebra). */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, ' ');
}

export function offerTexts(offer: OfferView) {
  const max = offer.installments[offer.installments.length - 1];
  const perInstallment = max ? formatBRL(max.amountCents) : formatBRL(offer.totalCents);
  const count = max?.count ?? 1;
  return {
    list: formatBRL(offer.listCents),
    discount: `−${formatBRL(offer.discountCents)}`,
    total: formatBRL(offer.totalCents),
    discountLabel: `${offer.discountPct}% OFF`,
    discountPct: `${offer.discountPct}%`,
    installments: count === 1 ? 'pagamento à vista' : `ou ${count}x de ${perInstallment} sem juros`,
    installmentsShort: count === 1 ? 'à vista' : `${count}x de ${perInstallment}`,
    summaryNote: count === 1 ? 'à vista' : `à vista ou em até ${count}x`,
    hasDiscount: offer.discountPct > 0,
    ...displayFlags(offer.display, offer.discountPct > 0 && offer.listCents > offer.totalCents),
    maxInstallments: count,
  };
}

/**
 * O formato escolhido decide o que é mostrado do desconto: preço riscado ("de R$ X"), selo ("N% OFF") e, no resumo do
 * checkout, as linhas de produto e desconto. Sem desconto nada disso aparece. `full` (padrão) é o comportamento de sempre.
 */
export function displayFlags(display: PriceDisplay | undefined, hasDiscount: boolean) {
  const mode = display ?? 'full';
  return {
    showOld: hasDiscount && (mode === 'full' || mode === 'from_to'),
    showBadge: hasDiscount && (mode === 'full' || mode === 'percent_off'),
    showSummaryDiscount: hasDiscount && mode !== 'standard',
  };
}

/** Preço de um card de curso (página do profissional e Home) no formato escolhido; sem oferta cadastrada, vazio. */
export type CardPriceTexts = { price?: string; priceOld?: string; badge?: string };
export function cardPriceTexts(card: { listCents?: number; totalCents?: number; discountPct?: number; priceDisplay?: PriceDisplay }): CardPriceTexts {
  const listCents = card.listCents ?? 0;
  const totalCents = card.totalCents ?? 0;
  const discountPct = card.discountPct ?? 0;
  // Sem oferta cadastrada não há preço para mostrar; o selo de desconto (se houver) continua valendo.
  if (listCents <= 0 || totalCents <= 0) {
    return displayFlags(card.priceDisplay, discountPct > 0).showBadge ? { badge: `${discountPct}% OFF` } : {};
  }
  const flags = displayFlags(card.priceDisplay, discountPct > 0 && listCents > totalCents);
  return {
    price: formatBRL(totalCents),
    ...(flags.showOld ? { priceOld: formatBRL(listCents) } : {}),
    ...(flags.showBadge ? { badge: `${discountPct}% OFF` } : {}),
  };
}

export function installmentLabel(option: { count: number; amountCents: number }, totalCents: number): string {
  return option.count === 1
    ? `1x de ${formatBRL(totalCents)} (à vista)`
    : `${option.count}x de ${formatBRL(option.amountCents)} sem juros`;
}

/**
 * Como a compra acontece. `demo` é o checkout de demonstração em 3 etapas (pré-visualização do
 * template). `redirect` é o Modo A: o botão de compra leva à URL do provedor (já validada pelo
 * backend); `url: null` = compra indisponível (oferta inativa ou domínio não mais autorizado).
 */
export type CheckoutMode =
  | { mode: 'demo' }
  | { mode: 'redirect'; url: string | null }
  /** Checkout hospedado da The Members embutido num iframe; `url: null` = compra indisponível. */
  | {
      mode: 'embed';
      url: string | null;
      /**
       * Rota pública que informa a situação do pagamento da visita (`GET <statusUrl>?ref=…`). Só a página pública passa
       * isto: sem ele (pré-visualização, editor) o iframe fica como estava e nada é consultado.
       */
      statusUrl?: string;
      /** Rota pública que registra a visita ao checkout (`POST`): contexto do navegador ligado ao código da visita. */
      sessionUrl?: string;
      /** Slug do curso, para a visita registrada saber de qual curso é. */
      courseSlug?: string;
    };

export type RenderContext = {
  offer: OfferView;
  /** Ausente = `demo`. */
  checkout?: CheckoutMode;
  /** Ano exibido no rodapé; vem do servidor para não divergir na hidratação. */
  year: number;
  /** Profissional dono do curso: habilita o link de volta aos outros cursos dele (só páginas de curso). */
  professional?: { slug: string; name: string };
};

/** Oferta vazia para páginas que não vendem (Home, Profissional). Nunca é exibida. */
export const NO_OFFER: OfferView = { listCents: 0, discountPct: 0, discountCents: 0, totalCents: 0, installments: [] };
