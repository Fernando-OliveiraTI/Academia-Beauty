import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Checkout } from './Checkout';
import { CourseProvider } from './state';
import { courseOriginalTemplate } from '../index';
import { sampleOffer } from '../fixtures';
import { checkoutSchema } from './schemas';
import { newVisitRef, pollDelay, withVisitRef } from './checkout-status';

const content = checkoutSchema.parse(courseOriginalTemplate.sections.find((s) => s.type === 'course.checkout')!.content);
const STATUS = '/api/public/checkout-status';
const URL_ = 'https://pay.example.com/c/1';
type Reply = { status: string; method: string | null };

function draw(statusUrl: string | null = STATUS, url: string = URL_) {
  return render(<CourseProvider checkout={{ mode: 'embed', url, statusUrl: statusUrl ?? undefined }}><Checkout content={content} offer={sampleOffer} /></CourseProvider>);
}
const replyWith = (...replies: Reply[]) => {
  let n = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    const body = replies[Math.min(n++, replies.length - 1)]!;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
};
const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({
    matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    onchange: null, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => { vi.useFakeTimers(); sessionStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('código da visita e URL do checkout', () => {
  it('newVisitRef tem o formato ab_ + 20 caracteres e muda a cada chamada', () => {
    const a = newVisitRef();
    expect(a).toMatch(/^ab_[a-z0-9]{20}$/);
    expect(newVisitRef()).not.toBe(a);
  });

  it('withVisitRef põe o código em utm_content e mantém os parâmetros do próprio link', () => {
    const out = new URL(withVisitRef('https://pay.example.com/c/1?cupom=abc&utm_source=meu', 'ab_k3j9x0q2m7v5n1c8w4zt'));
    expect(out.searchParams.get('utm_content')).toBe('ab_k3j9x0q2m7v5n1c8w4zt');
    expect(out.searchParams.get('cupom')).toBe('abc');
    expect(out.searchParams.get('utm_source')).toBe('meu');
    expect(out.searchParams.get('utm_medium')).toBe('site');
    expect(withVisitRef('não é url', 'ab_x')).toBe('não é url');
  });

  it('o intervalo de consulta cresce com o tempo', () => {
    expect(pollDelay(0)).toBe(4000);
    expect(pollDelay(5 * 60_000)).toBe(8000);
    expect(pollDelay(30 * 60_000)).toBe(20000);
  });
});

describe('checkout embutido com acompanhamento do pagamento', () => {
  it('o iframe carrega com o código da visita na URL e o mesmo código é guardado na aba', async () => {
    replyWith({ status: 'none', method: null });
    const { container } = draw();
    await flush();
    const src = new URL(container.querySelector('iframe')!.getAttribute('src')!);
    expect(src.searchParams.get('utm_content')).toMatch(/^ab_[a-z0-9]{20}$/);
    expect(sessionStorage.getItem('ab:checkout-ref')).toBe(src.searchParams.get('utm_content'));
  });

  it('consulta a situação com o código e, ao aprovar, troca o iframe pela confirmação e para de consultar', async () => {
    const spy = replyWith({ status: 'none', method: null }, { status: 'approved', method: null });
    const { container } = draw();
    await flush();
    const ref = new URL(container.querySelector('iframe')!.getAttribute('src')!).searchParams.get('utm_content')!;
    expect(String(spy.mock.calls[0]![0])).toBe(`${STATUS}?ref=${ref}`);
    expect(container.querySelector('iframe')).not.toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(screen.getByRole('status')).toHaveTextContent('Pagamento confirmado!');
    expect(container.querySelector('iframe')).toBeNull();
    const calls = spy.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(spy.mock.calls.length).toBe(calls);
  });

  it('pix gerado mostra o aviso de espera e mantém o iframe (o QR Code está nele)', async () => {
    replyWith({ status: 'waiting', method: 'pix' });
    const { container } = draw();
    await flush();
    expect(screen.getByRole('status')).toHaveTextContent(/Pix/);
    expect(container.querySelector('iframe')).not.toBeNull();
  });

  it('boleto gerado mostra o texto do boleto', async () => {
    replyWith({ status: 'waiting', method: 'boleto' });
    draw();
    await flush();
    expect(screen.getByRole('status')).toHaveTextContent(/boleto/i);
  });

  it('pagamento recusado avisa e deixa tentar de novo no mesmo iframe', async () => {
    replyWith({ status: 'failed', method: null });
    const { container } = draw();
    await flush();
    expect(screen.getByRole('status')).toHaveTextContent(/não foi aprovado/);
    expect(container.querySelector('iframe')).not.toBeNull();
  });

  it('erro de rede é ignorado e a próxima consulta tenta de novo', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(new Response(JSON.stringify({ status: 'approved', method: null }), { status: 200 }));
    draw();
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('Pagamento confirmado!');
  });

  it('sem statusUrl (pré-visualização, editor) nada é consultado e o iframe fica com a URL original', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const { container } = draw(null);
    await flush();
    expect(spy).not.toHaveBeenCalled();
    expect(container.querySelector('iframe')).toHaveAttribute('src', URL_);
  });

  it('textos editados no documento aparecem no lugar dos padrões', async () => {
    replyWith({ status: 'approved', method: null });
    render(<CourseProvider checkout={{ mode: 'embed', url: URL_, statusUrl: STATUS }}><Checkout content={{ ...content, paidTitle: 'Bem-vinda!', paidText: 'Acesso a caminho.' }} offer={sampleOffer} /></CourseProvider>);
    await flush();
    expect(screen.getByRole('status')).toHaveTextContent('Bem-vinda!');
    expect(screen.getByRole('status')).toHaveTextContent('Acesso a caminho.');
  });
});
