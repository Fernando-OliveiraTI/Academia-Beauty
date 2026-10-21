/**
 * Como o valor do curso aparece (página, checkout e cards). Ausente em ofertas antigas = `full`, o comportamento de sempre.
 * Sem desconto (0%) todos mostram só o valor final.
 */
export const PRICE_DISPLAYS = ['full', 'from_to', 'percent_off', 'standard'] as const;
export type PriceDisplay = (typeof PRICE_DISPLAYS)[number];
export const PRICE_DISPLAY_LABEL: Readonly<Record<PriceDisplay, { label: string; hint: string }>> = {
  full: { label: 'Completo', hint: 'De R$ X por R$ Y e selo "N% OFF"' },
  from_to: { label: 'De / Por', hint: 'De R$ X por R$ Y, sem selo' },
  percent_off: { label: '% OFF', hint: 'Selo "N% OFF" e o valor final, sem o preço riscado' },
  standard: { label: 'Preço padrão', hint: 'Só o valor final, sem destacar o desconto' },
};
export const priceDisplayOf = (value: string | null | undefined): PriceDisplay =>
  (PRICE_DISPLAYS as readonly string[]).includes(value ?? '') ? (value as PriceDisplay) : 'full';
