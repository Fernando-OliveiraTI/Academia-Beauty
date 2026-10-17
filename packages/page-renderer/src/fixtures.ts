import type { OfferView } from './offer';

/** Oferta de exemplo para testes e pré-visualização. Em produção o backend entrega esta visão. */
export const sampleOffer: OfferView = {
  listCents: 25000,
  discountPct: 30,
  discountCents: 7500,
  totalCents: 17500,
  installments: [
    { count: 1, amountCents: 17500 },
    { count: 2, amountCents: 8750 },
    { count: 3, amountCents: 5833 },
    { count: 4, amountCents: 4375 },
    { count: 5, amountCents: 3500 },
    { count: 6, amountCents: 2917 },
  ],
};
