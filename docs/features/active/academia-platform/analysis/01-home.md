# 01 — Análise técnica da Home (Academia Beauty)

Fonte: `/Users/fernandomartins/Downloads/Site_Academila/Home.html` (630.395 bytes, 13.312 linhas, snapshot "Salvar como" de uma loja Shopify; `<html class="js" lang="pt-BR">`, `<title>academiabeauty</title>`).
Assets: `/Users/fernandomartins/Downloads/Site_Academila/assets/` (14 arquivos, todos PNG).
Análise somente leitura: nenhum arquivo de origem foi alterado.

## Método e limites da verificação

- Leitura direta do HTML (grep + leitura por blocos de todos os `<script>` visuais, do corpo, e dos blocos CSS efetivos).
- Verificação empírica: abri o arquivo em Chrome headless (puppeteer-core instalado só no scratchpad, requisições `http(s)` bloqueadas) e coletei estilos computados, a regra vencedora (via CDP `CSS.getMatchedStylesForNode`), animações ativas, elementos ocultos, imagens carregadas e capturas de tela em 1440, 768 e 390 px. Scripts de apoio em `/private/tmp/claude-502/-Users-fernandomartins-Academia-Beauty/dd8dc7a3-dabf-403f-97b5-5ecdc6f5d2d8/scratchpad/pp/` (descartáveis).
- Viewports medidos: 1440, 1024, 900, 768, 620 e 390 px (altura 900). O que não foi medido está marcado "não verificado".
- A "regra vencedora" indicada como `@Lnnn` é a linha de abertura do `<style>` que contém a declaração vencedora (não a linha da declaração).
- Não foi possível abrir o site Shopify real (offline); o que depende de CSS/JS/fontes externas não salvos é tratado como desconhecido.

---

## 1. Diagnóstico geral

### 1.1 Números

| Item | Valor |
|---|---|
| Linhas | 13.312 |
| `<style>` | 139 (2 sem id: Shopify `data-shopify` L296-603 e um bloco curto L802-804; 137 com id `cb-*` de L805 a L13311) |
| `<script>` | 76 no total; 16 são de comportamento visual do site (15 com id `cb-*` + o `reveal` final anônimo L7366-7374); o resto é Shopify/telemetria/shim offline |
| Regras CSS nos blocos `cb-*` (aprox.) | 1.389 regras; 821 casam algum elemento do DOM final, ~568 (41%) não casam nenhum (código morto) |
| Uso de `!important` nos blocos `cb-*` | 3.887 ocorrências (para ~5.970 `;`) |
| `@keyframes` | 53 (6 em L816/1178/1348, resto até L11437 e 12918-12940) |
| `<canvas>` | 1 no HTML (`#cbTelemetryCanvas`) + 2 injetados por JS = 3 |
| `<video>` | 0 (apesar do bloco chamar-se `cb-video-style-hero-fx`, é só CSS/partículas, sem vídeo) |
| `<img>` | 12 no corpo |
| `<svg>` inline | 8 (1 injetado no hero, 2 setas do slider, 5 ícones sociais) |
| Bibliotecas JS | nenhuma em uso (sem Swiper, GSAP, jQuery). Há `<link>` para `swiper-bundle.min.css` (L218), mas não existe markup Swiper. |

### 1.2 Lixo Shopify x conteúdo visual real

Descartável (não migrar):
- L3-212: shims "offline" do salvamento (`data-offline-esm`, `importmap`, `ASSET_MAP`, `data-offline-resolve`), `trekkie`, `shop_events_listener`, `perf-kit`, `monorail` (L616-617), `wpm loader` (L621), `analytics` (L630-798), `shopify-features`, `Shopify.SignInWithShop`, `Shopify.MCP` (L278-285, expõe tools do shop), `PaymentButton` (L288-294), `captcha-bootstrap`, `web-pixels-manager-sandbox-container` + iframe (L7376), 80+ `<link rel=prefetch>` de chunks do checkout (L925), `origin-trial` metas, `speculationrules`.
- `<link>` de CSS/JS do tema (base.css, banner.css, home-professores.css, cursos.css, component-*.css, constants.js, global.js, animations.js etc., L217-235, 604-611): **nenhum existe em disco** (verificado: 100% falham ao carregar). Ver 1.4.
- Bloco `<style data-shopify>` L296-603: `@font-face` Assistant, variáveis `--color-*`, `--font-*`, `color-scheme-1..5`, `html{font-size:62.5%}` e `body{display:grid...}` (L560-603). Os `@font-face` Assistant apontam para arquivos que não existem. As variáveis Shopify **não são consumidas** pelo visual `cb-*`, exceto `--font-body-family` (usado apenas pelo `body` do tema, sobrescrito por `cb-redesign-v1` com `font-family:Arial`).
- L802-804 (`html,body{opacity:1!important...}`, `.page-loader{display:none}`): neutralização de loader do tema; não migrar.

Conteúdo visual real: tudo de L805 em diante (CSS `cb-*`), o corpo L7140-7374 e os 16 scripts visuais.

### 1.3 Blocos `<style>` e `<script>` efetivos x sobrepostos (quem vence)

O arquivo é o resultado de ~137 "patches" acumulados, cada um sobrescrevendo o anterior com `!important`. Regra geral: **vence a declaração `!important` mais tardia no documento** (empate de especificidade) ou a de maior especificidade entre `!important`. Por isso o último patch tocando o seletor define o valor final. Mapeamento verificado:

| Região | Linhas | Papel | Situação |
|---|---|---|---|
| Base | `cb-redesign-v1` L805-924 | Sistema inteiro (tokens `--cb-*`, nav, hero, seções, reveal, @media 900/620) | **Base viva**, mas quase tudo é sobrescrito depois. Mantém: tokens, `.cb-reveal`, keyframes `cbDrift/cbPulse/cbMarquee`, `.cb-btn`, `.cb-eyebrow`, `.cb-section*`, `.cb-brand-cell`, `.cb-course*`, `.cb-benefit*`, `.cb-cta`, `reduced-motion` |
| Hero (v1-v5) | L1143-2820 | Várias iterações do hero | **`cb-hero-reference-exact-v5` (L2434-2820) é o vencedor** do hero (nav, hero, h1, kicker, cópia, stage, `animation:none` da pan L2625). Os blocos anteriores (`elenco-pan-final` L1143, `wide-refinement` L1279, `wide-panfix` L1332, `black-blended-v1` L1428, `fullcast-v2` L1680, `background-fullcast-v3` L1864, `refined-v4` L2116) só sobrevivem em declarações que o v5 não toca |
| Hero FX | L3666-5068 | `ambient-fx`, `ribbons-fx`, `bold-fx-v2`, `static-visible-fx` (L4628, **morto**: `.cb-hero-static-fx` não existe; 3/25 regras vivas), `video-style-hero-fx` | **Vivos**: ambient, ribbons, bold, video-style (injetados por JS ou no HTML) |
| Telemetria (canvas) | L5071-6046 | Camadas do hero | `cb-telemetry-canvas-style` + `fullwidth-v2` + `full-background-final` (L5625) + `bold-intensity` (L5753) acumulados; o último vence nas propriedades que repete |
| Hero overlap/blend | L6049-6647 | `text-overlap-cast-blend`, `final-blend-fix`, `remove-black-gap`, `remove-experts-black-strip`, `remove-black-strip-definitive-v2`, `cast-preserve-sides-add-top` | Vivos; `cb-hero-text-overlap-cast-blend` (L6049) define opacidade `.95` da cópia e `.98` da imagem (verificado) |
| **Profissionais antigo** | L2832-3437, L6650-7138, L7377-7482, L8188-11309 | `.cb-pro-grid/.cb-pro-card/.cb-expert-card` (grid de cards grandes), carrossel antigo, círculo, "nome abaixo", responsivo, etc. | **MORTO**: os seletores `.cb-pro-*`/`.cb-expert-*` **não existem no HTML final**. Medi 0 regras vivas em ~38 blocos (ver 1.5). O carrossel `cb-profissionais-carousel-real-js` (L6982) faz `return` porque `.cb-pro-grid` não existe. |
| **Profissionais vigente** | `cb-dobra2-copiada-dc32` L11436-11761 + `restaura-letreiro-antigo` L11816 + `letreiro-full-width` L11837 + `titulo-uma-linha` L11864 + `navegacao-refinada` L11890 + `dobra2-dobra3-transicao-definitiva` L13073 + `sobe-mais` L13225 + `subida-visivel` L13258 | `#profissionais.professores`, `.professor-*`, `.slider-btn-side` | **Vivo e vencedor**. Ordem de sobreposição: dc32 (base) < letreiro < título 1 linha < navegação (botão 48px) < transição (padding 80px, fundo `#E1C986`) < sobe-mais (margin-top -18px) < **subida-visível (margin-top -90px, z-index 20)**. Resultado: margin-top final -90px (1440), -70 (≤1024), -48 (≤768), -30 (≤520) |
| Dobra 3 (cursos) | L8824-9422, L9064-9370, L11955-12292 | `#cursos-home` | Vencedor: `cb-dobra3-seletores-reais-final` L12086, `nomes-dentro-card-final` L12153 (altura 250px, nome 25-34px), `titulo-uppercase` L12254, `foco-*` L12262-12292 (badge "Foco na carreira" redondo/borda preta). Blocos `cb-dobra3-cards-horizontais` L11955 e `-horizontal-corrigido` L12024 estão mortos/parcialmente mortos |
| Benefícios | L9486-9931, L12295-12377, L13058 | `#beneficios` | Vencedor: `beneficios-definitivo-sem-overlap` L9743 (layout em bloco, 3 colunas de cards 230px) + `titulo-uppercase-nowrap` L12295 + `restaura-quebra-titulo` L12323 + `hover-dourado` L12333 + `hover-dourado-intenso` L12361 (borda 2px `#E7CA78`) |
| Marcas | L9426, L12380-12446, L13038 | `#marcas` | Vencedor: `marcas-real-fix` L9426 (≥1000px, h2 620px) + `titulos-ajustados` + `texto-duas-linhas-responsivo` + `reduz-espaco-superior` |
| CTA | L9475 | `.cb-cta h2` clamp(52px,5.4vw,78px) | vivo |
| Footer | L3440-3663 (base FX) + L12449-13035 | `footer.cb-footer-fx` | Vencedor: `cb-footer-efeito-original-reforcado` L12729 + `texto-icones-menores` L12973 + `academia-branco-beauty-dourado` L13025. `cb-footer-limpo-validado` (L12628) **esconde** `.cb-footer-top` e `.cb-footer-bottom` (HTML existe mas é `display:none`) |
| Ajustes finais Dobra 1 | L11312-11433, L13161-13311 | botão neon, borda dourada, `espaco-preto-corrigido`, `ajustes-menu-banner-final` (L13281: `.cb-visual{translateX(40px)}` ≥901) **seguido de `banner-mais-50px-direita` (L13305: translateX(90px))** | O último vence: deslocamento de **90px** do banner (≥901px); 20px entre 601-900; 0 ≤600 |

Observações:
- `cb-fold-1-2-single-viewport-v1` (L7485) define `.cb-hero{max-height:56vh}` (L8030 repete) e `min-height:790px` (L2434). Ambos `!important`; **min-height > max-height ⇒ prevalece 790px** em ≥1025 (verificado: height=790). Em ≤900px aplica `height:auto` (L13186) e o hero cresce (1082 a 1276px medidos).
- Não há `<link>` de CSS externo ativo no resultado visual: tudo que importa está inline. O arquivo `home-professores.css` (que originou as classes `.professor-*`) foi copiado para o bloco `cb-dobra2-copiada-dc32`.

### 1.4 O que NÃO está em disco

Todos os `<link rel=stylesheet>` e `<script src>` do tema (ver seção 4). Consequência: o visual atual **independe** deles (confirmado ao renderizar com todos falhando).

### 1.5 Código morto relevante (medido)

Blocos 100% mortos (nenhum elemento casa): `cb-professionals-equal-cards-v3`, `cb-professionals-real-selectors-fix`, `cb-pro-scroll-reveal-style`, `cb-profissionais-carousel-real-v1`, `cb-profissionais-carousel-auto-circular-v2`, `cb-profissionais-card-circular-v3`, `cb-profissionais-*` (v1 a v10, layout-definitivo, name-below, etc.), `cb-apenas-fotos-profissionais-redondas`, `cb-componente-profissional-redondo`, `cb-profissionais-circulo-definitivo-v2`, `cb-profissionais-manter-nomes-v3`, `cb-nome-realmente-abaixo-foto`, `cb-profissionais-estrutura-correta-final`, `cb-profissionais-nome-abaixo-definitivo`, `cb-profissionais-descer-30px`, `cb-profissionais-responsivo-final(+v2)`, `cb-profissionais-mobile-uma-coluna-final`, `cb-mobile-profissionais-correcao-visual`, `cb-dobra2-heading-clean-v11`, `cb-dobra2-padding-v12`, `cb-remove-conheca-profissionais-definitivo`, `cb-dobra3-heading-exact-v2`, `cb-dobra3-overlap-fix-v3`, `cb-dobra3-hard-fix-v4`, `cb-dobra3-title-copy-v7`, `cb-only-produtos-like-dobra3`, `cb-dobra3-cards-horizontais`. Parcialmente mortos: `cb-profissionais-gold-section` (4/15 vivas), `reference-layout-v6` (7/29), `static-visible-fx` (3/25), `fold-1-2-single-viewport-v1` (16/38).
(A heurística "casa algum elemento" ignora pseudo-classes; "viva" não significa "vencedora".)

JS morto: `cb-pro-scroll-reveal-script` (L3395, alvo `.cb-pro-card.cb-pro-scroll-reveal` inexistente), `cb-profissionais-carousel-real-js` (L6982, `.cb-pro-grid` inexistente), `cb-remove-foco-02-definitivo` (L9252, remove um nó "02" que já não existe; no-op), `cb-hero-elenco-pan-js` (L1228) e `cb-hero-wide-panfix-js` (L1375) apenas gravam `--cb-pan-x` / `--cb-pan-x-wide` que só são lidos pelos keyframes `cbElencoPan/cbElencoPanWide`, e a animação foi desativada por `animation:none !important` em L2625 ⇒ **efeito nulo**. `--scroll-shift` (L4252) é gravado e nunca lido (`var(--scroll-shift)` não existe). Ver 3.

---

## 2. Inventário de CSS

### 2.1 Blocos (agrupados) — ver também 1.3
Total de 137 blocos `cb-*`. Cabeçalhos úteis: base L805; hero L1143-2829; profissionais antigo L2832-3437 (morto); footer FX base L3440-3630; hero FX L3666-5068; telemetria L5071-5844; hero blend/limpeza L6049-6647; patches de seções L7377-9931; profissionais antigos L9933-11309 (mortos); ajustes finais L11312-13311.

### 2.2 Variáveis (únicas definidas para o visual)
`:root` em L806: `--cb-ink:#0b0b0b; --cb-paper:#f7f6f2; --cb-white:#fff; --cb-gold:#e1c986; --cb-gold-deep:#b59b55; --cb-muted:#6e6c66; --cb-line:rgba(11,11,11,.12); --cb-radius:28px; --cb-shadow:0 30px 90px rgba(0,0,0,.14)`.
Variáveis dinâmicas por elemento (JS): `--x --dur --delay --drift` (partículas hero-energy), `--x --y --dur --delay --dx` (ribbons), `--sx --sy --sdur --sdelay --rot` (sparks), `--fx --fy --fdur --fdelay --frot` (flashes), `--x --dur --delay --dx` (video-style). Variáveis do tema Shopify (`--color-*`, `--font-*`, etc.) não são usadas pelo visual.

### 2.3 Fontes
- `@font-face` real: apenas **Assistant** 400 (2x) e 700 (L297-318), com `src` em `assets/8f7d1f17c2ac3abc_assistant_n4...woff2`, `assets/8544167430ed9aae_assistant_n7...woff2` e fallback `//g0r0t0-50.myshopify.com/cdn/fonts/...woff`. **Nenhum dos arquivos existe** (Chrome reporta os 3 `FontFace` com `status: error`).
- Famílias declaradas no CSS `cb-*`: `Arial, Helvetica, sans-serif` (body, L807; é a fonte efetiva de nav, hero, h1, cursos, benefícios, marcas, CTA); `'Gilroy-Medium', Assistant, sans-serif` e `'Gilroy-Bold', Assistant, sans-serif` (L11470, 11485, 11509, 11672, 11685, 12460, 12466, 12582, 12591: título e cards de Profissionais, marca e copyright do footer); `monospace` (tags, `.cb-benefit-num`, `.cb-fig`); `JetBrains Mono, monospace` apenas no `ctx.font` do canvas (L5399).
- **Gilroy nunca é definida por `@font-face`**: o navegador cai para Assistant (que falha) e depois para `sans-serif` genérico. Os valores `font-weight:500/700` e `letter-spacing` do título de Profissionais foram afinados contra uma fonte que só existe na máquina de quem editou (provável instalação local de Gilroy) — ponto crítico para fidelidade (ver 9).
- Peso das fontes efetivas: h1 800 (fallback bold), `.cb-hero p` 600, títulos de seção 700, nome do curso 760 (variável não suportada por Arial; cai para bold).

### 2.4 Cores (frequência nos blocos cb-*)
Ouro principal `#e1c986` (rgb 225,201,134; 54 usos) e variações `#e3c66f`, `#e7ca78` (hover neon/benefício), `#d9bb5f`, `#edd99f` (hover do botão conta), `#fff0ba/#fff0b8/#fff4d0/#fff2c4` (brilhos), `#b59b55` (gold-deep, texto de destaque em seções brancas), `#a97c17` (rgb 169,124,23: letreiro de Profissionais), `#7d5a0f/#c49a33` (gradiente SVG de energia). Neutros: `#000` (83), `#fff`, `#111`, `#0a0a0a`, `#050505` (nav), `#080808`, `#020202` (footer final), `#0b0b0b` (seção escura), `#aaa` (links nav), `#6d675f` (eyebrow clara). Rgba recorrentes: `rgba(225,201,134,.18/.28/.55/...)`, `rgba(0,0,0,.18/.28/.72/.88/.92)`.
Fundos finais medidos (1440): hero `rgb(0,0,0)`; Profissionais `rgb(225,201,134)`; Cursos `#fff`; Benefícios `rgb(11,11,11)`; Marcas `#fff`; CTA `#e1c986`; footer `rgb(2,2,2)`.

### 2.5 `@media` (valores exatos que aparecem; contagem de ocorrências nos blocos cb-*)
`(min-width:1000px)` 36; `(max-width:900px)` 21; `(hover:hover) and (pointer:fine)` 18; `(min-width:1000px) and (max-height:820px)` 13; `(max-width:600px)` 13; `(prefers-reduced-motion:reduce)` 12; `(max-width:620px)` 11; `(max-width:1024px)` 7+1; `(max-width:680px)` 6+1; `(max-width:999px)` 6; `(max-width:768px)` 6; `(max-width:1100px)` 4; `(max-width:700px)` 4; `(min-width:681px) and (max-width:999px)` 4; `(max-width:619px)` 4; `(min-width:1050px)` 3+1; `(max-width:800px)` 3; `(min-width:900px)` 3; `(max-width:520px)` 3; `(max-width:720px)` 3; `(min-width:1400px)` 2; `(min-width:1450px)` 2; `(min-width:901px)` 2; e únicos: `(min-width:1320px)`, `(min-width:1050px) and (max-width:1250px)`, `(max-width:1050px)`, `(min-width:760px) and (max-width:999px)`, `(min-width:1100px)`, `(min-width:850px) and (max-width:1099px)`, `(min-width:620px) and (max-width:849px)`, `(max-width:420px)`, `(min-width:1200px)`, `(min-width:900px) and (max-width:1199px)`, `(min-width:620px) and (max-width:899px)`, `(max-width:1280px)`, `(min-width:601px) and (max-width:900px)`; Shopify: `(min-width:750px)` (L596).
Pontos de quebra que **efetivamente alteram o visual vivo** (medido em 1440/1024/900/768/620/390): 1280 (slider 4 cards), 1024 (slider 3 cards; hero grid vira 520/434; cursos 2 colunas; marcas 3 col), 900/901 (nav esconde links; hero empilha; marcas 1 col; deslocamento do banner), 768 (slider 2 cards, setas 40px, título 24px), 620/600 (cursos 1 col, cursos 225px), 520 (slider 82%, padding 60px). Os demais valores (1000/1050/1100/680/700/720/800...) pertencem em grande parte a blocos mortos ou patches sobrepostos; **não verificado** ponto a ponto quais ainda têm efeito.
- `prefers-reduced-motion`: L917 reduz animações para 0.01ms globalmente; reveal fica visível.

### 2.6 Valores efetivos medidos (1440 px) — referência para o React

| Elemento | Valor final (regra vencedora) |
|---|---|
| `.cb-nav` | fixed, top 9px (L2434), 1120px (min(1120px,100%-40px)), 66px, fundo `#050505`, borda 1px `rgba(255,255,255,.2)`, radius 999px, blur 18px; links 12px/700/.08em `#aaa`; `.cb-account` fundo `#e1c986` texto `#111` |
| `.cb-hero` | min-height 790px, fundo `#000`, texto branco, overflow hidden (L2434) |
| `.cb-hero-grid` | absolute, top 128px (L8014), width `min(1400px,100%-70px)`, colunas `minmax(440px,520px) minmax(0,1fr)` (L7948) |
| `h1` | clamp(38px,4.28vw,62px) (L7846), peso 800, line-height .98, letter-spacing -.045em, uppercase (L11312); 2ª linha `.outline` cor `#e1c986` (L2823) — o "outline" virou preenchido |
| Cópia hero | 15px/600, line-height 1.32, `opacity:.95`; trecho `.cb-hero-texto-dourado` em `var(--cb-gold)` (L11423) |
| Botão "Quero aprender" | fundo dourado, texto `#111`, 12px/700/.08em, altura 43,6px, hover: `translateY(-2px)` + glow `0 0 8px/18px/34px rgba(231,202,120,.9/.68/.42)` + `brightness(1.08)` (L11377) |
| `.cb-portrait-stage` | absolute 100%x100% da coluna (850x445), máscara horizontal `linear-gradient(90deg,transparent 0%,rgba(0,0,0,.45) 5%,#000 11%,#000 91%,rgba(0,0,0,.5) 96%,transparent 100%)`; `img`: `object-fit:contain; object-position:center bottom; transform:scale(1.055); transform-origin:center bottom; opacity:.98`, máscara vertical (transparente 0% -> preto 14% -> preto 84% -> transparente 100%); sem animação |
| `.cb-visual` | `transform: translateX(90px)` ≥901 (L13305) |
| Profissionais | ver seção 7 |
| Cursos h2 | clamp(38px,4.28vw,62px), uppercase, 700, cor `#111`, trecho `.cb-gold-deep` |
| `.cb-course` | grid 3 colunas (≥1025), altura **250px**, radius 18px; nome `clamp(25px,2.35vw,34px)`/760, título 14px/600 dourado; botão `.cb-plus` 58px |
| Benefícios | `.cb-benefit-list` grid 3 colunas, gap 24px; `.cb-benefit` 230px, padding 28px, radius 14px, borda 1px `rgba(225,201,134,.23)`, fundo gradiente 145deg dourado 5,5%->1%; h3 22px; h2 clamp(30px,3.25vw,52px) uppercase |
| Marcas | `.cb-brands-stage` grid 3 colunas, células 200px, logo `max-width:180px`, `grayscale(1)` + `opacity:.7` |
| CTA | fundo `#e1c986`, h2 clamp(52px,5.4vw,78px)/.96/-.055em, palavra "CARREIRA" outline 288px |
| Footer | altura 290px, fundo `#020202`, marca 28px (Gilroy-Medium/300) com "BEAUTY" dourado, ícones 22px `#a7a7ae` gap 24px, copyright 12px `rgba(255,255,255,.42)` |

---

## 3. Inventário de JS

Scripts não visuais (Shopify/telemetria/shim) — **não migrar**: L3 trekkie async; L3-95 `data-offline-esm` + importmap + L96-212 `offline-resolve` (shim do salvamento); L228-235 `constants/pubsub/global/details-disclosure/details-modal/search-form/media-gallery/animations/preloads` (tema Dawn-like, arquivos ausentes); L236-295 shopify-features, `Shopify`, SignInWithShop, captcha, MCP, PaymentButton, `load_feature`, `origin_trials`, `autosizes`; L609-799 monorail/perf-kit/wpm/analytics/shop_events_listener; L7376 web-pixels-manager + iframe (`saved_resource.html`). **Atenção ao nome**: o código visual chama "telemetria" um efeito de canvas (HUD dourado); isso **deve** migrar. Telemetria no sentido de analytics é a lista acima.

Scripts visuais (todos IIFE, executam em `DOMContentLoaded` ou imediatamente):

| # | id / linha | Finalidade | Dependências | Eventos / loops | Estado |
|---|---|---|---|---|---|
| 1 | `cb-hero-elenco-pan-js` L1228-1276 | Calcula `--cb-pan-x` p/ pan do elenco | `.cb-portrait-stage > img` | `load`, `resize` | **Inócuo** (animação desativada L2625). Não migrar |
| 2 | `cb-hero-wide-panfix-js` L1375-1425 | Idem `--cb-pan-x-wide` (min 110px/16%) | idem | `load`, `resize` | **Inócuo**. Não migrar |
| 3 | `cb-pro-scroll-reveal-script` L3395-3437 | Reveal dos cards `.cb-pro-card` (IO threshold .20, margin -7%) | `.cb-pro-card` | IntersectionObserver | **Morto** |
| 4 | `cb-footer-reference-fx-script` L3632-3663 | Injeta `div.cb-footer-energy` com `span.arc, .arc.arc-2, .beam, .scan, .node.n1, .node.n2` no início do footer | `.cb-footer-fx` | nenhum | **Visual, migrar** (pode virar JSX estático) |
| 5 | `cb-hero-ambient-fx-script` L3903-3943 | Injeta `.cb-hero-energy` (`.ambient-glow`, `.filament.f1-f3`, `.energy-line`, `.particles`) e **52** partículas (`--x:2-98%`, `--dur:8-18s`, `--delay:-16-0s`, `--drift:±45px`; a cada 9ª é `large`) | `.cb-hero` | nenhum | **Visual, migrar** |
| 6 | `cb-hero-ribbons-fx-script` L4182-4263 | Injeta `.cb-hero-ribbons` (`.gold-core`, `.ribbon.r1-r3`, `.sweep`, `.particle-field` 44 partículas, `.spark-field` 10 sparks) e **parallax do mouse** | `.cb-hero` | `pointermove` (alvo X=(x/w-.5)*18, Y=(y/h-.5)*10; lerp 0,05), `pointerleave` (volta a 0), `scroll` (grava `--scroll-shift`, **nunca usada**), `requestAnimationFrame` infinito | **Visual, migrar** (exceto `--scroll-shift`). Respeita `prefers-reduced-motion` |
| 7 | `cb-hero-bold-fx-script` L4544-4625 | Injeta `.cb-hero-boldfx`: 2 `.aurora`, `.orb`, **SVG** viewBox `0 0 1600 800` preserveAspectRatio none com 3 `path.energy-path` (gradiente `#7D5A0F→#C49A33→#FFF0BA→#E1C986→#7D5A0F`, filtro `cbGlow` stdDeviation 4), `.pulse-line`, `.flare`, `.flash-field` com **16** `.flash`; parallax | `.cb-hero` | `pointermove` (X*28, Y*14, lerp 0,045), `pointerleave`, rAF infinito | **Visual, migrar** |
| 8 | `cb-video-style-hero-fx-script` L5046-5068 | **72** partículas em `.cb-particle-field` (`--x:35-97%`, `--dur:7-15s`, `--delay:-14-0s`, `--dx:±42px`; a cada 10ª é `.big`) | `.cb-particle-field` (no HTML) | nenhum | **Visual, migrar** |
| 9 | `cb-telemetry-canvas-script` L5223-5445 | Canvas 2D principal `#cbTelemetryCanvas`: grid dourado (espaço 54px, α .075), 28 trilhas verticais, 95 pontos com brilho e conexões (<84,85px), 5 pulsos horizontais, 8 rótulos ("NODE 05","SYNC","LIVE","TRACE","DATA","08:24","CB/01") em 8px mono | `.cb-hero`, canvas | `resize`, rAF; `reduce` => desenha 1 frame | **Visual, migrar** |
| 10 | `cb-telemetry-fullwidth-script` L5486-5622 | Cria canvas `#cbTelemetryCanvasLeft` (opacity .78) abaixo do principal: grid 58px, 54 pontos, 18 streams | idem | `resize`, rAF (setTimeout 50ms) | **Visual, migrar** (pode ser fundido) |
| 11 | `cb-telemetry-bold-script` L5846-6046 | Cria canvas `#cbTelemetryCanvasBoost` (`mix-blend-mode:screen`): grid 46px (α .10), 150 partículas, 46 streams, 9 pacotes horizontais, conexões <102px | idem | `resize`, rAF (setTimeout 80ms) | **Visual, migrar** |
| 12 | `cb-profissionais-carousel-real-js` L6982-7138 | Carrossel antigo (autoplay 2800ms, drag, botões ←/→, disabled) | `.cb-pro-grid` (inexistente) | — | **Morto** (retorna na 1ª linha). Ver 7.6 |
| 13 | `cb-remove-foco-02-definitivo` L9252-9282 | Remove nó de texto "02" | `#cursos-home` | — | **No-op / hack**. Não migrar |
| 14 | `cb-dobra2-slider-dc32` L11764-11813 | **Slider de profissionais vigente**: botões prev/next + autoplay | `#professoresSlider`, `#sliderPrevBtn`, `#sliderNextBtn` | `click`, `setInterval 4000ms`, `mouseenter/leave` no wrapper | **Visual, migrar** (ver 7) |
| 15 | `cb-footer-fx-reforco-elements` L12682-12726 | Injeta `.cb-fx-extra` no `.cb-footer-energy` (`arc-extra.arc-3/4`, `beam-extra.beam-2/3`, `node-extra.n3-n6`, `spark.s1-s6`) | `.cb-footer-energy` | — | **Visual, migrar** |
| 16 | anônimo L7366-7374 | **Scroll reveal**: `.cb-reveal` + `IntersectionObserver {threshold:.12, rootMargin:'0px 0px -8% 0px'}` adiciona `.cb-in` e `unobserve` (uma vez); fallback sem IO adiciona `.cb-in` direto; delegação `a[href^="#"]` → `scrollIntoView({behavior:'smooth'})` | DOM | IO, `click` | **Visual, migrar** (o handler de `#` não age nos links atuais: ver 9) |

Pontos técnicos relevantes:
- Todos os efeitos usam `Math.random()` no cliente; em Next.js isso exige `useEffect`/componente client-only (senão há mismatch de hidratação).
- Há 5 loops `requestAnimationFrame` permanentes (2 parallax + 3 canvas) e ~190 elementos DOM animados por CSS no hero; nenhum pausa fora da viewport nem com aba oculta (o canvas não usa `visibilitychange`).
- `canvas` usa `shadowBlur` por partícula (custo alto em telas 2x; DPR limitado a 2).
- Elementos do hero injetados via `hero.insertBefore(layer, hero.firstChild)`: a ordem final de filhos é `cb-hero-boldfx`, `cb-hero-ribbons`, `cb-hero-energy`, `cb-telemetry-layer`, `cb-video-style-fx`, `cb-noise`, `cb-orb a`, `cb-orb b`, `cb-lettering`, `cb-hero-grid`. z-index efetivos medidos: boldfx 6, ribbons 5, energy 6, telemetry-layer 2, video-style-fx 3, hero-grid 7 (texto z 12-22; visual z 8; stage z 9).

---

## 4. Bibliotecas e assets

### 4.1 Bibliotecas
Nenhuma biblioteca JS ou CSS em uso no visual. `swiper-bundle.min.css` é referenciado (L218) mas sem markup Swiper — **não migrar**. O slider de profissionais é nativo (scroll horizontal + `scroll-snap` + `scrollBy`).

### 4.2 Imagens usadas no corpo (todas existem em disco, em `assets/`)

| Uso | Arquivo | Dimensão natural | Alt |
|---|---|---|---|
| Hero (elenco) L7191 | `9b699e7bca8347a1_grupo-home_506646ef-e6a7-4c71-.png` (758 KB) | 1280x720 | "Profissionais Carreira Beauty" |
| Profissional Lukas Campos | `504e0fc222311dc5_lukas_perfil_new.png` (476 KB) | 2990x3397 | "Lukas Campos" |
| Profissional Cleber Venâncio | `f62f81d1564f1252_perfil_cleber_card_87f71634-c6.png` (194 KB) | 2122x3184 | "Cleber Venâncio" |
| Profissional Neandro Ferreira | `c19db0010e4de879_perfil_neandro_card.png` (190 KB) | 1024x1024 | "Neandro Ferreira" |
| Profissional Paolo Civita | `ed7999c021b0d527_perfil_paolo_card.png` (148 KB) | 1024x1024 | "Paolo Civita" |
| Profissional Miro Rodrigues | `c0247432ed3ce9cc_perfil_miro_card.png` (195 KB) | 1024x1024 | "Miro Rodrigues" |
| Curso 1 | `8a10046696c45715_camdas_desconectadas_internas_.png` (148 KB) | 1920x1080 | "Camadas Desconectadas Internas" |
| Curso 2 | `759131604891f516_classic_bob_miro_capa_v2.png` (86 KB) | 1920x1080 | "Corte Profissional – Classic Bob" |
| Curso 3 | `1e1015aed979ff25_morena_iluminada_cleber_capa_v.png` (104 KB) | 1920x1080 | "Loiro Iluminada \| Artista Wella" |
| Marca L'Oréal | `afb6a5e874554cb3_L_Oreal_logo.svg_1_medium.png` (2 KB) | 240x95 | "L'Oréal" |
| Marca Kérastase | `d2a09f7faf88e73a_new-2105-kerastase-logo-B5B27D.png` (4 KB) | 240x53 | "Kérastase" |
| Marca Schwarzkopf | `0aa90e0fb1f00ce5_Schwarzkopf_Professional-logo-.png` (3 KB) | 240x95 | "Schwarzkopf Professional" |

Em disco mas **não usadas no corpo**: `ab238727c7207aa7_CARREIRA_BEAUTY_1_x320.png` e `de6c07bd2d8456eb_header_2x_42b4a6bd-6cf9-4514-a.png` (só aparecem em `<link rel=prefetch>`; provável logo do tema antigo "Carreira Beauty"; o nav e o footer usam texto, não imagem). Os cards de profissionais mostram a imagem em 96x96 mas os arquivos têm até 2990x3397 (otimização necessária no CMS/`next/image`).
Pasta irmã `Site_Academila/lukas/` (Lukas_11.html, `video.mp4`, `trabLukas01-04.png`, `lukas_perfil.png`) pertence ao perfil do Lukas, **não à Home**; o link do card do Lukas aponta para `perfil_lukas_novo_design_video_local.html`, arquivo que **não existe** (existem `Lukas_11/12/14/15/16/20.html`).

Imagens inline: textura de ruído SVG em data URI (`.cb-noise`, L807; hoje `display:none`), SVGs dos ícones sociais e das setas do slider (ver 5/7).

### 4.3 Vídeos
Nenhum na Home.

### 4.4 Ícones
Inline SVG: setas do slider (`path d="M14.5 5.5 8 12l6.5 6.5"` e `"m9.5 5.5 6.5 6.5-6.5 6.5"`, viewBox 24, stroke `currentColor` 1.7, 21px) e 5 ícones sociais (Facebook, Instagram, YouTube com `.play`, TikTok, X; L7356-7360; viewBox 24, 22px, cor `#a7a7ae`, hover `#E1C986`). Caracteres: `↗` nos botões e `+` nos cursos.

### 4.5 Ausentes ou remotos
Ausentes em disco: `base.css`, `banner.css`, `cursos.css`, `component-cart-items.css`, `component-predictive-search.css`, `swiper-bundle.min.css`, `home-professores.css` (remoto `file://g0r0t0-50.myshopify.com/...`), todos os `.js` do tema/analytics, `saved_resource.html`, as 2 fontes Assistant `.woff2` + 2 `.woff` remotos. Gilroy: não referenciada em nenhum `@font-face` (inexistente). Prefetch de ~70 chunks e 22 CSS do checkout apontam para `file:///Users/fernandomartins/Downloads/Referencia/...` (não existe). Nenhuma dessas ausências altera o visual atual, exceto **as fontes**.

---

## 5. Seções em ordem

Estrutura: `body > div.cb-shell` (L7142) → `nav.cb-nav` (L7143-7149), `main` (L7151-7350), `footer` (L7352-7364), script reveal (L7366).

| # | Seção | Raiz / linhas | Conteúdo estático atual | Potencial CMS |
|---|---|---|---|---|
| 0 | Nav | `nav.cb-nav` L7143-7149 | Marca texto "ACADEMIA **BEAUTY**" (`.cb-brand`); links CURSOS, PROFISSIONAIS, QUEM SOMOS; botão "ACESSAR CONTA ↗" (`.cb-account`) | Itens de menu, rótulo e URL do botão de conta |
| 1 | Hero (Dobra 1) | `section.cb-hero.cb-grid-bg` L7152-7196 | Kicker "Academia Beauty / Educação profissional"; h1 "Aprenda e cresça" + `<span class="outline">com os melhores.</span>`; 3 parágrafos (o 2º dourado); botão "Quero aprender ↗" (âncora para `#cursos-home`); mini-proof "conteúdo • técnica • evolução"; imagem do elenco | Textos, CTA (rótulo/destino), imagem do elenco (+alt). Camadas FX são decorativas (não CMS) |
| 2 | Profissionais (Dobra 2) | `section#profissionais.professores.cb-dobra2-dc32` L7199-7284 | Letreiro "PROFISSIONAIS • ACADEMIA BEAUTY • " ×1 (repetição via animação), h2 "QUEM FAZ PARTE DA **ACADEMIA** BEAUTY", slider com 5 cards, 2 botões | Título; **lista de profissionais** (nome, foto, slug/link); texto do letreiro; rótulo "Conheça" |
| 3 | Cursos (Dobra 3) | `section#cursos-home.cb-section.white.cb-grid-bg` L7287-7323 | Eyebrow "Foco na carreira"; h2 "O curso certo **para você.**"; parágrafo; 3 `article.cb-course` | Eyebrow, título (trecho destacado), descrição, **lista de cursos** (imagem, profissional, título, tags, link) |
| 4 | Benefícios | `section#beneficios.cb-section.dark.cb-grid-bg.cb-beneficios-layout-final` L7325-7334 | Eyebrow "Benefícios"; h2 "Desbloqueie o todo potencial do seu **talento.**"; 2 parágrafos; 3 itens numerados 01-03 (título + texto) | Títulos, parágrafos, **lista de benefícios** (número, título, texto) |
| 5 | Marcas | `section#marcas.cb-section.white.cb-marcas-final` L7336-7344 | Eyebrow "Produtos da linha profissional"; h2 "As marcas que fazem seu **talento brilhar.**"; parágrafo; 3 logos | Textos, **lista de marcas** (logo, alt, link opcional) |
| 6 | CTA | `section.cb-cta` L7346-7349 | Palavra outline "CARREIRA"; eyebrow "05 / Seu próximo movimento" (cor `#5f522f`); h2 "Faça seu talento virar carreira."; parágrafo; botão "Quero aprender ↗" | Textos, CTA, palavra decorativa |
| 7 | Footer | `footer.cb-footer-fx` L7352-7364 | Marca "ACADEMIA BEAUTY"; 5 ícones sociais (`href="#"`); "Todos os direitos reservados © 2026 Academia Beauty". **Ocultos por CSS**: `.cb-footer-top` (marca "CARREIRA BEAUTY", colunas Navegação e Social) e `.cb-footer-bottom` | Links sociais, texto de copyright/ano. O bloco oculto não deve migrar sem confirmar |

Observações de conteúdo: o HTML usa a marca "Carreira Beauty" em 3 pontos (alt do hero, parágrafo de Benefícios "Os cursos do Carreira Beauty...", bloco footer oculto, palavra CARREIRA do CTA) e "Academia Beauty" no resto; eyebrow do CTA "05 /" referencia numeração que não existe mais nas outras seções. Confirmar copy final com o cliente.

---

## 6. Mapa de animações e interações

### 6.1 Entrada/scroll
| Efeito | Seletor | Gatilho | Duração / easing | Implementação |
|---|---|---|---|---|
| Scroll reveal | `.cb-reveal` → `.cb-in` | IO threshold .12, rootMargin `0 0 -8% 0`, **uma vez** | `opacity/transform/filter 1s cubic-bezier(.16,1,.3,1)`; de `opacity:0; translateY(32px); blur(8px)` a `none`; delays `.cb-delay-1..4` = .08/.16/.24/.32s (transition-delay) | CSS + JS (script 16). Elementos do hero e os 2 primeiros cursos já vêm com `.cb-in` no HTML (sem animação de entrada); o 3º curso, Benefícios (sticky + 3 itens), Marcas (head + stage) e CTA (2 blocos) revelam no scroll |
| Reduced motion | `*` | `prefers-reduced-motion` | animações/transições 0.01ms; `.cb-reveal` visível | CSS L917 |
| Scroll suave | `html` | `scroll-behavior:smooth` + handler `a[href^="#"]` | nativo | CSS/JS |

### 6.2 Hero (todas em loop; medido no DOM em 1440)
| Elemento | Keyframes | Duração / easing / direção |
|---|---|---|
| `.aurora` / `.aurora.aurora-2` | `cbAuroraMove` | 7s / 9s `ease-in-out infinite alternate` / `alternate-reverse` |
| `.orb` (boldfx) | `cbOrbPulse` | 5.5s ease-in-out alternate |
| 3x `path.energy-path` (SVG) | `cbEnergyFlow` | 8s / 5.5s / 4.5s `linear infinite` (stroke-dashoffset) |
| `.pulse-line` | `cbPulseSweep` | 6.2s `cubic-bezier(.4,0,.2,1)` |
| `.flare` | `cbFlarePulse` | 3.2s ease-in-out |
| 16x `.flash` | `cbFlashTravel` | 5-10,5s linear, delay negativo aleatório |
| `.gold-core` | `cbGoldPulse` | 6s alternate |
| `.ribbon.r1/r2/r3` | `cbRibbonOne/Two/Three` | 8s / 10s (alt-reverse) / 12s ease-in-out alternate |
| `.sweep` | `cbSweep` | 9s `cubic-bezier(.4,0,.2,1)` |
| 44x `.particle` (ribbons) | `cbParticleFloat` | 6-13s linear, delay -0..-12s |
| 10x `.spark` | `cbSparkMove` | 7-15s linear |
| `.ambient-glow` | `cbHeroGlowBreath` | 7s alternate |
| `.filament.f1/f2/f3` | `cbHeroFilamentDrift` | 9s / 12s (alt-reverse) / 14s |
| `.energy-line` | `cbHeroEnergySweep` | 10s `cubic-bezier(.4,0,.2,1)` |
| 52x `.particle` (energy) | `cbHeroParticleRise` | 8-18s linear |
| `.cb-telemetry-layer::before` | `cbFullTelemetryAtmosphere` | 7s ease-in-out alternate |
| `.cb-telemetry-horizon` | `cbTelemetryHorizon` | 4.8s ease-in-out |
| `.cb-telemetry-glow` | `cbTelemetryGlow` | 6s alternate |
| `.cb-telemetry-scan` | `cbTelemetryScanEdgeToEdge` | 8.5s ease-in-out |
| `.cb-digital-horizon` | `cbHorizonPulse` | 5.6s ease-in-out |
| `.cb-energy-bed` | `cbEnergyBed` | 6.5s alternate |
| `.cb-grid-floor` | `cbGridDrift` | 10s linear |
| `.cb-light-thread.t1/t2/t3` | `cbThread1/2/3` | 6.4s / 8s (alt-reverse) / 9.5s |
| 72x `.cb-particle` | `cbParticleUp` | 7-15s linear |
| 3x `.cb-pulse-dot` | `cbPulseDot` | 3s ease-in-out, delays .4/1.2/2s |
| `.cb-kicker i` (ponto) | `cbPulse` | 2.4s ease infinite |
| Canvas x3 | rAF | ver script 9-11 |
| Parallax do mouse | `.cb-hero-ribbons` (±9px/±5px, lerp .05) e `.cb-hero-boldfx` (±14px/±7px, lerp .045) | `pointermove` em `.cb-hero` | rAF contínuo; volta a 0 em `pointerleave` |

Não vivos (não migrar): `cbDrift` em `.cb-lettering` (elemento `display:none`), `cbElencoPan*`, keyframes `cbStatic*` (bloco morto), `cbDobra2MarqueeText` (seletor `.bg-marquee-*` inexistente), `cbTelemetryScanFull`, `cbTelemetryScan` (substituídos).
Hero escondidos por patches: `.cb-noise`, `.cb-orb a/b`, `.cb-lettering` ("BEAUTY" gigante outline), `.cb-scanline` (todos `display:none` medido).
Imagem do elenco: sem animação; hover antigo `transform:scale(1.035)` do base é sobrescrito (`transform:scale(1.055) !important`, `transition:none`).
Botão: transição `background/color/transform/box-shadow .3s`; `::before` shimmer 105deg (`translateX(-110%→110%)` em .55s) permanece da base.

### 6.3 Profissionais
Letreiro: `.cb-marquee span` `cbMarquee` **22s linear infinite**, `translateX(0 → -50%)` (texto "PROFISSIONAIS • ACADEMIA BEAUTY • PROFISSIONAIS • ACADEMIA BEAUTY • " já duplicado no HTML para fechar o loop), fonte `clamp(110px,10vw,180px)` (144px a 1440) peso 800, cor `rgb(169,124,23)` `opacity:.14`, `letter-spacing:-.055em`, uppercase, posição absoluta top 0 largura `100vw`.
Cards: transições `.4s cubic-bezier(.16,1,.3,1)`; hover do item `translateY(-6px)` + fundo `rgba(0,0,0,.95)` + sombra `0 10px 30px rgba(0,0,0,.3)`; hover da foto: borda `#E1C986`, glow `0 0 25px rgba(225,201,134,.5)`, `img scale(1.1)` (.4s ease).
Botões: hover `scale(1.08)` + glow duplo dourado; `:active scale(.96)`; seta desloca ±2px; `transition:all .3s cubic-bezier(.16,1,.3,1)`.
Slider: `scroll-behavior:smooth`, `scroll-snap-type:x mandatory`, `scroll-snap-align:start`; autoplay 4000ms (ver 7.5).

### 6.4 Demais seções
| Elemento | Hover / animação |
|---|---|
| Nav links | `transition:.3s`; hover: cor `#fff` + fundo `rgba(255,255,255,.08)` (base; L2726 pode alterar: **não verificado**). `.cb-account:hover` fundo `#edd99f`, `translateY(-1px)` |
| Curso `.cb-course` | base: hover `img scale(1.035)`, brilho .78→.9 (1s/.6s); `.cb-plus` gira 90° e fica dourado (.35s). Patches L12153 recalibram tamanhos; o comportamento de hover da base permanece **não verificado** após os patches |
| Benefícios | `#beneficios .cb-benefit:hover`: `translateY(-6px) scale(1.012)`, borda 2px `#E7CA78`, sombra `0 14px 32px rgba(0,0,0,.22)`, anel `0 0 0 1px rgba(231,202,120,.55)` + glows `18px/34px`, número em `#E7CA78`; transição `.32s cubic-bezier(.16,1,.3,1)`; apenas com `(hover:hover) and (pointer:fine)` |
| Marcas | célula: preenchimento dourado sobe de baixo (`:before` height 0→100%, .5s); logo `grayscale(1)→0`, `opacity .7→1`, `scale(1.05)` (.45s). Pode ter sido alterado por `cb-marcas-*`: base verificada na leitura; hover final **não verificado em runtime** |
| CTA | só reveal |
| Footer | FX: `::before` `cbFooterGlowDrift` 12s alternate; `.arc` `cbFooterArcFloat` 10s / `.arc-2` 14s (alt-reverse); `.beam` `cbFooterBeam` 8.5s; `.scan` `cbFooterScan` 7s; `.node.n1/n2` `cbFooterPulse` 2.6s/3.2s (delay .8s); extras: `arc-3` 12s `cbFooterArcExtraA`, `arc-4` 16s `...B` (alt-reverse), `beam-2` 10.5s delay 1.4s `...ExtraRight`, `beam-3` 13s delay 3s `...ExtraLeft`, `node-extra n3-n6` 3s (delays .3/1.1/1.8/2.4s), `spark s1-s6` 4.5s (delays .2/1.1/2/.7/2.8/1.6s). Ícones sociais: hover `#E1C986` + `translateY(-3px) scale(1.08)` (L12483) |

---

## 7. Seção de profissionais (alimentada pelo CMS)

### 7.1 HTML exato (L7199-7284)
```html
<section id="profissionais" class="professores cb-dobra2-dc32">
  <div class="cb-marquee"><span>PROFISSIONAIS • ACADEMIA BEAUTY • PROFISSIONAIS • ACADEMIA BEAUTY • </span></div>
  <div class="professores-container">
    <h2 class="titulo-profissionais">QUEM FAZ PARTE DA <span class="tp-interno">ACADEMIA</span> BEAUTY</h2>
    <div class="professores-slider-wrapper">
      <button id="sliderPrevBtn" aria-label="Profissional anterior" class="slider-btn-side prev-btn">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg></button>
      <div class="professores-slider" id="professoresSlider">
        <a class="professor-card-link" href="…">
          <div class="professor-item">
            <div class="professor-imagem"><img alt="Nome" src="…"></div>
            <div class="professor-info"><h3>Nome</h3><span>Conheça</span></div>
          </div>
        </a>  <!-- x5 -->
      </div>
      <button id="sliderNextBtn" aria-label="Próximo profissional" class="slider-btn-side next-btn">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5.5 6.5 6.5-6.5 6.5"/></svg></button>
    </div>
  </div>
</section>
```
Aninhamento: `a.professor-card-link > div.professor-item > (div.professor-imagem > img) + (div.professor-info > h3 + span)`.

### 7.2 Dados por card (hoje 5, nesta ordem)
Campos reais usados por card: **nome** (h3 e `alt`), **foto** (`src`), **link** (`href`) e um rótulo fixo "Conheça" (não vem de dado por profissional).
| # | Nome | Foto | Link atual (não migrar como está) |
|---|---|---|---|
| 1 | Lukas Campos | `504e0fc222311dc5_lukas_perfil_new.png` | `perfil_lukas_novo_design_video_local.html` (arquivo inexistente) |
| 2 | Cleber Venâncio | `f62f81d1564f1252_perfil_cleber_card_87f71634-c6.png` | `/pages/perfil/cleber-venancio` |
| 3 | Neandro Ferreira | `c19db0010e4de879_perfil_neandro_card.png` | `/pages/perfil/neandro-ferreira` |
| 4 | Paolo Civita | `ed7999c021b0d527_perfil_paolo_card.png` | `/pages/perfil/paolo-civita` |
| 5 | Miro Rodrigues | `c0247432ed3ce9cc_perfil_miro_card.png` | `/pages/perfil/miro-rodrigues` |
Padrão de slug: `nome-sobrenome` em minúsculas sem acento. **Não há** cargo/especialidade, bio, rede social ou badge no card da Home. A foto é recorte quadrado/retrato com `object-fit:cover; object-position:center top` dentro de círculo de 100px; o cabelo/rosto está no topo da imagem (convém padronizar o enquadramento de upload no CMS, pois não há foco por profissional como no CSS antigo).

### 7.3 CSS final do card (valores medidos, 1440)
- `#profissionais.professores`: `display:flex; justify-content/align-items:center; padding:80px 0` (72px ≤1024; 60px ≤600/520); fundo `#E1C986`; `overflow:hidden`; `margin-top:-90px; z-index:20` (sobrepõe o fim do hero). Altura medida 450,6px (1440) / 434,6 (1024) / 429,8 (768) / 390,8 (390).
- `.professores-container`: `max-width:1440px; padding:0 40px` (24px ≤768; 18px ≤520); coluna, `align-items:flex-start`.
- `h2.titulo-profissionais`: Gilroy-Medium→Assistant→sans, 28px (24px ≤768; 21px ≤520, depois `clamp()` de L11864: 768 → `clamp(15px,4vw,24px)` e letter-spacing `clamp(1px,.45vw,3px)`; ≤520 → `clamp(12px,3.8vw,19px)`, `.8px`), peso 500, `letter-spacing:4px`, uppercase, cor `#000`, `white-space:nowrap`, `width:max-content`, `.tp-interno` peso 700.
- `.professores-slider`: `display:flex; gap:24px; overflow-x:auto; scroll-snap-type:x mandatory; scroll-behavior:smooth; padding:6px 0 12px; scrollbar-width:none`.
- `.professor-card-link`: `flex:0 0 calc(20% - 19.2px); min-width:220px; scroll-snap-align:start`. Responsivo: ≤1280 `calc(25% - 18px)` (4 cards); ≤1024 `calc(33.333% - 16px)` (3); ≤768 `calc(50% - 12px)` min 220 (2); ≤520 `82%` min 0 (1 + espiada do próximo).
  Larguras medidas: 252,8px (1440), 298,7 (1024), 257,3 (900), 348 (768), 274 (620), 290,3 (390). Altura do card 215px.
- `.professor-item`: coluna, centro, `background:rgba(0,0,0,.85)`, borda `1px rgba(255,255,255,.1)`, radius 20px, padding `24px 16px`, `height:100%`.
- `.professor-imagem`: 100x100 (círculo), borda `2px rgba(225,201,134,.4)`, glow `0 0 15px rgba(225,201,134,.2)`, fundo `#121212`, margin-bottom 16px; imagem renderizada 96x96.
- `h3`: 18px, branco, line-height 1.2; `span` ("Conheça"): 13px, `#E1C986`, uppercase.
- Botões `.slider-btn-side`: 48px (40px ≤768), círculo, fundo `rgba(10,10,8,.94)`, cor `#E1C986`, borda `1px rgba(225,201,134,.58)`, `top:50%`, `translateY(-50%)`; `prev` `left:-20px` (-10 ≤1024; -5 ≤768) e `next` `right:-20px` (idem), `z-index:10`, `backdrop-filter:blur(10px)`, SVG 21px (18px ≤768) stroke 1.7.

### 7.4 Estado a 1440 px
5 cards cabem exatamente (5x252,8 + 4x24 = 1360 px = largura do slider): **não há overflow**, as setas aparecem mas não têm efeito e o autoplay não faz nada visível. A rolagem só existe de ≤1280 px, ou se o CMS tiver >5 profissionais (a largura do card é fixa em 20%, logo o 6º+ gera overflow mesmo em desktop).

### 7.5 Comportamento do slider (vigente, `cb-dobra2-slider-dc32` L11764)
- Passo = `primeiro .professor-card-link .offsetWidth + 24` (fallback 260). Prev/Next chamam `slider.scrollBy({left:±passo, behavior:'smooth'})`.
- Autoplay `setInterval` **4000 ms**: se `scrollLeft + clientWidth >= scrollWidth - 10` volta a 0 com scroll suave (rebobina, **não é loop infinito**), senão `scrollBy(+passo)`.
- Pausa ao `mouseenter` no wrapper e reinicia (novo intervalo de 4000ms) no `mouseleave`.
- Não pausa por toque, foco, `visibilitychange` nem `prefers-reduced-motion`; **sem drag com mouse** (apenas scroll nativo/touch/trackpad); sem estado `disabled` nas setas; sem botões de paginação; o intervalo inicial nunca é limpo (sem `unmount`); `mouseenter` usa `clearInterval` mas o slider não retoma após foco de teclado.
- Os cards são `<a>` completos: clicar em qualquer ponto navega para o perfil (não há bloqueio de clique após arrastar, pois não há drag).
- Em React: precisa de `useEffect` com limpeza do intervalo; para CMS dinâmico, o passo deve ser recalculado a cada ação (já é) e as larguras devem continuar vindo do CSS (flex-basis percentual).

### 7.6 Carrossel antigo (morto) — para decidir
`cb-profissionais-carousel-real-js` (L6982) implementava cards grandes `.cb-pro-card` (280px), autoplay 2800ms, drag com ponteiro (limiar 5px, bloqueio de clique), setas ←/→ com `disabled`, pausa por hover/foco/toque/aba oculta. **Não é o que aparece hoje.** Se o cliente quiser esses extras (drag, disabled, pausa por toque), é novo escopo; a fidelidade visual atual é a do slider dc32.

---

## 8. Componentes reutilizáveis e fidelidade

### 8.1 Candidatos a componente
`SiteNav`; `Hero` (com `HeroEffects`: `HeroEnergy`, `HeroRibbons`, `HeroBoldFx`, `HeroVideoStyleFx`, `TelemetryCanvases` (3 canvas em um hook), `ParticleField` genérico parametrizado por contagem/ranges); `Eyebrow` (badge), `SectionHeading` (h2 com trecho em destaque `<span>`), `Button` (variantes `primary` dourado/preto com shimmer e neon), `Reveal` (wrapper com IO, `delay` 0-4), `ProfessionalsSlider` + `ProfessionalCard` (+ `SliderArrow`), `Marquee`, `CourseCard`/`CourseGrid`, `BenefitCard`, `BrandCell`/`BrandStage`, `CtaBand`, `SiteFooter` + `FooterEnergy`, `SocialIcon`. Os mesmos padrões (badge "eyebrow", botão dourado, card de profissional) tendem a aparecer nas páginas de profissional e curso (ver `02-profissional.md` e `03-curso.md`).

### 8.2 O que não será reproduzido exatamente (ou depende de decisão)
1. **Tipografia Gilroy**: a fonte não está no pacote nem tem `@font-face`; o visual de referência de título/cards/footer só se reproduz com os arquivos de fonte (e licença). Sem ela, usar fallback altera largura do título (que é `nowrap`, `width:max-content`, e pode estourar o container em mobile) e o ritmo visual. Alternativa: confirmar se deve ser Gilroy ou o fallback Helvetica/Arial atual.
2. **Assistant**: sem os `.woff2` não carrega; como o visual atual já não a usa de fato (cai em sans-serif), tratá-la como não usada, salvo decisão contrária.
3. **Aleatoriedade**: partículas e canvas usam `Math.random()`; cada carga produz posições diferentes. Igualdade pixel a pixel é impossível; replicar a distribuição, as faixas e as contagens.
4. **Canvas dos 3 efeitos**: a soma visual depende da ordem de camadas (Left, base, Boost com `mix-blend-mode:screen`) e do DPR; replicável, mas custo de CPU é alto (ver 9).
5. **Altura do hero**: depende de `vh`/`min-height:790px` e do overlap `-90px` do bloco seguinte; em ≤900px o hero tem `height:auto` e resultado de 978-1276px medidos; reproduzir exige copiar os valores efetivos, não a intenção.
6. **Hover/estilo pós-patches de cursos e marcas**: o estado final de hover está sob camadas de `!important` que não verifiquei elemento a elemento (ver 6.4); recomendo validar com captura lado a lado.
7. **Links**: todos os `href` do Home são `file://` ou Shopify (`/products/...`, `/pages/perfil/...`, `/collections/all`, `customer_authentication/redirect`); precisam ser reescritos para as rotas do Next/CMS (não são fidelidade visual).

---

## 9. Riscos e pontos a confirmar

Críticos:
1. **Fonte Gilroy ausente** (ver 2.3/8.2): obter arquivos e licença, ou confirmar o fallback. Afeta título de Profissionais, nome nos cards, footer.
2. **Seletor da seção de profissionais vigente**: a Home usa `.professor-*` e `#professoresSlider`; a análise paralela de Profissional (`02-profissional.md`) e o CMS devem fornecer exatamente `nome`, `foto de card (quadrada, rosto no topo)` e `slug`. Hoje o card do Lukas tem link para arquivo inexistente.
3. **Carrossel**: 5 cards cabem em 1440; se o CMS passar de 5, passa a rolar em desktop. Confirmar se se deseja loop infinito (hoje rebobina), drag, ocultar setas sem overflow, pausa em toque e `prefers-reduced-motion`. Não inventei requisitos: o comportamento documentado é o vigente.
4. **Performance do hero**: 5 loops rAF permanentes, 3 canvas full-width (1440x790 x DPR) com `shadowBlur`, ~190 elementos com animação CSS infinita e `mix-blend-mode:screen`. Em mobile o impacto é provavelmente relevante (não medi FPS). Para manter o visual, recomenda-se pausar fora da viewport/aba oculta (não existe hoje) — decisão de fidelidade x custo.
5. **Hidratação/SSR**: todo FX deve ser client-only (aleatório, `getBoundingClientRect`, canvas).
6. **Camadas de parallax**: `--scroll-shift` não é usado; confirmar que não há efeito de scroll desejado (hoje inexistente).

Observações de qualidade/divergências visuais encontradas no snapshot (medidas; confirmar se são intencionais):
7. **h1 do hero cresce no mobile**: 61,6px em 1440, 43,8 em 1024, 38,5 em 900, mas 76,8 em 768, 62 em 620 e 58 em 390 (regras ≤900 de `cb-redesign` e blocos mobile sobrepõem os `clamp` de L7846).
8. **Tablet (768)**: grade de Cursos em 2 colunas deixa o 3º curso sozinho; Benefícios também (2+1). Em 768 e 390 o h2 de Marcas ("As marcas que fazem seu talento brilhar.") **é cortado à direita** (largura fixa/`nowrap`), visto nas capturas; o parágrafo de Marcas também transborda em 768.
9. **Título de Profissionais** em 390px fica em ~14,8px por `clamp` + `nowrap`; confirmar legibilidade.
10. **Links de âncora**: o handler `a[href^="#"]` não pega os links do Home (são `file://…#cursos-home`); os ícones sociais com `href="#"` farão `querySelector('#')` lançar `SyntaxError` (não impede o clique, mas o comportamento esperado é rolar ao topo/nada). Reimplementar com `next/link` + `scroll-margin`.
11. **Marca inconsistente**: "Carreira Beauty" x "Academia Beauty" (ver 5), alt "Profissionais Carreira Beauty", logos `CARREIRA_BEAUTY_1_x320.png`/`header_2x` em disco sem uso: confirmar se há logotipo oficial em imagem (o nav usa texto).
12. **Link do curso 1** aponta para `/products/tecnica-da-navalha-moderna` mas o título é "Camadas Desconectadas Internas": confirmar o slug correto no CMS.
13. **Tags dos cursos** ("destaques" dourada + "online") são fixas no HTML; definir se vêm do CMS (destaque/modalidade).
14. **Footer**: bloco `.cb-footer-top`/`.cb-footer-bottom` existe oculto (links Navegação/Social com URLs placeholder `facebook.com`, `intagram.com` com erro de digitação); redes sociais `href="#"`. Confirmar URLs reais. `<footer class="cb-footer-fx" class="cb-footer">` tem atributo `class` duplicado (o 2º é ignorado).
15. **Imagens**: perfis com até 2990x3397 e hero 758 KB PNG; definir pipeline de imagens (`next/image`, WebP/AVIF) sem alterar enquadramento (`object-position:center top` nos cards; `contain/center bottom` no hero com máscara).
16. **Acessibilidade**: setas têm `aria-label`; imagens têm alt; os cards `<a>` carecem de texto "ver perfil" além de "Conheça"; ícones sociais têm `aria-label`; h1 único (ok); hero tem `aria-hidden` nas camadas; autoplay de 4s sem controle de pausa para teclado/leitor (WCAG 2.2.2) — pode ser requisito a decidir.
17. **Dependência do viewport**: hero usa `vh` e valores absolutos de `top` (128px) no desktop; medições feitas em altura 900. Em outras alturas (ex.: `(min-width:1000px) and (max-height:820px)`, 13 ocorrências) há ajustes que **não verifiquei**.
18. **Não verificado**: comportamento em Safari/Firefox (máscaras `-webkit-mask`, `backdrop-filter`, `mix-blend-mode`), hover final de cursos/marcas, valores nos breakpoints 1280/1100/1050/1000/999/680/520 de forma sistemática, e a renderização com Gilroy instalada.
19. As imagens de `assets/` têm prefixo-hash do salvamento (ex.: `504e0f..._lukas_perfil_new.png`): usar o nome sem prefixo ao importar, e substituir por mídia vinda do CMS.

### Resumo de decisões sugeridas
Migrar para React: tokens (`--cb-*`), `.cb-reveal` + IO, hero com FX (client-only), nav, slider dc32, cursos/benefícios/marcas/CTA/footer com os valores efetivos da seção 2.6 e do bloco vigente (não dos patches mortos). Não migrar: tudo listado em 1.2, 1.5, scripts 1-3, 12, 13, `--scroll-shift`, `swiper.css`, carrossel antigo, nó `02`.
