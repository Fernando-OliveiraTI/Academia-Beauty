import { describe, expect, it } from 'vitest';
import {
  commercialInputSchema,
  commercialReadiness,
  computeOffer,
  courseDataSchema,
  courseReadiness,
  parseAllowedHosts,
  validateCheckoutUrl,
  type CommercialInput,
} from './index';

const hosts = parseAllowedHosts('Pay.Example.com, *.members.test');

describe('computeOffer', () => {
  it('calcula desconto e total em centavos', () => {
    const o = computeOffer({ listCents: 25000, discountPct: 30, maxInstallments: 6 });
    expect(o).toMatchObject({ discountCents: 7500, totalCents: 17500 });
    expect(o.installments[0]).toEqual({ count: 1, amountCents: 17500 });
    expect(o.installments).toHaveLength(6);
  });

  it('a parcela nunca faz a soma passar do total (sem o centavo a mais do protótipo)', () => {
    for (const total of [17500, 9999, 12345, 100000]) {
      const o = computeOffer({ listCents: total, discountPct: 0, maxInstallments: 12 });
      for (const i of o.installments) {
        expect(i.count * i.amountCents).toBeLessThanOrEqual(total);
        expect(total - i.count * i.amountCents).toBeLessThan(i.count);
      }
    }
  });

  it('sem desconto: total = lista; descarta parcelas abaixo do mínimo', () => {
    const o = computeOffer({ listCents: 1000, discountPct: 0, maxInstallments: 12 });
    expect(o.discountCents).toBe(0);
    expect(o.totalCents).toBe(1000);
    expect(o.installments.map((i) => i.count)).toEqual([1, 2]);
  });
});

describe('validateCheckoutUrl', () => {
  it('aceita https do host exato e, só com curinga explícito, de subdomínios', () => {
    expect(validateCheckoutUrl('https://pay.example.com/c/abc?x=1', hosts)).toMatchObject({ ok: true });
    expect(validateCheckoutUrl('https://loja.members.test/p', hosts)).toMatchObject({ ok: true });
    // sem curinga, subdomínio do host listado NÃO vale (domínio compartilhado de outro vendedor)
    expect(validateCheckoutUrl('https://outro.pay.example.com/c', hosts).ok).toBe(false);
    // o curinga não cobre o domínio raiz
    expect(validateCheckoutUrl('https://members.test/p', hosts).ok).toBe(false);
  });

  it.each([
    ['http://pay.example.com/c', 'http'],
    ['javascript:alert(1)', 'javascript'],
    ['//pay.example.com/c', 'sem esquema'],
    ['https://evil.com/pay.example.com', 'host fora da lista'],
    ['https://pay.example.com.evil.com/c', 'sufixo enganoso'],
    ['https://evilpay.example.com.br/c', 'prefixo enganoso'],
    ['https://user:pw@pay.example.com/c', 'credenciais'],
    ['https://pay.example.com:8443/c', 'porta'],
    ['https://127.0.0.1/c', 'IP'],
    ['https://localhost/c', 'localhost'],
    ['https://[::1]/c', 'IPv6'],
    ['pay.example.com', 'sem esquema'],
  ])('recusa %s (%s)', (url) => {
    expect(validateCheckoutUrl(url, hosts).ok).toBe(false);
  });

  it('sem lista autorizada nada é aceito', () => {
    expect(validateCheckoutUrl('https://pay.example.com/c', []).ok).toBe(false);
  });

  it('aceita o mesmo domínio com porta 443 explícita e maiúsculas', () => {
    expect(validateCheckoutUrl('https://PAY.example.com:443/c', hosts)).toMatchObject({ ok: true });
  });
});

describe('readiness', () => {
  const base: CommercialInput = { listCents: 25000, discountPct: 0, maxInstallments: 1, checkoutUrl: 'https://pay.example.com/c', provider: 'academia', externalCourseId: '', environment: 'production', active: true };

  it('curso vazio lista pendências; curso completo não', () => {
    const empty = courseDataSchema.parse({ title: 'Curso X' });
    expect(courseReadiness(empty).map((i) => i.field)).toEqual(
      expect.arrayContaining(['lead', 'audience', 'coverSrc', 'coverAlt', 'benefits', 'modules', 'deliverables'])
    );
    const full = courseDataSchema.parse({
      title: 'Curso X', lead: 'Descrição.', audience: 'Cabeleireiros', coverSrc: '/site/c.png', coverAlt: 'Capa',
      benefits: [{ title: 'A', text: 'B' }], modules: [{ title: 'M' }], deliverables: [{ title: 'D', text: 'E' }],
    });
    expect(courseReadiness(full)).toEqual([]);
  });

  it('oferta exige configuração ativa e link autorizado', () => {
    expect(commercialReadiness(null, hosts)).toHaveLength(1);
    expect(commercialReadiness(base, hosts)).toEqual([]);
    expect(commercialReadiness({ ...base, active: false }, hosts).map((i) => i.field)).toEqual(['active']);
    expect(commercialReadiness({ ...base, checkoutUrl: '' }, hosts).map((i) => i.field)).toEqual(['checkoutUrl']);
    expect(commercialReadiness({ ...base, checkoutUrl: 'https://outro.com/c' }, hosts).map((i) => i.field)).toEqual(['checkoutUrl']);
  });
});

describe('courseDataSchema', () => {
  it('recusa marcação e exige título', () => {
    expect(courseDataSchema.safeParse({ title: '<b>x</b>' }).success).toBe(false);
    expect(courseDataSchema.safeParse({ title: 'ab' }).success).toBe(false);
    expect(courseDataSchema.safeParse({ title: 'Curso', faq: [{ title: 'p', text: '<script>' }] }).success).toBe(false);
  });
});

describe('provedor de checkout', () => {
  const input = { listCents: 25000, discountPct: 0, maxInstallments: 1, checkoutUrl: '', environment: 'production', active: false };

  it('oferta sem provedor (antiga) vale como Academia', () => {
    expect(commercialInputSchema.parse(input).provider).toBe('academia');
  });

  it('aceita The Members e recusa provedor desconhecido', () => {
    expect(commercialInputSchema.parse({ ...input, provider: 'themembers' }).provider).toBe('themembers');
    expect(commercialInputSchema.safeParse({ ...input, provider: 'outro' }).success).toBe(false);
  });
});
