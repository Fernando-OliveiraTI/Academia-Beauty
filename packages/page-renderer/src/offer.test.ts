import { describe, expect, it } from 'vitest';
import { computeOffer } from '@academia/contracts';
import { cardPriceTexts, offerTexts } from './offer';
import { professionalCourseCards } from './course/build';
import { homeCourseItems } from './home/build';

const withDisplay = (priceDisplay?: 'full' | 'from_to' | 'percent_off' | 'standard', discountPct = 30) =>
  offerTexts(computeOffer({ listCents: 50000, discountPct, maxInstallments: 6, priceDisplay }));

describe('formato do preço (página e checkout)', () => {
  it('sem formato (ofertas antigas) = completo: preço riscado e selo, como sempre', () => {
    const t = withDisplay(undefined);
    expect([t.showOld, t.showBadge, t.showSummaryDiscount]).toEqual([true, true, true]);
  });
  it('de/por: preço riscado sem selo', () => {
    const t = withDisplay('from_to');
    expect([t.showOld, t.showBadge, t.showSummaryDiscount]).toEqual([true, false, true]);
  });
  it('% OFF: selo sem o preço riscado', () => {
    const t = withDisplay('percent_off');
    expect([t.showOld, t.showBadge, t.showSummaryDiscount]).toEqual([false, true, true]);
  });
  it('preço padrão: só o valor final, sem destacar desconto', () => {
    const t = withDisplay('standard');
    expect([t.showOld, t.showBadge, t.showSummaryDiscount]).toEqual([false, false, false]);
    expect(t.total).toBe('R$ 350,00');
  });
  it('sem desconto nenhum formato mostra riscado ou selo', () => {
    for (const display of ['full', 'from_to', 'percent_off', 'standard'] as const) {
      const t = withDisplay(display, 0);
      expect([t.showOld, t.showBadge, t.showSummaryDiscount]).toEqual([false, false, false]);
    }
  });
});

describe('formato do preço (cards)', () => {
  const card = { listCents: 50000, totalCents: 35000, discountPct: 30 };
  it('cada formato escolhe o que o card mostra', () => {
    expect(cardPriceTexts({ ...card, priceDisplay: 'full' })).toEqual({ price: 'R$ 350,00', priceOld: 'R$ 500,00', badge: '30% OFF' });
    expect(cardPriceTexts({ ...card, priceDisplay: 'from_to' })).toEqual({ price: 'R$ 350,00', priceOld: 'R$ 500,00' });
    expect(cardPriceTexts({ ...card, priceDisplay: 'percent_off' })).toEqual({ price: 'R$ 350,00', badge: '30% OFF' });
    expect(cardPriceTexts({ ...card, priceDisplay: 'standard' })).toEqual({ price: 'R$ 350,00' });
  });
  it('sem oferta cadastrada não há preço; o selo antigo continua valendo', () => {
    expect(cardPriceTexts({ discountPct: 30 })).toEqual({ badge: '30% OFF' });
    expect(cardPriceTexts({ discountPct: 0 })).toEqual({});
  });
  it('página do profissional e Home recebem o mesmo texto', () => {
    const pro = professionalCourseCards([{ slug: 'c', title: 'Curso X', coverSrc: '/a.png', coverAlt: '', ...card, priceDisplay: 'percent_off' }], 'Ana');
    expect(pro[0]).toMatchObject({ price: 'R$ 350,00', badge: '30% OFF' });
    expect(pro[0]).not.toHaveProperty('priceOld');
    const home = homeCourseItems([{ slug: 'c', title: 'Curso X', person: 'Ana', coverSrc: '/a.png', coverAlt: '', featured: false, modality: 'online', ...card, priceDisplay: 'from_to' }]);
    expect(home[0]).toMatchObject({ price: 'R$ 350,00', priceOld: 'R$ 500,00' });
    expect(home[0]!.tags.map((t) => t.label)).not.toContain('30% OFF');
  });
});
