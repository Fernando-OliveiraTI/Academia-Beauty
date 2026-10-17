/* ==========================================================================
   Camada de integração com o gateway de pagamento
   --------------------------------------------------------------------------
   Toda comunicação de pagamento passa por aqui. A interface (script.js)
   só conhece estas três funções:

     CheckoutGateway.tokenizeCard(card)   -> { token, brand, last4 }
     CheckoutGateway.createOrder(payload) -> resultado do pedido
     CheckoutGateway.configure(options)

   MODO ATUAL: "mock" (demonstração). Nenhum dado sai do navegador e
   nenhum pagamento real é processado.

   PARA INTEGRAR DE VERDADE (ex.: Pagar.me, Mercado Pago, Stripe, Asaas):
   1. Carregue o SDK do gateway no index.html.
   2. Em tokenizeCard(), troque o mock pela tokenização do SDK. O número
      do cartão NUNCA deve ir para o seu servidor, só o token.
   3. Em createOrder(), faça POST para o SEU backend (config.endpoint).
      O backend usa a chave secreta do gateway para criar a cobrança e
      devolve o formato de resposta documentado abaixo.
   4. Chame CheckoutGateway.configure({ mode: 'live', ... }).
   ========================================================================== */
(function (global) {
  'use strict';

  const config = {
    mode: 'mock',                 // 'mock' | 'live'
    endpoint: '/api/checkout',    // rota do seu backend
    publicKey: '',                // chave pública do gateway (tokenização)
    timeoutMs: 20000
  };

  /* ------------------------------------------------------------------------
     Formato de resposta esperado de createOrder():
     {
       status: 'approved' | 'pending' | 'declined',
       method: 'card' | 'pix' | 'boleto',
       orderId: string,
       message?: string,                                 // para 'declined'
       pix?:    { qrCodeSvg?: string, copyPaste: string, expiresAt: ISOString },
       boleto?: { digitableLine: string, url: string, dueDate: ISOString }
     }
     ---------------------------------------------------------------------- */

  function configure(options) {
    Object.assign(config, options || {});
  }

  async function tokenizeCard(card) {
    if (config.mode === 'mock') return mockTokenize(card);
    // Exemplo: return await GatewaySDK.createCardToken({ ...card, publicKey: config.publicKey });
    throw new Error('Tokenização real não configurada.');
  }

  async function createOrder(payload) {
    if (config.mode === 'mock') return mockCreateOrder(payload);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!res.ok) throw new Error('Falha ao comunicar com o servidor de pagamento.');
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /* ------------------------------------------------------------------------
     Mock: simula latência e respostas do gateway
     - Cartão terminado em 0002 -> recusado (para testar o estado de erro)
     - Qualquer outro cartão válido -> aprovado
     ---------------------------------------------------------------------- */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const randomId = (prefix) => prefix + '_' + Math.random().toString(36).slice(2, 10).toUpperCase();

  async function mockTokenize(card) {
    await wait(350);
    const digits = String(card.number || '').replace(/\D/g, '');
    return { token: randomId('tok_demo'), brand: card.brand || 'card', last4: digits.slice(-4) };
  }

  async function mockCreateOrder(payload) {
    await wait(1400);
    const orderId = randomId('AB');

    if (payload.method === 'card') {
      if (payload.card && payload.card.last4 === '0002') {
        return { status: 'declined', method: 'card', orderId, message: 'O banco emissor recusou a transação. Tente outro cartão ou pague com PIX.' };
      }
      return { status: 'approved', method: 'card', orderId };
    }

    if (payload.method === 'pix') {
      return {
        status: 'pending', method: 'pix', orderId,
        pix: {
          copyPaste: '00020126580014BR.GOV.BCB.PIX0136demo-academia-beauty-' + orderId + '5204000053039865406' + payload.amount.toFixed(2) + '5802BR5915ACADEMIA BEAUTY6009SAO PAULO6304DEMO',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        }
      };
    }

    const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return {
      status: 'pending', method: 'boleto', orderId,
      boleto: {
        digitableLine: '00190.00009 01234.567890 12345.678901 9 ' + String(Math.round(payload.amount * 100)).padStart(14, '0'),
        url: '#',
        dueDate: due.toISOString()
      }
    };
  }

  global.CheckoutGateway = Object.freeze({ configure, tokenizeCard, createOrder, get mode() { return config.mode; } });
})(window);
