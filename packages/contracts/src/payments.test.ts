import { describe, expect, it } from 'vitest';
import { PAYMENT_EVENT_LABEL, PAYMENT_STATUS_LABEL, paymentTone } from './payments.js';

describe('pagamentos · rótulos e tom', () => {
  it('todo evento documentado da The Members tem rótulo em português', () => {
    for (const event of [
      'transaction.approved', 'transaction.failed', 'transaction.refunded', 'transaction.charged_back', 'transaction.pending_refund',
      'transaction.payment_cc_initiated', 'transaction.pix_generated', 'transaction.boleto_generated',
      'order.completed', 'order.canceled', 'order.expired', 'release.access', 'revoke.access', 'abandoned',
    ]) expect(PAYMENT_EVENT_LABEL[event], event).toBeTruthy();
  });

  it('os status tratados têm rótulo e tom coerente (aprovado ok; recusa/estorno ruim; aguardando alerta)', () => {
    expect(PAYMENT_STATUS_LABEL.approved).toBe('Aprovado');
    expect(paymentTone('approved')).toBe('ok');
    expect(paymentTone('failed')).toBe('bad');
    expect(paymentTone('refunded')).toBe('bad');
    expect(paymentTone('charged_back')).toBe('bad');
    expect(paymentTone('pending')).toBe('warn');
    expect(paymentTone('processing')).toBe('warn');
    expect(paymentTone(null)).toBe('neutral');
    expect(paymentTone('desconhecido')).toBe('neutral');
  });
});
