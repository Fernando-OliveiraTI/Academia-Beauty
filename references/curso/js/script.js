/* ==========================================================================
   Morena Iluminada · interações da página e checkout (interface)
   A comunicação com pagamento fica isolada em js/gateway.js.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Configuração do produto: fonte única para todos os preços da página
     ---------------------------------------------------------------------- */
  const PRODUCT = {
    id: 'morena-iluminada',
    name: 'Morena Iluminada',
    instructor: 'Lukas Campos',
    listPrice: 250.00,
    discountPct: 30,          // desconto da oferta
    pixDiscountPct: 0,        // desconto extra no PIX (0 = sem desconto extra)
    maxInstallments: 6,       // parcelas sem juros
    currency: 'BRL'
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: PRODUCT.currency });
  const money = (v) => brl.format(v).replace(/ /g, ' ');
  const round2 = (v) => Math.round(v * 100) / 100;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------------
     Preços
     ---------------------------------------------------------------------- */
  function computePricing(method) {
    const discount = round2(PRODUCT.listPrice * PRODUCT.discountPct / 100);
    const subtotal = round2(PRODUCT.listPrice - discount);
    const methodDiscount = method === 'pix' ? round2(subtotal * PRODUCT.pixDiscountPct / 100) : 0;
    const total = round2(subtotal - methodDiscount);
    return { list: PRODUCT.listPrice, discount, methodDiscount, total, installment: round2(total / PRODUCT.maxInstallments) };
  }

  function renderPrices(method) {
    const p = computePricing(method);
    const values = {
      list: money(p.list),
      discount: '−' + money(p.discount),
      methodDiscount: '−' + money(p.methodDiscount),
      total: money(p.total),
      installments: `ou ${PRODUCT.maxInstallments}x de ${money(computePricing().installment)} sem juros`,
      installmentsShort: `${PRODUCT.maxInstallments}x de ${money(computePricing().installment)}`,
      summaryNote: method === 'pix' ? 'à vista no PIX' : method === 'boleto' ? 'à vista no boleto' : `à vista ou em até ${PRODUCT.maxInstallments}x`
    };
    $$('[data-price]').forEach((el) => { const v = values[el.dataset.price]; if (v) el.textContent = v; });
    $$('[data-discount-label]').forEach((el) => { el.textContent = `${PRODUCT.discountPct}% OFF`; });
    $$('[data-discount-pct]').forEach((el) => { el.textContent = `${PRODUCT.discountPct}%`; });
    const row = $('[data-method-discount-row]');
    if (row) row.hidden = !(method === 'pix' && p.methodDiscount > 0);
    return p;
  }

  function renderInstallments() {
    const select = $('#installments');
    if (!select) return;
    const { total } = computePricing('card');
    select.innerHTML = '';
    for (let n = 1; n <= PRODUCT.maxInstallments; n++) {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = n === 1 ? `1x de ${money(total)} (à vista)` : `${n}x de ${money(round2(total / n))} sem juros`;
      select.appendChild(opt);
    }
  }

  /* ------------------------------------------------------------------------
     Imagens: fallback local quando a imagem remota não carrega
     ---------------------------------------------------------------------- */
  function initImages() {
    $$('img[data-fallback]').forEach((img) => {
      const swap = () => { if (img.src.indexOf(img.dataset.fallback) === -1) img.src = img.dataset.fallback; };
      img.addEventListener('error', swap, { once: true });
      if (img.complete && img.naturalWidth === 0) swap();
    });
    $$('img[data-hide-on-error]').forEach((img) => {
      const hide = () => { img.hidden = true; };
      img.addEventListener('error', hide, { once: true });
      if (img.complete && img.naturalWidth === 0) hide();
    });
  }

  /* ------------------------------------------------------------------------
     Header, barra de progresso e link ativo
     ---------------------------------------------------------------------- */
  function initScrollUI() {
    const header = $('#header');
    const progress = $('.scroll-progress');
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      header.classList.toggle('is-scrolled', y > 24);
      progress.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    update();

    const links = $$('.nav a');
    const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }

  /* ------------------------------------------------------------------------
     Reveal on scroll: só esconde o que está abaixo da dobra no carregamento,
     então a página já é completa no primeiro quadro.
     ---------------------------------------------------------------------- */
  function initReveal() {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.remove('is-pending'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    $$('.reveal').forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.92) {
        el.classList.add('is-pending');
        io.observe(el);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Contadores (prova social)
     ---------------------------------------------------------------------- */
  function initCounters() {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) return;
    const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target;
        const end = parseFloat(el.dataset.count);
        const decimals = String(el.dataset.count).includes('.') ? 1 : 0;
        const pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
        const start = performance.now(), dur = 1100;
        const step = (t) => {
          const k = Math.min(1, (t - start) / dur);
          const eased = 1 - Math.pow(1 - k, 3);
          const v = decimals ? Math.round(end * eased * 10) / 10 : Math.round(end * eased);
          el.textContent = pre + fmt.format(v) + suf;
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------------
     Accordion (conteúdo e FAQ)
     ---------------------------------------------------------------------- */
  function initAccordions() {
    $$('[data-accordion]').forEach((acc) => {
      const items = $$('.acc-item', acc);
      items.forEach((item) => {
        const btn = $('.acc-trigger', item);
        btn.addEventListener('click', () => {
          const willOpen = !item.classList.contains('is-open');
          items.forEach((other) => {
            other.classList.remove('is-open');
            $('.acc-trigger', other).setAttribute('aria-expanded', 'false');
          });
          if (willOpen) { item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     CTA fixo no mobile: aparece depois do hero, some no checkout
     ---------------------------------------------------------------------- */
  function initStickyCTA() {
    const bar = $('#sticky-cta');
    const heroCta = $('#hero-cta');
    const checkout = $('#checkout');
    if (!bar || !('IntersectionObserver' in window)) return;
    const state = { heroVisible: true, checkoutVisible: false };
    const apply = () => {
      const show = !state.heroVisible && !state.checkoutVisible && currentStep !== 3;
      bar.classList.toggle('is-visible', show);
      bar.setAttribute('aria-hidden', String(!show));
      $('a', bar).tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { state.heroVisible = e.isIntersecting; apply(); }).observe(heroCta);
    new IntersectionObserver(([e]) => { state.checkoutVisible = e.isIntersecting; apply(); }, { rootMargin: '0px 0px -20% 0px' }).observe(checkout);
  }

  /* CTAs: rolagem suave até o checkout e foco no primeiro campo */
  function initCTAs() {
    $$('[data-cta]').forEach((a) => {
      a.addEventListener('click', (ev) => {
        const target = $('#checkout');
        if (!target) return;
        ev.preventDefault();
        target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        const first = $('#name');
        if (first && currentStep === 1) setTimeout(() => first.focus({ preventScroll: true }), prefersReducedMotion ? 0 : 650);
      });
    });
  }

  /* Resumo do pedido recolhível no mobile */
  function initSummary() {
    const summary = $('[data-summary]');
    const toggle = $('.summary-toggle', summary);
    const body = $('#summary-body');
    const desktop = window.matchMedia('(min-width: 900px)');
    const set = (open) => {
      summary.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      body.hidden = !open;
    };
    toggle.addEventListener('click', () => set(body.hidden));
    const sync = () => set(desktop.matches);
    desktop.addEventListener('change', sync);
    sync();
  }

  /* ------------------------------------------------------------------------
     Máscaras
     ---------------------------------------------------------------------- */
  const onlyDigits = (v) => v.replace(/\D/g, '');
  const masks = {
    cpf: (v) => onlyDigits(v).slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
    phone: (v) => {
      const d = onlyDigits(v).slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : '';
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    },
    cardNumber: (v) => onlyDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '),
    cardExpiry: (v) => { const d = onlyDigits(v).slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; },
    cardCvv: (v) => onlyDigits(v).slice(0, 4)
  };

  function cardBrand(num) {
    const d = onlyDigits(num);
    if (/^4/.test(d)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
    if (/^3[47]/.test(d)) return 'Amex';
    if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(d)) return 'Elo';
    if (/^(606282|3841)/.test(d)) return 'Hipercard';
    return '';
  }

  /* ------------------------------------------------------------------------
     Validação
     ---------------------------------------------------------------------- */
  function isValidCPF(value) {
    const c = onlyDigits(value);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    const calc = (len) => {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
      const r = (sum * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
  }

  function luhn(num) {
    const d = onlyDigits(num);
    if (d.length < 13) return false;
    let sum = 0, dbl = false;
    for (let i = d.length - 1; i >= 0; i--) {
      let n = Number(d[i]);
      if (dbl) { n *= 2; if (n > 9) n -= 9; }
      sum += n; dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  function validExpiry(v) {
    const m = /^(\d{2})\/(\d{2})$/.exec(v);
    if (!m) return false;
    const month = Number(m[1]), year = 2000 + Number(m[2]);
    if (month < 1 || month > 12) return false;
    const now = new Date();
    return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
  }

  const RULES = {
    name:       (v) => v.trim().split(/\s+/).filter((p) => p.length > 1).length >= 2 || 'Digite seu nome e sobrenome.',
    email:      (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Digite um e-mail válido, como voce@email.com.',
    cpf:        (v) => isValidCPF(v) || 'Este CPF não é válido. Confira os números.',
    phone:      (v) => { const d = onlyDigits(v); return (d.length === 10 || d.length === 11) || 'Digite o celular com DDD.'; },
    cardNumber: (v) => luhn(v) || 'Confira o número do cartão.',
    cardName:   (v) => v.trim().length >= 3 || 'Digite o nome como está no cartão.',
    cardExpiry: (v) => validExpiry(v) || 'Use o formato MM/AA com uma data futura.',
    cardCvv:    (v) => { const d = onlyDigits(v); return (d.length === 3 || d.length === 4) || 'O código tem 3 ou 4 dígitos.'; }
  };

  const STEP_FIELDS = { 1: ['name', 'email', 'cpf', 'phone'], card: ['cardNumber', 'cardName', 'cardExpiry', 'cardCvv'] };

  function validateField(id, { silent = false } = {}) {
    const input = document.getElementById(id);
    const field = input.closest('.field');
    const result = RULES[id](input.value);
    const ok = result === true;
    if (!silent) {
      field.classList.toggle('is-valid', ok);
      field.classList.toggle('is-invalid', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      $('#' + id + '-error').textContent = ok ? '' : result;
    }
    return ok;
  }

  function validateGroup(ids) {
    const invalid = ids.filter((id) => !validateField(id));
    return invalid;
  }

  /* ------------------------------------------------------------------------
     Checkout: etapas, método, envio
     ---------------------------------------------------------------------- */
  let currentStep = 1;
  let pixTimer = null;

  function showAlert(message) {
    const alert = $('#form-alert');
    $('[data-alert-text]', alert).textContent = message;
    alert.hidden = false;
    alert.focus({ preventScroll: true });
  }
  const hideAlert = () => { $('#form-alert').hidden = true; };

  function goToStep(step) {
    currentStep = step;
    $$('[data-pane]').forEach((p) => { p.hidden = Number(p.dataset.pane) !== step; });
    $$('[data-step-indicator]').forEach((s) => {
      const n = Number(s.dataset.stepIndicator);
      s.classList.toggle('is-active', n === step);
      s.classList.toggle('is-done', n < step);
      if (n === step) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
    });
    hideAlert();
    // Mantém o indicador de etapas no topo da tela ao trocar de etapa
    const steps = $('.steps');
    const top = steps.getBoundingClientRect().top;
    if (top < 60 || top > window.innerHeight * 0.35) steps.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function selectedMethod() {
    const checked = $('input[name="method"]:checked');
    return checked ? checked.value : 'card';
  }

  function initCheckout() {
    const form = $('#checkout-form');

    // Máscaras + feedback enquanto digita
    Object.keys(RULES).forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', () => {
        if (masks[id]) {
          const pos = input.value.length - input.selectionStart;
          input.value = masks[id](input.value);
          try { input.setSelectionRange(input.value.length - pos, input.value.length - pos); } catch (_) { /* tipo sem seleção */ }
        }
        if (id === 'cardNumber') $('[data-card-brand]').textContent = cardBrand(input.value);
        const field = input.closest('.field');
        if (field.classList.contains('is-invalid')) validateField(id);
        else if (validateField(id, { silent: true })) validateField(id);
        else field.classList.remove('is-valid');
      });
      input.addEventListener('blur', () => { if (input.value.trim()) validateField(id); });
    });

    // Etapa 1 -> 2
    $('[data-next]').addEventListener('click', () => {
      const invalid = validateGroup(STEP_FIELDS[1]);
      if (invalid.length) {
        showAlert(invalid.length === 1 ? 'Falta ajustar um campo para continuar.' : `Faltam ajustar ${invalid.length} campos para continuar.`);
        document.getElementById(invalid[0]).focus();
        return;
      }
      const firstName = $('#name').value.trim().split(/\s+/)[0];
      $('[data-buyer-line]').textContent = `Quase lá, ${firstName}. Escolha como prefere pagar.`;
      goToStep(2);
      $('#m-card').closest('.pay-methods').querySelector('input:checked').focus({ preventScroll: true });
    });

    $('[data-back]').addEventListener('click', () => { goToStep(1); $('#name').focus(); });

    // Enter na etapa 1 avança em vez de enviar
    $('[data-pane="1"]').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); $('[data-next]').click(); }
    });

    // Troca de método
    $$('input[name="method"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const m = selectedMethod();
        $$('[data-method-panel]').forEach((p) => { p.hidden = p.dataset.methodPanel !== m; });
        renderPrices(m);
        hideAlert();
      });
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (currentStep !== 2) return;
      const method = selectedMethod();

      if (method === 'card') {
        const invalid = validateGroup(STEP_FIELDS.card);
        if (invalid.length) {
          showAlert('Confira os dados do cartão destacados abaixo.');
          document.getElementById(invalid[0]).focus();
          return;
        }
      }

      const submit = $('[data-submit]');
      const label = $('[data-submit-label]');
      const originalLabel = label.innerHTML;
      submit.disabled = true;
      label.innerHTML = '<span class="spinner" aria-hidden="true"></span> Processando pagamento…';
      hideAlert();

      try {
        const pricing = computePricing(method);
        const payload = {
          productId: PRODUCT.id,
          amount: pricing.total,
          currency: PRODUCT.currency,
          method,
          installments: method === 'card' ? Number($('#installments').value) : 1,
          customer: {
            name: $('#name').value.trim(),
            email: $('#email').value.trim(),
            cpf: onlyDigits($('#cpf').value),
            phone: onlyDigits($('#phone').value)
          }
        };

        if (method === 'card') {
          // Apenas o token segue para o pedido; o número do cartão fica no gateway
          payload.card = await CheckoutGateway.tokenizeCard({
            number: $('#cardNumber').value,
            holder: $('#cardName').value,
            expiry: $('#cardExpiry').value,
            cvv: $('#cardCvv').value,
            brand: cardBrand($('#cardNumber').value)
          });
        }

        const result = await CheckoutGateway.createOrder(payload);

        if (result.status === 'declined') {
          showAlert(result.message || 'Pagamento não aprovado. Tente outro cartão ou escolha PIX.');
          return;
        }
        renderResult(result, payload);
        goToStep(3);
        $('[data-pane="3"]').focus({ preventScroll: true });
      } catch (err) {
        showAlert('Não conseguimos falar com o sistema de pagamento. Verifique sua conexão e tente de novo.');
      } finally {
        submit.disabled = false;
        label.innerHTML = originalLabel;
        renderPrices(selectedMethod());
      }
    });
  }

  /* ------------------------------------------------------------------------
     Tela de confirmação
     ---------------------------------------------------------------------- */
  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="draw" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderResult(result, payload) {
    const pane = $('[data-pane="3"]');
    const email = escapeHTML(payload.customer.email);
    const orderLine = `<span class="order-id">Pedido ${escapeHTML(result.orderId)}</span>`;
    const demo = CheckoutGateway.mode === 'mock' ? '<span class="badge">Simulação · nenhum valor foi cobrado</span>' : '';
    clearInterval(pixTimer);

    if (result.method === 'card') {
      pane.innerHTML = `
        <div class="result">
          <div class="result-icon">${ICON_CHECK}</div>
          <h3 style="font-size:1.5rem">Pagamento aprovado!</h3>
          <p>Enviamos o acesso ao curso <strong>${escapeHTML(PRODUCT.name)}</strong> para <strong>${email}</strong>. Entre em “Acessar conta” com esse e-mail para começar.</p>
          ${orderLine}${demo}
        </div>`;
      return;
    }

    if (result.method === 'pix') {
      pane.innerHTML = `
        <div class="result">
          <div class="result-icon is-pending"><svg aria-hidden="true"><use href="#i-pix"/></svg></div>
          <h3 style="font-size:1.5rem">Pague com PIX para liberar o acesso</h3>
          <p>Escaneie o QR Code no app do seu banco ou copie o código. Expira em <span class="timer" data-timer>30:00</span>.</p>
          <div class="pix-box">
            <div class="pix-qr" role="img" aria-label="QR Code PIX de demonstração">${fakeQR(result.pix.copyPaste)}</div>
            <div class="copy-field">
              <label class="visually-hidden" for="pix-code">Código PIX copia e cola</label>
              <input class="input" id="pix-code" readonly value="${escapeHTML(result.pix.copyPaste)}">
              <button class="btn btn--primary" type="button" data-copy="#pix-code">Copiar</button>
            </div>
          </div>
          <div class="alert alert--success" style="text-align:left;width:100%"><svg aria-hidden="true"><use href="#i-check"/></svg><p>Assim que o PIX for confirmado, o acesso chega em <strong>${email}</strong>.</p></div>
          ${orderLine}${demo}
        </div>`;
      startTimer($('[data-timer]', pane), new Date(result.pix.expiresAt));
    } else {
      const due = new Date(result.boleto.dueDate).toLocaleDateString('pt-BR');
      pane.innerHTML = `
        <div class="result">
          <div class="result-icon is-pending"><svg aria-hidden="true"><use href="#i-barcode"/></svg></div>
          <h3 style="font-size:1.5rem">Boleto gerado</h3>
          <p>Pague até <strong>${due}</strong>. Após a compensação, o acesso chega em <strong>${email}</strong>.</p>
          <div class="copy-field">
            <label class="visually-hidden" for="boleto-code">Linha digitável do boleto</label>
            <input class="input" id="boleto-code" readonly value="${escapeHTML(result.boleto.digitableLine)}">
            <button class="btn btn--primary" type="button" data-copy="#boleto-code">Copiar</button>
          </div>
          ${orderLine}${demo}
        </div>`;
    }
    $$('[data-copy]', pane).forEach(initCopyButton);
  }

  function initCopyButton(btn) {
    btn.addEventListener('click', () => {
      const input = $(btn.dataset.copy);
      const done = () => { btn.textContent = 'Copiado!'; setTimeout(() => { btn.textContent = 'Copiar'; }, 2000); };
      const fallback = () => { input.focus(); input.select(); btn.textContent = 'Selecionado'; setTimeout(() => { btn.textContent = 'Copiar'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(input.value).then(done, fallback);
      else fallback();
    });
  }

  function startTimer(el, until) {
    const tick = () => {
      const s = Math.max(0, Math.round((until - Date.now()) / 1000));
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      if (s === 0) clearInterval(pixTimer);
    };
    tick();
    pixTimer = setInterval(tick, 1000);
  }

  /* Padrão visual de QR para a demonstração (não é um QR Code legível).
     Na integração real, use o qrCodeSvg/imagem devolvido pelo gateway. */
  function fakeQR(seed) {
    const n = 25;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
    const finder = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
    let cells = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!finder(x, y) && rnd() > 0.52) cells += `M${x} ${y}h1v1h-1z`;
    const eye = (x, y) => `<path d="M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5z" fill-rule="evenodd"/><path d="M${x + 2} ${y + 2}h3v3h-3z"/>`;
    return `<svg viewBox="0 0 ${n} ${n}" width="100%" height="100%" shape-rendering="crispEdges" fill="#111">${eye(0, 0)}${eye(n - 7, 0)}${eye(0, n - 7)}<path d="${cells}"/></svg>`;
  }

  /* ------------------------------------------------------------------------
     Inicialização
     ---------------------------------------------------------------------- */
  function init() {
    renderPrices('card');
    renderInstallments();
    initImages();
    initScrollUI();
    initReveal();
    initCounters();
    initAccordions();
    initStickyCTA();
    initCTAs();
    initSummary();
    initCheckout();
    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
