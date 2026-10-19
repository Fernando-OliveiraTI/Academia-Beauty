import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from './Accordion';
import { Checkout } from './Checkout';
import { CourseProvider } from './state';
import { courseOriginalTemplate } from '../index';
import { sampleOffer } from '../fixtures';
import type { CheckoutContent } from './schemas';

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({
    matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    onchange: null, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Accordion', () => {
  const items = [{ title: 'A', text: 'a1' }, { title: 'B', text: 'b1' }];
  it('abre um item por vez e fecha ao clicar no aberto', async () => {
    const user = userEvent.setup();
    render(<Accordion items={items} idPrefix="t" defaultOpen={0} />);
    const [a, b] = screen.getAllByRole('button');
    expect(a).toHaveAttribute('aria-expanded', 'true');
    await user.click(b!);
    expect(a).toHaveAttribute('aria-expanded', 'false');
    expect(b).toHaveAttribute('aria-expanded', 'true');
    await user.click(b!);
    expect(b).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Checkout', () => {
  const content = courseOriginalTemplate.sections.find((s) => s.type === 'course.checkout')!.content as CheckoutContent;
  const setup = () => {
    const user = userEvent.setup();
    render(<CourseProvider><Checkout content={content} offer={sampleOffer} /></CourseProvider>);
    return user;
  };

  it('bloqueia a etapa 1 com campos inválidos e informa quantos faltam', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: /Continuar para o pagamento/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Faltam ajustar 4 campos para continuar.');
    expect(screen.getByLabelText('Nome completo')).toHaveAttribute('aria-invalid', 'true');
  });

  it('aplica máscara de CPF e celular enquanto digita', async () => {
    const user = setup();
    await user.type(screen.getByLabelText(/CPF/), '52998224725');
    await user.type(screen.getByLabelText('Celular com DDD'), '11987654321');
    expect(screen.getByLabelText(/CPF/)).toHaveValue('529.982.247-25');
    expect(screen.getByLabelText('Celular com DDD')).toHaveValue('(11) 98765-4321');
  });

  it('avança para o pagamento com dados válidos e não envia nada ao finalizar', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = setup();
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Souza');
    await user.type(screen.getByLabelText('E-mail'), 'maria@email.com');
    await user.type(screen.getByLabelText(/CPF/), '52998224725');
    await user.type(screen.getByLabelText('Celular com DDD'), '11987654321');
    await user.click(screen.getByRole('button', { name: /Continuar para o pagamento/ }));
    expect(screen.getByText('Escolha como prefere pagar.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Finalizar compra/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('O pagamento ainda não está disponível');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('lista as parcelas vindas da oferta', () => {
    setup();
    expect(screen.getByRole('option', { name: '6x de R$ 29,17 sem juros', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '1x de R$ 175,00 (à vista)', hidden: true })).toBeInTheDocument();
  });
});

describe('Checkout em Modo A (redirecionamento)', () => {
  const base = courseOriginalTemplate.sections.find((s) => s.type === 'course.checkout')!.content as CheckoutContent;
  const URL = 'https://pay.example.com/c/1';
  const setup = (content: CheckoutContent = base, url: string | null = URL) => {
    const user = userEvent.setup();
    render(<CourseProvider checkout={{ mode: 'redirect', url }}><Checkout content={content} offer={sampleOffer} /></CourseProvider>);
    return user;
  };

  it('segue dados → pagamento → confirmação e o botão final leva ao link, sem enviar nada', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = setup();
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Souza');
    await user.type(screen.getByLabelText('E-mail'), 'maria@email.com');
    await user.type(screen.getByLabelText(/CPF/), '52998224725');
    await user.type(screen.getByLabelText('Celular com DDD'), '11987654321');
    await user.click(screen.getByRole('button', { name: /Continuar para o pagamento/ }));
    expect(screen.queryByLabelText('Número do cartão')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Revisar pedido/ }));
    const go = screen.getByRole('link', { name: /Ir para o pagamento seguro/ });
    expect(go).toHaveAttribute('href', URL);
    expect(go).toHaveAttribute('rel', 'noopener noreferrer');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sem link válido o botão final fica indisponível', async () => {
    const user = setup(base, null);
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Souza');
    await user.type(screen.getByLabelText('E-mail'), 'maria@email.com');
    await user.type(screen.getByLabelText(/CPF/), '52998224725');
    await user.type(screen.getByLabelText('Celular com DDD'), '11987654321');
    await user.click(screen.getByRole('button', { name: /Continuar para o pagamento/ }));
    await user.click(screen.getByRole('button', { name: /Revisar pedido/ }));
    expect(screen.queryByRole('link', { name: /Ir para o pagamento seguro/ })).toBeNull();
    expect(screen.getByText('A compra deste curso está temporariamente indisponível.')).toBeInTheDocument();
  });

  it('campos configuráveis: rótulo próprio, opcional vazio passa e obrigatório vazio bloqueia', async () => {
    const content: CheckoutContent = {
      ...base,
      buyerFields: [
        { type: 'email', label: 'Seu melhor e-mail', placeholder: '', help: '', required: true },
        { type: 'text', label: 'Instagram', placeholder: '@perfil', help: '', required: false },
      ],
    };
    const user = setup(content);
    expect(screen.queryByLabelText('Nome completo')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Continuar para o pagamento/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Falta ajustar um campo');
    await user.type(screen.getByLabelText(/Seu melhor e-mail/), 'maria@email.com');
    await user.click(screen.getByRole('button', { name: /Continuar para o pagamento/ }));
    expect(screen.getByText('Escolha como prefere pagar.')).toBeVisible();
  });
});


describe('Checkout embutido (The Members)', () => {
  const base = courseOriginalTemplate.sections.find((s) => s.type === 'course.checkout')!.content as CheckoutContent;
  const draw = (url: string | null) =>
    render(<CourseProvider checkout={{ mode: 'embed', url }}><Checkout content={base} offer={sampleOffer} /></CourseProvider>);

  it('mostra o iframe da The Members no lugar do formulário da Academia', () => {
    const { container } = draw('https://pay.example.com/c/1');
    const frame = container.querySelector('iframe');
    expect(frame).toHaveAttribute('src', 'https://pay.example.com/c/1');
    expect(frame?.getAttribute('sandbox')).not.toContain('allow-top-navigation ');
    expect(screen.queryByLabelText('Nome completo')).toBeNull();
    expect(container.querySelector('#checkout-form')).toBeNull();
  });

  it.each([null, 'http://pay.example.com/c/1', 'javascript:alert(1)'])('sem URL https (%s) não cria iframe e avisa que está indisponível', (url) => {
    const { container } = draw(url);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/indispon/i);
  });
});
