/**
 * Visão da oferta que o renderer exibe. Os valores chegam prontos do backend (centavos):
 * o renderer só formata e nunca calcula nem aceita preço vindo do documento da página.
 */
export type OfferView = {
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
    maxInstallments: count,
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
  | { mode: 'embed'; url: string | null };

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
