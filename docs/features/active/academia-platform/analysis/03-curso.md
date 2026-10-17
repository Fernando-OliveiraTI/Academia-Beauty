# 03 · Análise técnica da página de curso (Morena Iluminada)

Escopo: análise somente leitura de `/Users/fernandomartins/Downloads/pagina-navalha/` (o arquivo real é `index.html`, não `inde.html`). Nenhum arquivo de origem foi alterado.

Arquivos lidos por inteiro: `index.html` (658 linhas), `css/style.css` (946), `js/script.js` (602), `js/gateway.js` (121), `README.md` (22), `ANALISE.md` (30). Os 3 SVG de `assets/` foram inspecionados apenas por cabeçalho e tamanho (não renderizados, não verifiquei o desenho). Nada foi executado em navegador: tudo abaixo vem de leitura estática. Onde digo "não verificado", é porque depende de execução ou de fonte externa.

Convenção: `L123` = linha do arquivo citado. HTML = `index.html`, CSS = `css/style.css`, JS = `js/script.js`, GW = `js/gateway.js`.

---

## 1. Diagnóstico geral

### 1.1 Estrutura
- Página única estática (HTML + 1 CSS + 2 JS, sem build). JS em IIFE, sem módulos; `GW` expõe `window.CheckoutGateway` (frozen).
- Fluxo de venda (ANALISE.md L19): hero, fatos, problema/benefícios, conteúdo (accordion), entrega, instrutor, prova social, oferta, FAQ, checkout de 3 etapas, garantia, CTA final, footer, CTA fixo mobile.
- Dark theme único (`color-scheme: dark`, CSS L8). Não há tema claro.
- Não há menu mobile: `.nav` é `display:none` abaixo de 900px (CSS L303) e não existe botão hambúrguer. No mobile o header tem só marca + botão "Garantir acesso".
- Não há `og:*`, canonical, JSON-LD, analytics, pixel, banner de cookies, nem links de Termos/Privacidade. Há só `title`, `description` e `theme-color` (HTML L6-8).
- Referências a "Acessar conta" (HTML L367, L506 via JS) apontam para um botão/link que não existe na página.

### 1.2 O que é conteúdo real e o que é exemplo, inferido ou inventado
Fonte de verdade: `ANALISE.md` e comentários no HTML. Não consegui verificar nada contra a página original da Shopify (sem acesso), então "real" significa "declarado como vindo da página original/referência Lukas_20 em ANALISE.md L8-10".

| Item | Onde | Classificação |
|---|---|---|
| Nome do curso, instrutor, preço de lista R$ 250,00, desconto 30% | HTML L6, L81, L103; JS L11-20 | Declarado como mantido do original (ANALISE L8). Confirmar com o negócio. |
| 4 pontos do conteúdo programático (títulos) | HTML L197, 206, 215, 224 | Declarado como original (ANALISE L9). |
| Subitens (3 bullets por módulo) e textos de apoio dos módulos | HTML L201, 210, 219, 228 | Não listado em ANALISE como original nem como "incluído". Provável elaboração de copy. Confirmar. |
| Bio: 15 anos, 53,6 mil seguidores, ROM CONCEPT, cursos no exterior | HTML L76, 118, 122, 299-301, 281-284 | Declarado como real (ANALISE L10). O número de seguidores é dado datado. |
| Nomes de celebridades atendidas e "modelos da Victoria's Secret" | HTML L281 | Afirmação de terceiros. Exige comprovação/autorização do instrutor antes de publicar (não verificado). |
| "+6 países" e lista Moscou, Berlim, Istambul, Londres, EUA, Portugal | HTML L301, L284 | Inconsistente: a lista tem 4 cidades e 2 países; "+6 países" não bate com ela. Confirmar a fonte. |
| Depoimentos (3) | HTML L304-322 | PLACEHOLDER explícito: comentário L304, badge "Depoimentos de exemplo · substituir pelos reais" (L322). Nomes são "Aluna/Aluno". Não publicar. |
| Garantia de 7 dias (selo, FAQ, ficha, oferta, trust-row) | L96, 263, 332, 348, 379, 422, 599, 604, 609 | Escrita pelo autor "a partir do que é padrão" (ANALISE L28). Não é termo comercial confirmado. Precisa de decisão do negócio e revisão jurídica. |
| FAQ (5 perguntas) | HTML L365-384 | Escrita pelo autor (ANALISE L28). Várias respostas dependem de fatos ainda desconhecidos (formas de pagamento, redirecionamento, liberação, segurança). |
| Ficha do curso (Nível "Profissional", Abordagem, Foco) | HTML L256-264 | Escrita pelo autor. |
| Itens de "O que você recebe" (ex.: "Guia de adaptação ao rosto", "Demonstrações práticas") | HTML L246-250 | Parte inferida dos 4 pontos. "Guia" sugere material entregável que não está confirmado. Confirmar o que o curso realmente entrega. |
| Preço, parcelas "até 6x sem juros", PIX, boleto | JS L11-20, HTML L83, 375, 505 | Parcelamento em 6x sem juros, desconto PIX 0%, validade do PIX (30 min) e do boleto (3 dias úteis) são premissas do protótipo, não regras comerciais confirmadas. |
| "Acesso imediato", "área de membros", "conta Academia Beauty" | HTML L142, 250, 367 | Pressupõem a The Members e seu fluxo de acesso. Não confirmado. |
| Redes sociais | HTML L637-641 | Só Instagram tem URL (`instagram.com/lucascam/`). Facebook, YouTube, TikTok, WhatsApp são `href="#"`. O FAQ (L362) manda o aluno ao WhatsApp, que não tem link. O selo "@lucascam" (L276) e o link do Instagram usam o mesmo handle; o nome "Lukas_20" em ANALISE.md é a referência de identidade visual, não um handle confirmado. |
| Foto do instrutor | HTML L275 | Arquivo ausente (ver seção 4). Hoje aparece só o monograma "LC". |
| Capa do produto | HTML L103, L408 | URL remota da Shopify; fallback local é SVG gerado (ver seção 4). |

### 1.3 Valores comerciais hardcoded que NÃO passam por `data-price` (risco de divergência com o backend)
A função `renderPrices` só troca o que tem `data-price`/`data-discount-*`. Estes textos ficam literais no HTML e precisam virar dados ou texto derivado:
- `30% OFF` default (L80, L337, mas sobrescrito por `data-discount-label`), h2 "Garanta o curso com 30% de desconto" (L331, NÃO sobrescrito), "Pagamento único… 7 dias" (L332).
- "Cartão até 6x" (L505), FAQ 3 "até 6x sem juros" (L375), "ou 6x de R$ 29,17" estático nos spans (L83, L342, L650) apenas como fallback.
- "PIX aprovação na hora" (L509), "QR Code válido por 30 minutos" (L564), "Boleto até 3 dias úteis" (L513, L568, FAQ L367).
- "7 dias" em 12+ lugares; o número vem de lugar nenhum (nem `PRODUCT` tem campo de garantia).
- Cartão de teste no aviso (L440).

### 1.4 Inconsistências e bugs observados na leitura
1. Parcelas: R$ 175,00 / 6 = 29,1666; exibe "6x de R$ 29,17" (soma R$ 175,02). Ninguém define quem absorve o centavo. Isso deve ser regra do backend/gateway.
2. `cardBrand` (JS L255-263): a regra `/^4/` (Visa) vem antes da de Elo, e vários prefixos Elo começam com 4 (4011, 4312, 4389, 4514, 4576), então nunca chegam a ser reconhecidos como Elo. A regra Mastercard `2[2-7]` é mais larga que a faixa real 2221-2720. Marca é apenas visual, mas o valor vai no payload (`brand`).
3. Validação de CVV aceita 3 ou 4 dígitos sem relação com a bandeira (JS L309); Luhn aceita 13 a 19 dígitos sem checar comprimento por bandeira.
4. Boleto: o texto diz "vence em 3 dias úteis" (L568, FAQ), o mock usa 3 dias corridos (GW L109).
5. Contadores: o HTML já traz o valor final (L299-301). Ao entrar na viewport, o JS reinicia em 0 e conta até o final (JS L153-159), então há um flash do valor final para 0 antes de animar.
6. `.load-in` tem atrasos só para `:nth-child(2..6)` (CSS L870-874) mas o `hero-copy` tem 7 filhos; o 1º e o 7º (`.trust-row`) animam sem atraso.
7. Scroll-spy: `is-active` nunca é limpo quando nenhuma seção observada intersecta (JS L109-114).
8. `initStickyCTA` usa `currentStep` (declarado com `let` mais abaixo, L336). Funciona porque o acesso ocorre depois, mas é dependência de ordem; em React vira estado compartilhado explícito.
9. Imagem do produto no resumo (L408) é a mesma imagem 800x1000 da capa, carregada para um thumb de 64x64.
10. CSS não usado no HTML atual: `.form-row--3` (CSS L900), `.field-hint` (L691), `.badge--success` (L253). Não verifiquei se o JS gera estas classes; busquei no HTML e no JS lido e não achei uso.
11. Máscara/`maxlength`: `cardNumber maxlength=23` = 19 dígitos + 4 espaços; coerente com a máscara.
12. O FAQ 3 (L375) diz "Tudo nesta mesma página, sem redirecionamento", o que contradiz o Modo A.

---

## 2. Inventário de CSS (`css/style.css`, 946 linhas)

### 2.1 Tokens em `:root` (L7-80)
**Cores**
| Token | Valor |
|---|---|
| `--color-primary` | `#e3c98a` (dourado) |
| `--color-primary-strong` | `#f3dea6` |
| `--color-secondary` | `#b8864f` (caramelo) |
| `--color-background` | `#0b0a09` |
| `--color-surface` | `#151311` |
| `--color-surface-2` | `#1d1a17` |
| `--color-text` | `#f6f2ea` |
| `--color-text-secondary` | `#aaa194` |
| `--color-text-muted` | `#7c7468` |
| `--color-border` | `rgba(246,242,234,.10)` |
| `--color-border-strong` | `rgba(246,242,234,.22)` |
| `--color-success` | `#7fd4a0` |
| `--color-error` | `#f08a7e` |
| `--color-warning` | `#f2c46d` (definido, não usado que eu tenha visto) |
| `--color-cta` | `var(--color-primary)` |
| `--color-cta-text` | `#17130c` |
| `--color-focus` | `#fff1c4` |

**Escala de tons** `--tone-4..9`: `#3b2a1f`, `#5a3d27`, `#7f5733`, `#a97c49`, `#cfa86c`, `#ead199`; `--gradient-tones` = linear-gradient 90deg dos 6 tons (L36).

**Raios**: `--radius-sm 8px`, `-md 14px`, `-lg 24px`, `-pill 999px`.
**Sombras**: `--shadow-sm 0 1px 2px rgba(0,0,0,.4)`, `--shadow-md 0 12px 32px -12px rgba(0,0,0,.6)`, `--shadow-glow 0 10px 40px -10px rgba(227,201,138,.45)`.
**Tipografia**: `--font-sans 'Geist','Helvetica Neue',Arial,sans-serif`; `--font-mono 'Geist Mono',ui-monospace,'SFMono-Regular',Menlo,monospace`; `--fs-h1 clamp(2.9rem,1.6rem+6vw,6.4rem)`, `--fs-h2 clamp(1.9rem,1.3rem+2.4vw,3.1rem)`, `--fs-h3 clamp(1.1rem,1rem+.4vw,1.3rem)`, `--fs-body 1rem`, `--fs-lead clamp(1.05rem,1rem+.3vw,1.2rem)`, `--fs-caption .75rem`, `--fs-cta .95rem`.
**Espaçamento**: `--space-1..9` = 4, 8, 12, 16, 24, 32, 48, 72, 112px; `--gutter clamp(16px,4vw,40px)`; `--container 1180px` (1280px a partir de 1440px, L945); `--header-h 64px` (68px a partir de 900px, L908).
**Movimento**: `--ease-out cubic-bezier(.22,1,.36,1)`; `--dur-fast .18s`; `--dur-med .35s`; `--dur-slow .7s`.

Tokens não são cobertos pelo `:root` e aparecem literais: `rgba(227,201,138,.35/.4/.3/.08/.12/.16)` (variações do primary), `rgba(184,134,79,*)`, `rgba(127,212,160,*)`, `rgba(240,138,126,*)`, `#fff` no QR, `#111` no QR fake. Em Tailwind/CSS Modules, isso vira tokens derivados ou `color-mix`.

### 2.2 Fontes
- Família: **Geist** (400, 500, 600, 700, 800) e **Geist Mono** (400, 500), via Google Fonts `css2` com `display=swap` (HTML L10-12).
- O CSS usa pesos 550 (`.nav a` L308, `.field label` L643, `.problem-quote` L469) e 650 (`.btn` L194, `h2` L113). O link pede pesos discretos (400-800). Não verifiquei se a resposta do Google entrega o eixo variável completo; se não, 550/650 caem no peso mais próximo. Em Next, `next/font` com Geist variável resolveria; confirmar disponibilidade da fonte e comportamento dos pesos intermediários.
- Também há `font-family="Geist Mono, monospace"` dentro do SVG do selo (HTML L597), que depende da fonte global estar carregada.
- Tipografia especial: h1 `font-weight 700`, `line-height .9`, `letter-spacing -.06em`; h2 `-.035em`; `.caption/.eyebrow` mono uppercase `letter-spacing .14em`; `text-wrap: balance`; `font-variant-numeric: tabular-nums` em `.num`.

### 2.3 Breakpoints exatos (todos `min-width`, mobile-first; não há `max-width`)
| Query | Linhas | Efeito |
|---|---|---|
| (base, <560px) | todo o arquivo | 1 coluna, `.facts` 2x2, `.stats` 3 colunas fixas, `.pay-methods` 3 colunas fixas |
| `min-width: 560px` | L898-905 | `.form-row` 2 col; `.testimonials` e `.benefits` 2 col; `.security-list` 2 col; `.checkout-card` padding 32px |
| `min-width: 900px` | L907-942 | `--header-h 68px`; `.section` padding 112px; `.nav` visível; header largura `calc(100% - 34px)`; hero 2 col `1.1fr .9fr`; `.facts` 4 col; `.problem` 2 col; `.benefits` 4 col; `.content-layout` `.8fr 1.2fr` com `.section-head` sticky; `.deliver-grid` `1.15fr .85fr`; `.instructor` `.8fr 1.2fr`; `.testimonials` 3 col; `.offer` 2 col; `.checkout` `minmax(0,1.25fr) minmax(320px,.75fr)`; resumo sticky e sempre aberto; `.guarantee` `auto 1fr`; `.sticky-cta` some (`display:none`) |
| `min-width: 1440px` | L944-946 | `--container 1280px` |
| `prefers-reduced-motion: reduce` | L889-893 | ver seção 6 |

O JS repete o breakpoint 900px em `matchMedia('(min-width: 900px)')` (JS L224). Em React, isso deve ser um hook com a mesma constante.

### 2.4 Componentes CSS
Botões (`.btn`, `--primary`, `--ghost`, `--sm`, `--block`, `.spinner`), badges (`.badge`, `--gold`, `--outline-gold`, `--success`), card (`.card`, `--hover`), `.icon-tile`, header pílula com blur (`.header`, `.brand`, `.nav`), `.scroll-progress`, hero (`.hero`, `.hero-fx`, `.hero-glow`, `.hero-title span`, `.hero-by`, `.price-inline`, `.trust-row`, `.product-frame`, `.frame-label`, `.hud--a/--b`, `.tone-scale`), `.facts/.fact`, `.problem`, `.benefits/.benefit`, accordion (`.accordion`, `.acc-item`, `.acc-trigger`, `.acc-icon`, `.acc-panel`, `.acc-body`), `.check-list/.check`, `.spec-list`, `.instructor*`, `.stats/.stat`, `.testimonials/.testimonial/.stars`, `.pricing-card`, checkout (`.steps/.step`, `.checkout-card`, `.pane`, `.field`, `.input-wrap`, `.input`, `.select`, `.input-status`, `.card-brand`, `.field-error`, `.pay-methods/.pay-method`, `.method-panel`, `.info-box`, `.alert--info/--error/--success`, `.summary*`, `.seals/.seal`, `.result*`, `.pix-box/.pix-qr`, `.copy-field`, `.timer`, `.order-id`, `.link-btn`, `.secure-note`), `.guarantee*`, `.security-list`, `.final-cta`, `.footer*`, `.sticky-cta`, utilitárias `.container`, `.section`, `.section-head(--center)`, `.lead`, `.muted`, `.num`, `.caption`, `.eyebrow`, `.visually-hidden`, `.skip-link`.

Z-index: skip-link 200, scroll-progress 150, header 100, sticky-cta 90, demais `z-index` internos 1-3.

Pontos técnicos relevantes para a migração:
- Muitos estilos inline no HTML (`style="..."`: ex. L102, 138-142, 184, 271, 327, 335-339, 357, 438, 443, 449-450, 499-500, 531, 616). Devem virar classes/props.
- Técnicas que exigem cuidado: `-webkit-text-stroke` + `background-clip:text` (L362-371, L565-568), `mask-image` (L342), `perspective(600px) rotateX(66deg)` (L340), `backdrop-filter` (header, hud, sticky), accordion por `grid-template-rows: 0fr→1fr` (L513-516), `env(safe-area-inset-*)`, `text-wrap: balance`, `aspect-ratio`.
- `html { scroll-behavior: smooth; scroll-padding-top: calc(var(--header-h) + 24px) }` (L88-92): vale reproduzir em `globals.css`.
- `body { overflow-x: hidden }` (L102) esconde o transbordo de `.hud--a/b` (`left:-4%`, `right:-4%`).

---

## 3. Inventário de JS

### 3.1 `script.js` (IIFE, `'use strict'`)
**Constante `PRODUCT` (L11-20)**: `id 'morena-iluminada'`, `name`, `instructor`, `listPrice 250.00`, `discountPct 30`, `pixDiscountPct 0`, `maxInstallments 6`, `currency 'BRL'`. É a "fonte única" de preço no cliente. Pela regra do projeto, TODOS esses valores comerciais vêm do backend.

**Helpers (L22-27)**: `$`, `$$`, `brl = Intl.NumberFormat('pt-BR', BRL)`, `money(v)` (troca um caractere de espaço por espaço comum; o caractere exato no arquivo é multibyte e não consegui distinguir NBSP de espaço estreito no `od`; ao portar, usar `Intl` direto e decidir o espaço), `round2`, `prefersReducedMotion` lido uma vez no load.

**Funções**
| Função | Linhas | O que faz |
|---|---|---|
| `computePricing(method)` | 32-38 | desconto = round2(list*pct/100); subtotal; desconto PIX; total; parcela = total/maxInstallments. **Lógica de preço no cliente.** |
| `renderPrices(method)` | 40-57 | preenche `[data-price=list|discount|methodDiscount|total|installments|installmentsShort|summaryNote]`, `[data-discount-label]`, `[data-discount-pct]`; mostra/oculta `[data-method-discount-row]` |
| `renderInstallments()` | 59-70 | popula `#installments` (1..6) com `1x de R$ X (à vista)` / `Nx de R$ Y sem juros` |
| `initImages()` | 75-86 | `img[data-fallback]`: no `error` troca `src` pelo fallback; `img[data-hide-on-error]`: no `error` seta `hidden`. Trata o caso de erro que ocorreu antes do listener (`img.complete && naturalWidth===0`) |
| `initScrollUI()` | 91-116 | `scroll` (passive + rAF): `.header.is-scrolled` quando `scrollY>24`; `--progress` em `.scroll-progress`; IntersectionObserver (`rootMargin '-45% 0px -50% 0px'`) para `.nav a.is-active` nas seções `#beneficios,#conteudo,#instrutor,#faq` |
| `initReveal()` | 122-136 | só se não reduced-motion e há IO: elementos `.reveal` abaixo de 92% da altura da janela recebem `.is-pending` e são observados (`threshold .12`, `rootMargin '0 0 -40px 0'`); some o `is-pending` e `unobserve` na interseção |
| `initCounters()` | 141-164 | `[data-count]`: IO `threshold .6`; anima de 0 ao valor em 1100ms, easing cúbico `1-(1-k)^3`; usa `data-prefix`, `data-suffix`, `Intl pt-BR maxFractionDigits 1`; 1 casa decimal se o `data-count` tem ponto |
| `initAccordions()` | 169-184 | `[data-accordion]`: abre um item por vez (fecha os outros), alterna `.is-open` e `aria-expanded`; clicar no aberto fecha |
| `initStickyCTA()` | 189-203 | barra visível se hero CTA fora da viewport E `#checkout` fora (`rootMargin '0 0 -20% 0'`) E `currentStep !== 3`; alterna `.is-visible`, `aria-hidden`, `tabIndex` do link |
| `initCTAs()` | 206-217 | todo `[data-cta]`: `preventDefault`, `scrollIntoView` em `#checkout` (smooth, ou auto se reduced-motion), depois foca `#name` após 650ms (0 se reduced-motion) se `currentStep===1` |
| `initSummary()` | 220-234 | resumo do pedido: aberto em desktop (>=900px), recolhível no mobile; `change` do `matchMedia` ressincroniza |
| `masks`, `onlyDigits` | 239-253 | máscaras de cpf, phone, cardNumber, cardExpiry, cardCvv |
| `cardBrand(num)` | 255-263 | Visa/Mastercard/Amex/Elo/Hipercard por prefixo (ver bug 1.4-2) |
| `isValidCPF`, `luhn`, `validExpiry` | 268-299 | validações |
| `RULES` | 301-310 | regra por campo; retorna `true` ou mensagem |
| `STEP_FIELDS` | 312 | etapa 1: name, email, cpf, phone; cartão: cardNumber, cardName, cardExpiry, cardCvv |
| `validateField`, `validateGroup` | 314-331 | aplica classes `.is-valid/.is-invalid`, `aria-invalid`, texto em `#<id>-error` |
| `showAlert/hideAlert/goToStep/selectedMethod` | 339-366 | alerta de erro (`#form-alert`, role alert, foco), troca de etapa (paine `hidden`, indicador `is-active/is-done`, `aria-current="step"`, rolagem para `.steps` se fora de 60px..35% da janela) |
| `initCheckout()` | 368-486 | máscaras + validação ao digitar/blur; botão Continuar; Voltar; Enter na etapa 1; troca de método; submit |
| `renderResult`, `fakeQR`, `initCopyButton`, `startTimer` | 494-580 | tela da etapa 3, QR fake determinístico (25x25, xorshift sobre o código), botão copiar (Clipboard API + fallback `select()`), contagem regressiva do PIX |
| `init()` | 585-598 | ordem: renderPrices('card'), renderInstallments, initImages, initScrollUI, initReveal, initCounters, initAccordions, initStickyCTA, initCTAs, initSummary, initCheckout, `[data-year]` |

**Estado global (closure)**: `currentStep` (1|2|3), `pixTimer` (interval id). Estado de formulário vive no DOM (não controlado). Sem persistência (nem `localStorage`).

**Máscaras**
- CPF: 11 dígitos, `000.000.000-00` (`maxlength 14`).
- Celular: `(DD) NNNN-NNNN` para 10 dígitos, `(DD) NNNNN-NNNN` para 11 (`maxlength 15`).
- Cartão: até 19 dígitos em grupos de 4 (`maxlength 23`); Validade `MM/AA` (`maxlength 5`); CVV até 4 dígitos (`maxlength 4`).
- Reposição de cursor: `pos = len - selectionStart`, restaurada com `setSelectionRange` (L377-379). Em React controlado, exige tratamento próprio (cursor salta).

**Validações (mensagens literais em pt-BR)**
- name: ao menos 2 palavras com mais de 1 caractere. "Digite seu nome e sobrenome."
- email: `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`. "Digite um e-mail válido, como voce@email.com."
- cpf: 11 dígitos, não todos iguais, dois dígitos verificadores. "Este CPF não é válido. Confira os números."
- phone: 10 ou 11 dígitos (não valida DDD nem o 9). "Digite o celular com DDD."
- cardNumber: Luhn, mínimo 13 dígitos. "Confira o número do cartão."
- cardName: >=3 caracteres. "Digite o nome como está no cartão."
- cardExpiry: `MM/AA`, mês 1-12, não vencido (relógio do cliente). "Use o formato MM/AA com uma data futura."
- cardCvv: 3 ou 4 dígitos. "O código tem 3 ou 4 dígitos."
- Comportamento: valida no `blur` se há valor; ao digitar, valida silenciosamente e só marca o campo válido quando passa; se já inválido, revalida a cada tecla.

**Etapas do checkout**: ver seção 7.

### 3.2 `gateway.js` (contrato)
- API pública: `CheckoutGateway.tokenizeCard(card) -> { token, brand, last4 }`, `createOrder(payload) -> resultado`, `configure(options)`, getter `mode`. `config = { mode:'mock'|'live', endpoint:'/api/checkout', publicKey:'', timeoutMs:20000 }`.
- `createOrder` no modo live faz `POST` JSON para `config.endpoint` com `AbortController` (timeout 20s) e espera:
  `{ status:'approved'|'pending'|'declined', method:'card'|'pix'|'boleto', orderId, message?, pix?:{qrCodeSvg?, copyPaste, expiresAt ISO}, boleto?:{digitableLine, url, dueDate ISO} }`.
- Payload enviado por `script.js` (L444-456): `{ productId, amount, currency, method, installments, customer:{name,email,cpf(dígitos),phone(dígitos)}, card? }`, onde `card` é o retorno de `tokenizeCard` (token, brand, last4).
- Mock: latência 350ms (token) e 1400ms (pedido). Cartão terminado em `0002` recusa; qualquer outro aprova. PIX: código fictício e expiração +30 min. Boleto: linha digitável fictícia, `url:'#'`, vencimento +3 dias corridos.
- Pontos de integração: (a) `tokenizeCard` live lança "Tokenização real não configurada" (L52); (b) `createOrder` live; (c) `configure({mode:'live'})`; (d) o comentário cita Pagar.me/Mercado Pago/Stripe/Asaas como exemplos genéricos. **Nada aqui é específico da The Members** e não há evidência de que ela use tokenização, endpoint de pedido ou os campos acima.
- Observações: `qrCodeSvg` previsto mas `renderResult` ignora e sempre usa `fakeQR` (L519); `boleto.url` previsto mas não usado; não há polling de status, nem tratamento de `approved` para PIX/boleto assíncronos, nem de 3DS/antifraude, nem de idempotência.

### 3.3 O que roda no cliente e deveria ir para o servidor
1. Cálculo de preço (`computePricing`, desconto, desconto PIX, parcela, arredondamento, `maxInstallments`) e o próprio `PRODUCT`.
2. O campo `amount` (e `currency`) no payload: o servidor NUNCA deve aceitar valor do cliente; recebe só `productId`/oferta, método e parcelas, e recalcula.
3. Validação autoritativa de CPF/email/telefone/nome (a do cliente é só UX; repetir no servidor).
4. Validade do cartão contra o relógio do cliente (o emissor/gateway valida).
5. Regras de parcelamento permitidas por método (hoje o `<select>` as define).
6. Tempos de expiração do PIX (30 min) e vencimento do boleto (3 dias): hoje do mock e do texto.
7. Geração do `orderId`, status do pedido, liberação de acesso, e-mails.
8. Texto de recusa e códigos (hoje mensagem do mock); mapear códigos do provedor para mensagens no servidor.
9. Dados do cartão: número, CVV e validade jamais passam pelo servidor da Academia Beauty nem são logados.
10. Rate limit, antifraude, idempotency key e proteção anti-bot (nenhum existe).

---

## 4. Assets e recursos remotos

| Recurso | Onde | Observação |
|---|---|---|
| Google Fonts `css2` Geist + Geist Mono + `preconnect` fonts.googleapis.com / fonts.gstatic.com | HTML L10-12 | Terceiros. Em Next, preferir self-host (`next/font`); confirmar disponibilidade. |
| Imagem da capa na Shopify CDN: `https://cdn.shopify.com/s/files/1/0734/9180/8491/files/morena_iluminada_lukas_campos_v2.png?v=1756913692` | HTML L103 (hero, 800x1000, `fetchpriority=high`) e L408 (thumb 64x64 lazy, mesmo arquivo) | Dependência da loja Shopify antiga (`g0r0t0-50.myshopify.com`, ANALISE L3). Pode sumir ou mudar com a migração. Não verifiquei o tamanho/formato/licença do arquivo. Tem fallback local. |
| `assets/produto-morena-iluminada.svg` (18 KB, 800x1000) | `data-fallback` L104, L408 | "Capa de reserva" (README L10). Pelo cabeçalho contém um bloco `<metadata><c2pa:manifest>` (Content Credentials), o que sugere asset gerado/editado por ferramenta que assina origem. Não renderizei para avaliar o desenho. |
| `assets/logo.svg` e `assets/favicon.svg` (8.373 bytes cada, mesmos tamanhos, diferem em bytes de metadados) | HTML L9, L46, L633 | Também com `c2pa:manifest` no cabeçalho. Confirmar se é a marca oficial da Academia Beauty (não verifiquei visualmente). Remover metadados ao otimizar (SVGO). |
| `assets/lukas-perfil.jpg` | HTML L275 (`data-hide-on-error`) | **Ausente.** `ls assets/` mostra só 3 SVGs. README L14 diz para colocá-la. Sem ela aparece o monograma "LC". CSS aplica `grayscale(1) contrast(1.05)` (L564), então a foto original deve ser colorida ou P&B. |
| Sprite SVG inline (17 `<symbol>`) | HTML L18-38 | ids: check, shield, lock, bolt, card, pix, barcode, star, arrow, scissors, face, sun, gem, play, info, alert, x, chev, user. `i-play` e `i-x` não são usados no HTML lido (busquei `#i-play`, `#i-x` e não achei). Em React: componente `Icon` ou sprite. |
| SVG do selo da garantia (texto em círculo via `textPath`) | HTML L593-598 | Texto "GARANTIA INCONDICIONAL · SATISFAÇÃO OU REEMBOLSO · " fixo, cor `#aaa194` e stroke `rgba(227,201,138,.35)` literais. |
| Seletor `select` com seta em `data:` SVG | CSS L667 | Inline. |
| Link externo | HTML L637 | `https://www.instagram.com/lucascam/` com `rel="noopener"`. |
| Nenhum outro script de terceiro | HTML L655-656 | Só `js/gateway.js` e `js/script.js` com `defer`. |

---

## 5. Seções em ordem

Legenda: **CMS** = conteúdo editorial a vir do CMS. **BACK** = dado comercial a vir do backend. Hoje ambos estão hardcoded; os números de linha são do HTML.

| # | Seção / id / classe | Linhas | Campos CMS | Dados comerciais (BACK) |
|---|---|---|---|---|
| 0 | Sprite SVG, `a.skip-link` (aponta `#conteudo-principal`), `.scroll-progress` | 18-41 | rótulo do skip link | |
| 1 | `header#header.header` (marca, `nav.nav` com 4 âncoras, CTA `data-cta`) | 44-58 | marca, rótulos do menu, rótulo CTA "Garantir acesso" | |
| 2 | `section.hero#top` (`.hero-copy`, `.hero-visual`) | 63-133 | eyebrow "Curso online · Corte & cor", H1 "Morena Iluminada." (com `<span>` estilizado), lead, `hero-by` (iniciais LC, nome, "15 anos", "ROM CONCEPT"), CTAs, trust-row (3 itens), imagem do produto + alt, figcaption, HUD "15 anos" e "53,6 mil", escala de tons (4-9) | `.price-inline`: badge desconto, preço de lista, total, parcelas (`data-price` list/total/installments, `data-discount-label`); "Garantia de 7 dias" (L96) é termo comercial |
| 3 | `section` sem id, `dl.facts.reveal-group` | 136-145 | 4 fatos (Formato, Método, Para, Acesso) | "Acesso imediato" depende do fluxo de liberação |
| 4 | `section.section#beneficios` (`.problem`, `.benefits`) | 148-181 | H2, quote com `<em>`, 4 cards (ícone, título, texto) | |
| 5 | `section.section#conteudo` (fundo `surface`, borda, `.content-layout`, `.accordion[data-accordion]`) | 184-233 | eyebrow, H2, lead, CTA, 4 módulos (índice, título, parágrafo, 3 bullets); módulo 1 aberto por padrão | |
| 6/7 | `section.section#entrega` (`.deliver-grid`: `.check-list` e `aside .spec-list`) | 236-268 | H2, 5 itens, ficha de 7 linhas | "Garantia 7 dias" (L263) |
| 8 | `section.section#instrutor` (fundo `surface`, `.instructor`) | 271-288 | monograma, foto + alt, `@lucascam`, H2, 2 parágrafos de bio, 6 lugares | |
| 9 | `section.section#depoimentos` (`.stats`, `.testimonials`, `.sample-note`) | 291-324 | H2, 3 stats com `data-count/prefix/suffix`, depoimentos (estrelas, texto, nome, papel) | |
| 10 | `section.section#oferta` (`.offer`, `.pricing-card`) | 327-354 | eyebrow, H2 "Garanta o curso com 30% de desconto" (texto fixo!), lead, 3 itens do card | título do produto, badge, `price-old`, `price-now`, parcelas, "Cartão, PIX ou boleto", "Garantia incondicional de 7 dias" |
| 11 | `section.section.faq#faq` (fundo `surface`, `.accordion`) | 357-387 | 5 perguntas/respostas | FAQ 1, 3, 4, 5 contêm fatos comerciais/jurídicos (prazo de boleto, parcelas, garantia, segurança) |
| 12 | `section.section.checkout-section#checkout` (`.summary-card`, `.checkout-main`, `form#checkout-form`) | 390-587 | títulos, textos de apoio, selos do resumo | resumo (produto, desconto, total, nota), opções de método e parcelas, prazos PIX/boleto, nome/imagem do produto |
| 13 | `section.section#garantia` (`.guarantee`, selo girando) | 590-613 | H2, lead, 4 itens | "7 dias", "100%", texto do selo (L597, L599) |
| 14 | `section.section` sem id (`.final-cta`) | 616-626 | eyebrow, H2 com `<span>`, lead, CTA | `data-price="total"` (L621) |
| 15 | `footer.footer` | 630-644 | marca, copyright (`data-year`), links sociais | |
| 16 | `div.sticky-cta#sticky-cta` | 647-653 | rótulo "Quero comprar" | `data-price total` e `installmentsShort` |

Nota: a ordem de seções no nav (`#beneficios, #conteudo, #instrutor, #faq`) não inclui `#depoimentos`, `#oferta`, `#checkout`, `#garantia`. Esses não têm destaque no scroll-spy.

---

## 6. Mapa de animações e interações

Todas as durações vêm dos tokens: fast .18s, med .35s, slow .7s, easing padrão `cubic-bezier(.22,1,.36,1)` (`--ease-out`) salvo indicação.

| Elemento / seletor | Gatilho | Efeito | Duração / easing | Linhas |
|---|---|---|---|---|
| `.load-in` (7 filhos do hero-copy) | carga da página | `fade-up` (opacity 0, `translateY(20px)`) | .8s ease-out, `both`; atrasos nth-child 2..6 = .06, .12, .18, .24, .30s (1º e 7º sem atraso) | CSS 869-874, 877 |
| `.load-in--visual` | carga | `scale-in` (opacity 0, `scale(.96)`) | 1s, delay .15s | 875, 878 |
| `.reveal` (+`.is-pending`) | IO ao entrar na viewport (threshold .12, margem -40px); só abaixo de 92% da altura no load | opacity 0 e `translateY(28px) scale(.985)` para normal | .7s ease-out; `reveal-group` filhos 2,3,4: delay .08/.16/.24s | CSS 863-867, JS 122-136 |
| `.header` | scroll > 24px | `.is-scrolled`: fundo .72 para .9 alpha, borda forte, sombra | .35s | CSS 295-297, JS 99 |
| `.scroll-progress` | scroll | `scaleX(--progress)` com gradiente de tons | sem transição | CSS 315-321, JS 100 |
| `.nav a.is-active` | IO (rootMargin -45%/-50%) | fundo `rgba(246,242,234,.07)` | .18s | CSS 305-313, JS 106-115 |
| `.btn` hover | hover | `translateY(-2px)`, borda dourada; `--primary`: fundo `primary-strong`, brilho `::after` cruza o botão (`translateX(-120% → 120%)`), `.arrow` `translateX(4px)` | .18s sombra .35s; brilho .8s ease-out | CSS 202-226 |
| `.btn:active` | clique | `scale(.98)` | .18s | 203 |
| `.btn[disabled]` + `.spinner` | submit | opacity .7, `cursor:progress`, spinner | `spin .7s linear infinite` | 228-234 |
| `.card--hover` | hover | `translateY(-4px)`, borda dourada, sombra md | .35s | 266 |
| `.hero-fx::before` (piso em grade) | contínuo | `grid-drift` desloca o background | 12s linear infinite | 344, 885 |
| `.hero-fx::after` (horizonte) | contínuo | `horizon` opacity .55→1, `scaleX(.94→1.03)` | 6s ease-in-out infinite | 351, 886 |
| `.hero-title span` | contínuo | `tone-shift` (background-position 0→100%, alternate) | 8s ease-in-out infinite alternate | 370, 887 |
| `.hud` (a/b) | contínuo | `float` `translateY(0→-8px)`; `.hud--b` delay -3s | 6s ease-in-out infinite | 426, 431, 883 |
| `.hero-visual:hover .product-frame img` | hover | `scale(1.03)` | 1.2s ease-out | 405-406 |
| `.acc-item` (abrir/fechar) | clique no `.acc-trigger` | painel `grid-template-rows 0fr→1fr`; corpo opacity 0→1 e `translateY(-6px)→0`; ícone gira 180° e vira "−"; borda dourada | .35s ease-out | CSS 480-526, JS 169-184 |
| `.step` / `.steps` | mudança de etapa | barra de progresso muda cor | .35s | 621-632 |
| `.pane`, `.method-panel`, `.alert` | aparecer | `pane-in` (opacity, `translateY(10px)`) | .35s | 635, 715, 745, 879 |
| `.field.is-invalid .input` | erro | `shake` ±4px | .35s | 683, 884 |
| `.input-status` | válido/inválido | ícone aparece (`scale .4→1`, opacity) | opacity .18s, transform .35s | 672-682 |
| `.input:focus` | foco | borda dourada + halo `0 0 0 4px rgba(227,201,138,.16)` | .18s | 659-664 |
| `.pay-method` | hover / selecionado / `:active` | borda dourada, fundo, `scale(.98)` | .18s | 697-713 |
| `.result-icon` | etapa 3 | `pop` (scale .6→1.08→1), check `.draw` (`stroke-dashoffset 30→0`, delay .2s) | pop .5s; draw .5s | 785, 789 |
| `.summary-toggle .chev` | abrir/fechar (mobile) | gira 180° | .35s | 761-762 |
| `.guarantee-seal svg.ring` | contínuo | gira | 28s linear infinite | 806 |
| `.sticky-cta` | IO hero/checkout/etapa | `translateY(110%) ↔ 0` | .35s | 842-854, JS 189-203 |
| Contadores `[data-count]` | IO threshold .6 | conta de 0 até o valor | 1100ms, easing cúbico no JS | JS 141-164 |
| Clique em `[data-cta]` | clique | `scrollIntoView` smooth no `#checkout`, foco em `#name` após 650ms | 650ms (suposição de duração do smooth scroll) | JS 206-217 |
| `html` | âncoras | `scroll-behavior: smooth`, `scroll-padding-top = header-h + 24px` | | CSS 88-92 |
| `.skip-link` | foco | `top -60px → 12px` | .18s | 156-163 |

### prefers-reduced-motion
- CSS (L889-893): `html { scroll-behavior: auto }`; para `*, *::before, *::after`: `animation-duration .01ms !important`, `animation-iteration-count 1 !important`, `transition-duration .01ms !important`; `.reveal.is-pending { opacity:1; transform:none }`. Efeito: animações contínuas e de entrada terminam no último quadro (estado final visível).
- JS: lido uma vez em `window.matchMedia(...).matches` na carga (L27), sem listener, então mudar a preferência com a página aberta não surte efeito. Desliga `initReveal` e `initCounters` por completo (valores estáticos), e usa `behavior:'auto'` e atraso 0 no foco do CTA e em `goToStep`.
- Não coberto: o scroll da barra de progresso (não é animação), `scrollIntoView` interno do `goToStep` já cobre. Em Next, ler a preferência em `useEffect`/hook com listener para evitar mismatch de hidratação.

---

## 7. Fluxo do checkout atual

### 7.1 Visão geral (HTML L390-587)
- `section#checkout` com resumo (`aside.summary-card`) + `form#checkout-form[novalidate]`. Indicador de 3 passos `ol.steps`: 1 Seus dados, 2 Pagamento, 3 Confirmação.
- Aviso permanente "Ambiente de demonstração" (L438-441) com o cartão de teste.
- `#form-alert[role=alert][tabindex=-1]` para erros gerais.

### 7.2 Etapa 1: dados (`fieldset[data-pane=1]`)
Campos: `name` (autocomplete name), `email` (type email, inputmode email), `cpf` ("para a nota fiscal", autocomplete off, maxlength 14), `phone` (tel, autocomplete tel-national, maxlength 15). Todos `required` (mas `novalidate`; a validação é toda do JS).
Ação: "Continuar para o pagamento" (`type=button`, `[data-next]`) valida os 4 campos; em erro mostra "Falta ajustar um campo…"/"Faltam ajustar N campos…" e foca o primeiro inválido. Em sucesso: `buyer-line` = "Quase lá, {primeiro nome}. Escolha como prefere pagar." e `goToStep(2)`. Enter nos inputs da etapa 1 dispara o mesmo caminho.

### 7.3 Etapa 2: pagamento (`fieldset[data-pane=2]`)
- Método (radios `name="method"`: `card` (padrão), `pix`, `boleto`); a troca mostra o `[data-method-panel]` correspondente, chama `renderPrices(m)` (nota do resumo e eventual desconto PIX) e esconde o alerta.
- Cartão: `cardNumber` (com `[data-card-brand]`), `cardName` (uppercase via CSS), `cardExpiry`, `cardCvv`, `installments` (select 1..6).
- PIX: apenas caixa informativa (QR válido 30 min). Boleto: apenas caixa informativa (vence em 3 dias úteis).
- Botão submit "Finalizar compra · R$ total" e "Voltar e editar meus dados".

### 7.4 Submit (JS L421-485)
1. Ignora se `currentStep !== 2`.
2. Se cartão, valida os 4 campos; senão alerta "Confira os dados do cartão destacados abaixo.".
3. Desabilita o botão, mostra spinner "Processando pagamento…".
4. Monta payload (inclui `amount` calculado no cliente). Para cartão, chama `tokenizeCard` com **número, titular, validade e CVV** e anexa o retorno ao payload.
5. `createOrder(payload)`. Se `status==='declined'`, mostra mensagem e fica na etapa 2. Senão `renderResult` e `goToStep(3)`, foca `[data-pane=3]`.
6. `catch` genérico: "Não conseguimos falar com o sistema de pagamento…". `finally` restaura o botão e reexecuta `renderPrices`.

### 7.5 Etapa 3: confirmação
Gerada por `innerHTML` (texto escapado por `escapeHTML`): cartão aprovado ("Pagamento aprovado!"), PIX (QR fake, copia-e-cola, temporizador MM:SS a partir de `expiresAt`, botão Copiar) ou boleto (vencimento, linha digitável, Copiar), mais `Pedido {orderId}` e, em mock, badge "Simulação · nenhum valor foi cobrado". Não há botão para voltar ao curso, nem link para a área de membros, nem para abrir `boleto.url`, nem polling do status. Recarregar a página perde o pedido (sem persistência nem URL de pedido).

### 7.6 Dados coletados e destino
| Dado | Cliente hoje | Observação |
|---|---|---|
| nome, e-mail, CPF (dígitos), celular (dígitos) | payload.customer | PII sob LGPD. Falta consentimento/aviso de privacidade e links legais. |
| método, parcelas | payload | |
| amount, currency | payload | **remover do payload** |
| número, titular, validade, CVV | só em memória, entregues ao `tokenizeCard`; token/brand/last4 vão ao pedido | Regra do projeto: nunca armazenar dados de cartão. |

### 7.7 O que muda para o Modo A (redirecionamento externo)
Premissa: o pagamento acontece numa página externa (de The Members ou do provedor que ela use; **não confirmado**).
1. Remover da nossa página: campos de cartão, select de parcelas, painéis PIX/boleto, `tokenizeCard`, `fakeQR`, temporizador, copy buttons, máscaras/Luhn/cardBrand/validExpiry, etapa 3 de resultado de pagamento (substituída por uma página de retorno).
2. O CTA principal (`[data-cta]`) deixa de rolar para `#checkout` e passa a iniciar o checkout: chamar um endpoint nosso (ex.: `POST /api/checkout/start`, nome ilustrativo) que devolve a URL externa; o navegador faz redirect. O preço exibido na página vem do backend e é informativo. O valor cobrado é o da página externa/servidor.
3. Etapa 1 só faz sentido se a plataforma externa aceitar pré-preenchimento ou se precisarmos criar o pedido/lead antes (não confirmado). Se não, eliminar o formulário inteiro, mantendo no máximo um bloco de resumo + botão.
4. Reescrever textos que prometem fluxo na página: FAQ 3 ("sem redirecionamento", L375), FAQ 5 (L383), "Checkout seguro / Finalize em menos de um minuto" (L393-394), "Ambiente de demonstração" (L440), seção Oferta/garantia que dizem "Cartão, PIX ou boleto" (L347) e "até 6x" (L505) devem refletir apenas o que a plataforma confirmar.
5. Criar rota de retorno (sucesso/pendente/cancelado) e estados: precisa saber se a plataforma devolve parâmetros ou chama webhook (desconhecido).
6. Vantagem: a página nunca toca em dado de cartão (escopo mínimo de PCI para nós).

### 7.8 O que muda para o Modo B (integrado)
Só viável se a The Members (ou provedor) oferecer API/SDK adequada, **o que não está documentado nem confirmado**.
1. Cartão: preferir campos hospedados/iframe/redirect do provedor para que número e CVV nunca existam no nosso DOM nem no nosso JS. Se o provedor só oferecer tokenização via JS com inputs nossos, o escopo PCI aumenta (SAQ A-EP em vez de SAQ A); decisão de segurança e jurídica antes de implementar.
2. No cliente: manter somente formulário de dados do comprador e seleção de método; em React não guardar número/CVV em estado, contexto, URL, `localStorage`, logs, Sentry ou analytics; nada de `autoComplete` quebrando gerenciadores de senha (manter `cc-*`).
3. Remover `amount`/`currency` do payload; o servidor recebe `offerId` + método + parcelas escolhidas (validadas contra o que o servidor permite) + token (se aplicável) e recalcula tudo.
4. Servidor: cria o pedido no provedor, devolve o status normalizado (approved/pending/declined/erro), dados de PIX/boleto, `orderId`; usa idempotency key; grava pedido; trata webhooks (a existência e a assinatura dos webhooks da The Members são desconhecidas).
5. Frontend precisa de polling ou push do status para PIX/boleto (hoje inexistente), tratamento de expiração, e de 3DS/antifraude se o provedor exigir.
6. A etapa 3 vira rota/estado persistente (`/pedido/{id}`) para sobreviver a refresh, com link para a área de membros.
7. Honeypot/captcha, rate limit por IP/e-mail/CPF, CSRF (se cookies), CSP restrita permitindo apenas o domínio do provedor.

---

## 8. Componentes reutilizáveis candidatos, itens impossíveis de reproduzir, riscos, pontos a confirmar

### 8.1 Componentes candidatos (React)
`Button` (variantes primary/ghost/sm/block/loading), `Badge`, `Card` (+ hover), `IconTile`, `Icon` (sprite), `Eyebrow`, `SectionHead` (+center), `Container`, `Header` (scroll state + spy), `ScrollProgress`, `Reveal`/`RevealGroup` (delays), `Counter`, `Accordion`/`AccordionItem` (reutilizado em conteúdo e FAQ; 1 aberto por vez), `PriceBlock` (dados do backend), `TrustRow`, `CheckList`, `SpecList`, `Facts`, `ProductFrame` (com fallback), `Hud`, `ToneScale`, `StatCard`, `TestimonialCard` + `Stars`, `InstructorCard` (foto com fallback para monograma), `PricingCard`, `Steps`, `Field` (label, input, status ok/erro, mensagem, máscara), `PayMethodRadio`, `InfoBox`, `Alert` (info/error/success), `OrderSummary` (recolhível no mobile), `Seals`, `GuaranteeSeal` (SVG rotativo), `SecurityList`, `FinalCta`, `Footer`, `StickyCta`, hooks `useMediaQuery(900)`, `useReducedMotion`, `useInView`. Utilitários: `formatBRL`, `isValidCPF`, máscaras (se mantiver formulário de dados). Em modo A, `Field`/`Steps`/`PayMethodRadio`/`OrderSummary` encolhem muito.

### 8.2 Itens impossíveis ou difíceis de reproduzir exatamente
- Imagem da Shopify (dependência externa versionada); foto do Lukas (arquivo ausente); fallback gerado e logo/favicons de origem não confirmada: exigem assets definitivos do cliente.
- QR Code PIX é falso (padrão aleatório determinístico); a versão real vem do provedor/backend.
- Depoimentos reais e prova social numérica (53,6 mil, +6 países): conteúdo pendente.
- Fidelidade pixel a pixel: `-webkit-text-stroke` com `background-clip:text` (render varia entre navegadores), `backdrop-filter`, `mask-image`, perspectiva da grade, fontes Geist 550/650 dependem da fonte servida.
- Primeiro quadro: o `reveal` esconde elementos no `DOMContentLoaded` (via script defer); em Next/SSR, aplicar `is-pending` pós-hidratação pode causar flash ou CLS; é preciso estratégia (CSS inicial + `useLayoutEffect`/IO) e testar.
- Foco/cursor das máscaras do original em inputs controlados do React.
- Ano do rodapé (`data-year`) pode gerar mismatch de hidratação.
- Intl: `money()` troca o espaço do `Intl`; comportamento do caractere exato não verificado.

### 8.3 Riscos
1. **Preço no cliente / `amount` no payload** (violação da regra do projeto). Alto.
2. **Dados de cartão**: no código atual passam por JS próprio. Alto se for mantido em Modo B sem campos hospedados.
3. Conteúdo não publicável: depoimentos de exemplo, garantia de 7 dias e FAQ escritos sem fonte, nomes de celebridades e Victoria's Secret, "+6 países", links sociais `#`. Garantia/reembolso e "sem juros" têm implicações jurídicas e financeiras.
4. Dependência de assets externos (Shopify CDN) e ausência da foto.
5. Acesso ao curso: toda a promessa "acesso imediato / Acessar conta / conta Academia Beauty" depende de fluxo da The Members não documentado.
6. Sem LGPD básica: sem aviso de privacidade, termos, consentimento; coleta CPF e telefone.
7. Sem SEO/OG/JSON-LD, sem analytics e sem tratamento de erro além de mensagem genérica.
8. Acessibilidade: acordeões deixam o conteúdo fechado no DOM (sem `hidden`/`inert`); sem menu mobile; `aria-hidden` no sticky com link focável controlado por `tabIndex`; `<legend>` estilizado como grid (pode variar entre navegadores; não verifiquei).
9. Reduced-motion lido uma vez (não reativo).
10. Pedido sem persistência ou idempotência: refresh/duplo clique no PIX/boleto podem gerar cobranças duplicadas em Modo B.

### 8.4 Pontos a confirmar (sem presumir capacidades da The Members)
Nada abaixo foi encontrado no material analisado. Cada item é pergunta aberta:
1. A The Members oferece checkout hospedado (URL por produto/oferta)? Aceita pré-preenchimento (nome, e-mail, CPF, telefone) e `return/cancel URL`?
2. Existe API para criar pedido/cobrança, ou só link de checkout? Tem tokenização de cartão ou campos hospedados? Quais métodos (cartão, PIX, boleto) e regras de parcelamento/juros?
3. Como o acesso é liberado (webhook, e-mail, SSO)? Existe "Acessar conta" com URL pública? O aluno entra com o mesmo e-mail?
4. Webhooks: eventos, assinatura/segredo, reentrega, ambiente de teste/sandbox, documentação e limites.
5. Fonte oficial de preço/oferta: o preço de lista R$ 250, 30% de desconto, 6x sem juros, desconto PIX 0% e validades PIX (30 min) e boleto (3 dias úteis) são regras reais?
6. Política de garantia/reembolso (7 dias?): redação jurídica e processo operacional.
7. Conteúdo programático oficial (módulos, subitens, entregáveis como "guia"), carga horária e certificado (ANALISE L30 diz que não há na página original).
8. Depoimentos reais com autorização de uso; autorização para citar nomes de clientes famosos e marca Victoria's Secret; número de países/cidades e de seguidores atualizados.
9. Foto do Lukas, capa definitiva do curso (arquivo próprio, não Shopify), logo oficial e favicon.
10. URLs reais de Facebook, YouTube, TikTok, WhatsApp; handle oficial do Instagram; termos de uso e política de privacidade.
11. Fonte Geist: licença/hospedagem para self-host; confirmação dos pesos 550/650.
12. Quem é o CMS e como modelar: campos editoriais (itens 5.CMS) versus oferta/preço (backend). Definir como o frontend referencia a oferta (id) sem trazer preço do CMS.
