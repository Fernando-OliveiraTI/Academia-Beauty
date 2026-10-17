# Análise técnica 02 — Página de Profissional (Lukas_20.html)

Escopo: somente leitura. Arquivo analisado integralmente: `/Users/fernandomartins/Downloads/Site_Academila/Lukas_20.html` (1.946 linhas). Linhas citadas referem-se a esse arquivo. Itens não verificados estão marcados como "NÃO VERIFICADO".

---

## 1. Diagnóstico geral

**Estrutura (HTML estático, 1 arquivo, CSS e JS inline)**

| Bloco | Linhas |
|---|---|
| `<head>`: meta, `<title>`, `<style>` principal | 1-925 |
| 6 blocos `<style>` de patch (vídeo local, hero v2, hero v3, ticker v4, ticker speed) + 2 `<script>` de ticker | 927-1112 |
| `<body>`: nav, hero, bio, trabalhos, vídeo, cursos, footer | 1115-1347 |
| 6 `<script>` (reveal, partículas CSS, 3 canvas) | 1349-1943 |

- Tamanho: ~925 linhas de CSS principal + ~190 de patches; ~600 linhas de JS; ~230 linhas de HTML.
- O arquivo é resultado de camadas de patches ("v2", "v3", "v4", "match-home"), com abundância de `!important`. A regra efetiva é sempre a última na cascata. Na migração é preciso resolver a cascata final e não copiar cada bloco.
- Dependências externas: apenas Google Fonts (`@import`, linha 9) e uma imagem remota do CDN Shopify (linha 1289). Sem bibliotecas JS (vanilla). Sem frameworks CSS.
- Herdado de Shopify / lojas (trocar):
  - Linha 1288: `href="https://g0r0t0-50.myshopify.com/products/cortes-simples-com-navalha"` (loja de teste Shopify; o slug "cortes-simples-com-navalha" não corresponde ao curso "Morena Iluminada").
  - Linha 1289: `src="https://cdn.shopify.com/s/files/1/0734/9180/8491/files/morena_iluminada_lukas_campos_v2.png?v=1756913692"`.
  - Linha 1307: `id="shopify-section-footer"` (id herdado do tema Shopify; sem uso por CSS ou JS neste arquivo).
- Outros links/textos que precisam de decisão:
  - Linha 1118 `href="#"` (brand), 1124 `href="#"` ("Acessar conta ↗"), 1326-1338 cinco redes do footer com `href="#"` (placeholders, sem URL real).
  - Linha 1186: `https://instagram.com/@lucascam` está incorreto (instagram.com/@usuario não é URL válida; o correto é `instagram.com/lucascam`). Atualmente o handle exibido tem "@" e a URL também.
  - Botões "+" da seção de trabalhos (1219, 1236, 1253) apontam para `#video` (âncora interna), não para um detalhe do trabalho.
- Inconsistências de conteúdo no original:
  - Grafia: "Lukas Campos" (title, hero, nav) vs "Lucas Kampos" (bio, linha 1183) vs "lucas" (bio, linha 1184) vs handle `@lucascam`.
  - Marca: nav "CARREIRA BEAUTY" (1118), eyebrow "Profissional / Carreira Beauty" (1148), ticker "CARREIRA BEAUTY", footer "ACADEMIA BEAUTY" (1323) e copyright "Academia Beauty" (1345). A marca da plataforma precisa ser definida (confirmar).
  - Numeração dos `section-index`: 01 TRAJETÓRIA, 03 CONHEÇA, 04 CURSOS; não existe "02" (a seção de trabalhos não tem section-index).
- Código morto / órfão:
  - `.work-card`, `.work-grid`, `.section-head` (linhas 899-900, 1351, 1360): não existem no HTML.
  - A regra `@media(max-width:900px){.work-grid{...}}` é inócua. Entre 621 e 900px os trabalhos continuam em 3 colunas (a grade `.cb-courses` só vira 1 coluna em ≤620px).
  - `.section-index` não tem regra-base de CSS. Só recebe `color:#000 !important` na bio (linha 1028) e `style="color:#76601b"` inline no cursos (1282). Na seção de vídeo (1264) fica sem estilo próprio (herda 16px Geist branco). Confirmar se o design desejado é esse ou se havia uma regra perdida; ver Lukas_11.html (não analisado a fundo).
  - `.hero-portrait`/`.hero-hud` ficam fora de `.hero-grid` e são posicionados em absoluto (linhas 1165-1172).
  - `.profile-hero:after{display:none !important}` (51-53) é resíduo.
  - Script do ticker é executado duas vezes (1065 e 1095); só o segundo prevalece.
- Arquivo irmão `lukas/Lukas_11.html` (1.825 linhas) é versão anterior; diferença de classes é basicamente o footer novo. Não foi usado como fonte.

---

## 2. Inventário de CSS

### 2.1 Tokens (`:root`, linhas 11-21)

| Token | Valor |
|---|---|
| `--black` | `#050505` |
| `--black2` | `#0b0b0b` (declarado; NÃO VERIFICADO uso — não encontrado em regras lidas) |
| `--white` | `#f7f6f1` |
| `--gold` | `#E1C986` |
| `--gold-deep` | `#9A7312` |
| `--line` | `rgba(255,255,255,.14)` |
| `--muted` | `rgba(255,255,255,.68)` |
| `--mono` | `'JetBrains Mono',monospace` |
| `--sans` | `'Geist',Arial,sans-serif` |

Variáveis dinâmicas usadas só por JS: `--x`, `--dur`, `--delay`, `--dx` (partículas CSS, linhas 202-205, 396).

### 2.2 Fontes

- Carregamento: `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap')` na linha 9 (bloqueante no CSS; em Next usar `next/font/google` com `Geist` pesos 400-800 e `JetBrains_Mono` 400-600, `display:swap`).
- Geist: 400, 500, 600, 700, 800. JetBrains Mono: 400, 500, 600. Os pesos 700 e 800 de mono não são carregados, mas há `font:700 9.5px/1 var(--mono)` e `font:700 8.5px/1` (tags): o navegador sintetiza negrito (diferença visual sutil; confirmar ao migrar).
- Footer usa `font-family: Arial, sans-serif !important` (770), diferente do resto do site.
- Canvas usa `ctx.font='8px JetBrains Mono, monospace'` (1581).

### 2.3 Cores recorrentes

Ouro `#E1C986` / brilho `#FFEEB1`, `#FFF0B6`, `#FFEAAE`, `#FFF1BD`, `#FFF4C7`; ouro escuro `#9A7312`, `#B8871E`/`rgb(184,135,30)` (glow), `#76601b` (section-index cursos), `#554820` (small do Instagram), `#302916` (texto da bio). Fundos: `#000`, `#050505`, `#030303` (footer), `rgba(3,3,3,.88)` (nav), `rgba(4,4,4,.82)` (HUD), `#fff` (trabalhos), `#f3f0e7` (cursos), `#f9f8f5` (card trabalho), `#111`. Cinzas de texto: `#aaa` (nav), `#777`, `#888`, `#666`, `#5f5a53`, `#585349`, `#a0a0a0`, `#d1d1d1`.

### 2.4 Layout e espaçamentos-chave

- `.cb-container`: `width:min(1180px,calc(100% - 56px)); margin:auto` (30).
- Nav: fixa, top 10px, `width:min(1120px,calc(100% - 34px))`, altura 64px, radius 999px, `backdrop-filter:blur(18px)`, padding `0 12px 0 22px` (33-38).
- Seções: hero `padding-top:120px; min-height:780px`; bio `padding:70px 0`; trabalhos `72px 0`; vídeo `110px 0`; cursos `60px 0 80px`; footer `60px 20px 40px`.
- Grades: hero `minmax(420px,.82fr) minmax(0,1.18fr)` gap 30 (sobrescrito ≥1000px, ver abaixo); bio `.82fr 1.18fr` gap 60; trabalhos `repeat(3,minmax(0,1fr))` gap 20; vídeo `.55fr 1.45fr` min-height 520.
- Z-index: nav 50; hero-hud 7; hero-grid/copy 5; hero-portrait 4; telemetry-layer 3; video-style-fx 2; hero-portrait:before 2.

### 2.5 Breakpoints `@media` exatos

| Query | Linhas | Efeito |
|---|---|---|
| `(max-width:900px)` | 893-902 | esconde `.cb-links`; hero 1 coluna (min-height 720, align start); `.hero-copy` padding-top 30; `.hero-portrait` width 100%, right 0, top 320, height 520, opacity .65; `.hero-hud` top 330; `.bio-grid,.section-head,.video-shell` 1 coluna; `.video-info` min-height 300 (`.work-grid` morto) |
| `(max-width:620px)` | 903-924 | container `calc(100% - 34px)`; `.cb-account` padding 12/14; hero min-height 760; `.hero-name` 64px; `.hero-sub` 15px; `.hero-meta` 1 coluna (borda superior entre itens); portrait top 380 / height 400; **`.hero-hud{display:none}`**; bio padding 48; trabalhos padding 48 e **1 coluna gap 16**; vídeo padding 72; cursos padding 50; `.course-head` coluna gap 12; `.course-card` min-height 180, **height auto**, padding 22; logo footer 20px; social gap 16; copyright 11px |
| `(min-width:1000px)` | 940-989 | hero-grid `width:min(1180px,calc(100% - 56px))`, colunas `minmax(410px,500px) minmax(0,1fr)`; portrait `right:11%; top:78px; width:43%; max-width:650px`; img `scale(1.06)`; HUD `top:136px; right:8.5%; width:175px; padding:18px 20px`; gradiente `:before` ajustado (`#000 0%, .55 9%, .10 20%, transparent 34%` + base) |
| `(min-width:1500px)` | 991-1000 | portrait `right:15%; width:40%`; HUD `right:12.5%` |
| `(min-width:1000px)` (v3) | 1004-1013 | portrait `right:19%; width:43%`; HUD `right:16.5%` (valor final ≥1000) |
| `(min-width:1500px)` (v3) | 1015-1024 | portrait `right:22%; width:40%`; HUD `right:19.5%` (valor final ≥1500) |
| `(prefers-reduced-motion:reduce)` | 1058-1062 | `.bio-section .bio-bg{animation:none !important}` — ver 3.4: **na prática é anulada** |

Faixa 901-999px: usa regras base (portrait `right:-1%; width:58%; top:74px`, grid base). Valores finais do portrait: base `right:-1%/58%`; ≥1000 `19%/43%`; ≥1500 `22%/40%`.

### 2.6 Cascata final por seção (valores que valem)

Itens da cascata importante: quase todas as regras de `.work-section`, `.course-*` e footer usam `!important`; reproduzir direto os valores finais, sem `!important`, usando CSS Modules/Tailwind com escopo.

---

## 3. Inventário de JS

Não há bibliotecas. Todos são IIFEs vanilla.

| # | Script (id / linhas) | Finalidade | APIs |
|---|---|---|---|
| 1 | `cb-lukas-trajetoria-ticker-script` (1065-1081) | Preenche `.bio-section .bio-bg` com `'LUKAS • CARREIRA BEAUTY • '.repeat(8)` | DOMContentLoaded |
| 2 | `cb-lukas-ticker-content-match-home` (1095-1112) | Sobrescreve com 4 repetições de `LUKAS • CARREIRA BEAUTY • ` (**vence o nº 1**) | DOMContentLoaded |
| 3 | reveal (1349-1369) | Revela `.reveal,.work-card,.cb-course` ao entrar na viewport | IntersectionObserver |
| 4 | `cb-video-style-hero-fx-script` (1371-1393) | Gera 72 `<span class="cb-particle">` em `.cb-particle-field` | Math.random, setProperty |
| 5 | `cb-telemetry-canvas-script` (1395-1610) | Canvas principal `#cbTelemetryCanvas` | canvas 2D, rAF, resize |
| 6 | `cb-telemetry-fullwidth-script` (1612-1745) | Cria `#cbTelemetryCanvasLeft` (inserido antes do base) | canvas 2D, rAF |
| 7 | `cb-telemetry-bold-script` (1747-1943) | Cria `#cbTelemetryCanvasBoost` (inserido depois do base) | canvas 2D |

### 3.1 Detalhes dos scripts

**Reveal (3)**: `threshold:.14`, `rootMargin:'0px 0px -6% 0px'`. Ao interseccionar, `setTimeout(add 'in', idx*100)` onde `idx` é o índice do elemento entre os irmãos **somente se o pai tem classe `work-grid` ou `cb-courses`**; senão atraso 0. Faz `unobserve` (dispara uma vez). Fallback sem IO: adiciona `in` em todos. Não respeita prefers-reduced-motion. Observação: `.cb-course` é alvo do seletor, mas esses cards já têm `.reveal` (dupla seleção inofensiva, `els` pode conter duplicatas? Não: querySelectorAll com seletor único não duplica).

**Partículas (4)**: 72 partículas, a cada 10ª (`i%10===0`) com classe `big`. Por partícula: `--x` 5-95% (2 casas), `--dur` 7-15s, `--delay` negativo 0 a -14s, `--dx` -42..+42px. Aleatoriedade em runtime → em React gerar em `useEffect`/estado client (evitar hydration mismatch).

**Canvas base (5)**: DPR limitado a 2; dimensão = `getBoundingClientRect()` do hero (`.profile-hero`). Cria 95 `dots`, 28 `trails`, 5 `pulses` na 1ª `resize` (não recria em resizes seguintes; posições não são reescaladas). Por frame: `clearRect`; grade (alpha .075, `rgb(225,201,134)`, linha .5, espaçamento 54, linhas horizontais deslizam `(time*.008)%54`); trails verticais com gradiente (vy .18-.73, len 12-66, alpha .12-.54); dots (vx ±.08, vy -.10..-.44, raio .6-2.1, alpha .14-.79, twinkle `tw+=.025`, `life` 300-1000 frames, `shadowBlur=r*5`, a cada 13º desenha quadrado 8×8 de contorno); conexões entre dots com `dist² < 7200` (alpha até .075; O(n²) = 95·94/2 ≈ 4.465 pares/frame); 5 pulses horizontais (speed .65-1.8, width 60-220, delay 0-200 frames); 8 rótulos de texto `NODE 05, SYNC, LIVE, TRACE, DATA, 08:24, CB/01` (fonte 8px mono, alpha .22), posições `W*(.08+(q%4)*.27)`, `H*(.22+floor(q/4)*.52)`. `requestAnimationFrame` contínuo (sem pausa fora da viewport nem em `visibilitychange`). **Reduced motion**: lê `matchMedia` uma vez; se reduzido, desenha 1 frame estático e não agenda rAF. Não remove listener de resize (sem cleanup).

**Canvas left (6)**: 54 `points` (vy .08-.30, vx ±.05, raio .5-1.7, alpha .08-.46) + 18 `streams` (len 12-50, speed .14-.46); grade espaçamento 58 alpha .055 (estática); quadrado 6×6 a cada 11º. Chamado após `setTimeout(...,50)` e só se `canvas.dataset.ready` existir. Respeita `reduced` (1 frame). Estilos: inline opacity .78 (**anulado por CSS `#cbTelemetryCanvasLeft{opacity:1 !important}`**, linha 247), `mix-blend-mode:screen`, `filter:brightness(1.35) contrast(1.12)`. Obs.: não define `style.width/height` em px (usa 100% do CSS) e não chama resize para dimensões fora do `resize` (ok).

**Canvas boost (7)**: 150 `particles` (raio .7-2.5, alpha .18-.86, vy -.12..-.54), 46 `streams` (len 18-88, speed .22-.92, `shadowBlur` 5), 9 `packets` (speed .9-2.7, width 90-310, altura 1.8, `shadowBlur` 8); grade espaçamento 46 alpha .10; conexões (`i+=2`, `j+=8`, `d² < 10500`, alpha até .12). `setTimeout(...,80)`.
  **BUG verificado (linha 1927)**: `if(!reduce) requestAnimationFrame(draw);` usa `reduce`, mas nesse escopo a variável declarada é `reduced` (1772). `reduce` não existe → `ReferenceError` ao fim do primeiro `draw()`. Resultado: a camada Boost desenha **apenas 1 frame estático** (as partículas não se movem), e o erro aparece no console. Hoje o "visual" aprovado inclui esse quadro estático. Decisão necessária: reproduzir fielmente (frame estático) ou corrigir e animar (muda o visual, mais denso e com custo de CPU maior). Recomenda-se confirmar com o dono antes. NÃO VERIFICADO em navegador (análise estática).

**Carga total do canvas**: 3 canvas full-hero (largura × altura do hero, DPR até 2), blur/brightness via CSS `filter` + `mix-blend-mode:screen` em cada um: custo de GPU/CPU significativo, sobretudo em mobile. Sem `IntersectionObserver` para pausar quando o hero sai da tela.

### 3.2 Ticker da bio

- Texto final: `LUKAS • CARREIRA BEAUTY • ` ×4 (script 2). HTML original tem texto diferente (`LUKAS • CARREIRA BEAUTY • LUKAS •`, 1176), sobrescrito por JS.
- CSS final (1083-1093 vence sobre 1042 e 1045-1052): `animation:cbLukasMarqueeHome 90s linear infinite; to{transform:translateX(-50%)}`; `width:max-content; white-space:nowrap; will-change:transform; top:8px; left:0; opacity:.14; color:#9A7312`. Pausa em `.bio-section:hover` (`animation-play-state:paused`). Fonte `clamp(75px,8vw,130px)`, peso 800, tracking -.06em.
- `@keyframes cbLukasMarquee` (24s, -33.333%) fica órfão.

### 3.3 `prefers-reduced-motion`: resumo

| Item | Respeita? |
|---|---|
| Canvas base (5) | Sim (frame único) |
| Canvas left (6) | Sim (frame único) |
| Canvas boost (7) | Parcial/bug: nunca anima de qualquer forma |
| Keyframes CSS da hero (horizon, energy bed, grid, threads, particles, pulse dots, telemetry horizon/glow/scan/atmosphere) | **Não** |
| Ticker | **Intencionalmente sim, mas a regra (1058-1062, `.bio-section .bio-bg` + `!important`) vem ANTES da regra de 90s (1084-1086, mesma especificidade `.bio-section .bio-bg`, `!important`), que vence.** Ticker anima mesmo com reduced motion |
| Reveal (`.reveal`) | Não |
| Hover transitions | Não |
| `html{scroll-behavior:smooth}` | Não |
| Vídeo `autoplay` | N/A |

Em Next: sugerido manter fidelidade e, adicionalmente, tratar reduced-motion corretamente (decisão a confirmar, pois diverge do original).

---

## 4. Assets

Referenciados por `Lukas_20.html`:

| Referência (linha) | Uso | Em disco? |
|---|---|---|
| `lukas/lukas_perfil.png` (1166) | retrato do hero (PNG RGBA 1092×1649, 830 KB) | Sim |
| `lukas/trabLukas01.png` (1208) | trabalho 1 (PNG 379×379, 264 KB) | Sim |
| `lukas/trabLukas02.png` (1225) | trabalho 2 (379×379, 269 KB) | Sim |
| `lukas/trabLukas03.png` (1242) | trabalho 3 (379×379, 272 KB) | Sim |
| `lukas/video.mp4` (1271) | vídeo de apresentação, 28,6 MB | Sim; `file` identifica como "ISO Media, Apple QuickTime movie (.MOV/QT)"; codec/duração/resolução NÃO VERIFICADOS (ffprobe indisponível). Servido com `type="video/mp4"`; risco de compatibilidade se for HEVC/ProRes |
| `https://cdn.shopify.com/s/files/1/0734/9180/8491/files/morena_iluminada_lukas_campos_v2.png?v=1756913692` (1289) | capa do card de curso | **Remoto (Shopify)**; não existe em disco; não verificada disponibilidade online. Em `assets/` existe `1e1015aed979ff25_morena_iluminada_cleber_capa_v.png` (Cleber, não Lukas) — não serve |
| Google Fonts (9) | Geist, JetBrains Mono | Remoto |

No disco mas **não referenciados** por Lukas_20:
- `lukas/trabLukas04.png` (379×379, 250 KB): disponível para um 4º trabalho.
- `lukas/Lukas_11.html` (versão anterior).
- Todo o `assets/` (14 arquivos) pertence à página inicial (`grupo-home`, `CARREIRA_BEAUTY`, logos Schwarzkopf/L'Oréal/Kérastase, perfis de Miro/Paolo/Cleber/Neandro, capas). Nenhum é usado em Lukas_20. Observação: `assets/504e0fc222311dc5_lukas_perfil_new.png` é na verdade WebP (RIFF/Web/P) com extensão .png, e não é referenciado.

Observações de qualidade:
- Retratos e trabalhos são PNG pesados. Trabalhos 379×379 são exibidos em cartões ~380px de largura × 320px de altura (object-fit cover) → ficam borrados em telas HiDPI. Em Next convém imagens maiores do CMS e `next/image`.
- O retrato depende de transparência (PNG RGBA) e do filtro `grayscale(1) contrast(1.05) brightness(.9)`; um upload JPG de fundo opaco do CMS mudaria o resultado. Exigir PNG/WebP com fundo transparente ou confirmar o recorte (a máscara `:before` só cobre o lado esquerdo e o fundo).
- Sem favicon, sem `og:image`, sem meta description no original.

---

## 5. Seções em ordem

| # | Seção / seletor raiz | Linhas HTML | CSS principal | Dinâmico (cadastro do profissional) | Conteúdo visual da página (fixo ou do template) |
|---|---|---|---|---|---|
| 0 | Nav `nav.cb-nav` | 1117-1125 | 33-44 | — (itens fixos; link "Acessar conta" para login da plataforma) | marca, âncoras `#trabalhos #video #cursos`, texto "Acessar conta ↗" |
| 1 | Hero `header.profile-hero.cb-hero` (+ `.cb-telemetry-layer`, `.cb-video-style-fx`, `.hero-grid`, `.hero-portrait`, `.hero-hud`) | 1127-1173 | 47-419, 940-1024 | nome (1149: "Lukas" + `<span>Campos.</span>`), foto (1166), handle Instagram (1155), seguidores (1159, "53,6 Mil seguidores"), anos de experiência (1171, "15"), área/especialidade (1170, "Expert / Hair") | eyebrow "Profissional / Carreira Beauty", subtítulo (1150 "Seus sucessos na carreira e sua jornada profissional." — genérico mas pode ser texto de template ou campo "frase de destaque"), labels "Instagram"/"Comunidade", todos os efeitos |
| 2 | Bio `section.bio-section` | 1175-1195 | 422-441, 1027-1093 | texto do ticker (nome), título (1180 "Uma carreira construída com **técnica.**" — pode ser fixo ou campo), parágrafos da bio/trajetória (1183-1184, rich text multi-parágrafo), handle e seguidores (1188-1189), URL do Instagram (1186) | "01 / TRAJETÓRIA", "CARREIRA BEAUTY" no ticker, círculo "↗" |
| 3 | Trabalhos `section.work-section#trabalhos` | 1197-1258 | 443-616 | lista de trabalhos em destaque (imagem, título, categoria-tag, nome do profissional, alt) | eyebrow "Trabalhos em Destaque", h2 "Assinatura que aparece nos detalhes." (1201), parágrafo (1202 contém o nome → parcialmente dinâmico), tag fixa "destaques", botão "+" |
| 4 | Vídeo `section.video-section#video` | 1260-1276 | 618-628, 927-937 | arquivo/URL do vídeo, nome (h2 1265 "Conheça<br>Lukas Campos.") | "03 / CONHEÇA", parágrafo (1267, texto genérico com possível uso de nome) |
| 5 | Cursos `section.course-section#cursos` | 1278-1304 | 630-759 | título "Cursos de Lukas." (1283, primeiro nome do profissional), **lista de cursos publicados** (ver seção 7) | "04 / CURSOS", parágrafo (1285) |
| 6 | Footer `footer.cb-footer-exact` | 1307-1347 | 761-886 | redes sociais da plataforma (não do profissional; hoje todos `#`) | logo "ACADEMIA BEAUTY", ondas/pontos, copyright "© 2026" (ano deveria ser derivado da data) |

Notas:
- O footer é da plataforma (global), deve virar componente compartilhado (provavelmente já existe na home).
- A bio do Lukas tem parágrafos longos e vários nomes próprios. Campo `bio` deve ser lista de parágrafos ou rich text (renderização com `.bio-text p:first-child{margin-top:0}`).
- O `h2` 1180 usa `<strong>` com a palavra "técnica." (sem estilo próprio além de negrito do h2 já 800). Pode ser texto fixo.

---

## 6. Mapa de animações e interações

### 6.1 Hero (tudo CSS, loops infinitos, sem gatilho)

| Seletor | Keyframes (linhas) | Duração / easing / iteração | Efeito |
|---|---|---|---|
| `.cb-digital-horizon` (114-135) | `cbHorizonPulse` (368) | 5.6s ease-in-out infinite | opacity .52↔1 e scaleX .93↔1.04 |
| `.cb-energy-bed` (137-152) | `cbEnergyBed` (372) | 6.5s ease-in-out infinite alternate | translateY(10→-8px), scaleX .92→1.07, opacity .58→1; blur 25px |
| `.cb-grid-floor` (154-170) | `cbGridDrift` (376) | 10s linear infinite | `background-position` 0 0 → 0 34px / 52px 0 (anima propriedade que não é composited); perspectiva 620px, rotateX 67deg |
| `.cb-light-thread.t1/t2/t3` (172-190) | `cbThread1/2/3` (380-391) | t1 6.4s alternate; t2 8s alternate-reverse; t3 9.5s alternate; ease-in-out infinite | rotate + scaleY + opacity |
| `.cb-particle` ×72 (192-209, JS) | `cbParticleUp` (392) | `var(--dur)` 7-15s linear infinite, delay `var(--delay)` | sobe 420px, desloca `--dx`, scale .7→1.15, opacity 0→.85→.45→0 |
| `.cb-pulse-dot.p1/p2/p3` (211-223) | `cbPulseDot` (398) | 3s ease-in-out infinite; delays .4s/1.2s/2s | scale .55↔1.25, opacity .28↔1 |
| `.cb-telemetry-horizon` (265-287) | `cbTelemetryHorizon` (402) | 4.8s ease-in-out infinite | opacity .65↔1, scaleX .94↔1.03 |
| `.cb-telemetry-glow` (289-306) | `cbTelemetryGlow` (406) | 6s ease-in-out infinite alternate | translateY/scaleX/opacity |
| `.cb-telemetry-layer::before` (308-329) | `cbFullTelemetryAtmosphere` (416) | 7s ease-in-out infinite alternate | manchas radiais com blur 14px, translate/scale/opacity |
| `.cb-telemetry-scan` (331-350) | `cbTelemetryScanEdgeToEdge` (410) | 8.5s ease-in-out infinite | linha vertical de `left:1%` a `98%` e volta (anima `left`, causa layout) |
| 3 canvas | — | rAF | ver seção 3 |

Observação: o "horizonte" aparece duas vezes (`.cb-digital-horizon` em `bottom:11%` + `.cb-telemetry-horizon`), camadas sobrepostas. Replicar ambas.

### 6.2 Reveal e transições

| Seletor | Gatilho | Duração/easing | Implementação |
|---|---|---|---|
| `.reveal` (889-890) (hero copy ×5, bio-title, bio-text, heading do trabalhos, 3 `.cb-course`, `.video-shell`, `.course-card`) | entrar na viewport (IO threshold .14, margem inferior -6%) | opacity `.75s ease`; transform `.9s cubic-bezier(.16,1,.3,1)`; estado inicial `opacity:0; translateY(35px)` | classe `.in` |
| Stagger dos 3 trabalhos | idem | atraso `índice*100ms` (0/100/200) via setTimeout | só filhos de `.cb-courses` |
| Hero copy (eyebrow, h1, sub, meta) | idem | **sem stagger** (todos na mesma hora, pois o pai `hero-copy` não é grupo) | — |
| `.cb-course:hover .cb-course-bg` (531) | hover | `transform .6s cubic-bezier(.16,1,.3,1)`, scale 1.04 | CSS |
| `.cb-course:hover .cb-plus` (612) | hover | `all .3s ease`; fundo `--gold`, texto `#111`, rotate 90deg | CSS |
| `.course-card:hover .course-card-bg` (683) | hover | `.8s cubic-bezier(.16,1,.3,1)` scale 1.03 | CSS |
| `.course-card:hover .course-plus` (757) | hover | `.3s ease`, rotate 90deg | CSS |
| `.cb-links a:hover` (43) | hover | sem transição, `#aaa`→`#fff` | CSS |
| `.cb-social-links a:hover` (868) | hover | `color .3s ease, transform .3s ease`; ouro + translateY(-2px) | CSS |
| Ticker `.bio-bg` | contínuo; pausa em hover da seção | 90s linear infinite, `translateX(-50%)` | CSS |
| Nav | `position:fixed`, sem esconder ao rolar, sem estado "scrolled" | — | — |
| `html{scroll-behavior:smooth}` | clique nas âncoras | — | nativo |

Observação: o `.reveal` define estado inicial `opacity:0` apenas por CSS. Sem JS, o conteúdo fica invisível (no original há fallback só para navegadores sem IO). Em SSR/Next, prever que o conteúdo é renderizado oculto até hidratar (SEO ok pois está no DOM, mas há flash). Atenção para elementos já visíveis na carga (hero): IO dispara na hidratação.

### 6.3 Interações sem JS adicional
- Vídeo: `controls playsinline autoplay preload="metadata"`, sem `muted` e sem `loop`. **Autoplay sem `muted` é bloqueado por Chrome/Safari/Firefox** na prática; o vídeo só começa por clique. Se a intenção é autoplay, precisaria de `muted` (decisão a confirmar). Texto de fallback "Seu navegador não suporta reprodução de vídeo HTML5.".
- Instagram card: `target="_blank"` sem `rel="noopener"` (1186).
- Não existe menu mobile (links ocultos em ≤900px; só resta o botão "Acessar conta").
- Não há tratamento de teclado/foco customizado (sem `:focus-visible`).

---

## 7. Seção de cursos (alimentada pelo CMS)

### 7.1 Estrutura exata (linhas 1278-1304)

```html
<section class="course-section" id="cursos">
  <div class="cb-container">
    <div class="course-head">
      <div>
        <div class="section-index" style="color:#76601b">04 / CURSOS</div>
        <h2>Cursos de Lukas.</h2>
      </div>
      <p>Conteúdo para aprofundar técnicas e aprender diretamente com o profissional.</p>
    </div>

    <a class="course-card reveal" href="{URL do curso}">
      <img class="course-card-bg" src="{capa}" alt="{título}">
      <div class="course-card-overlay"></div>
      <div class="course-card-body">
        <div class="course-tags">
          <span class="tag">30% OFF</span>
          <span class="tag dark">Lukas Campos</span>
        </div>
        <div class="course-bottom">
          <h3>Morena <span>Iluminada</span></h3>
          <span class="course-plus">+</span>
        </div>
      </div>
    </a>
  </div>
</section>
```

No original há **apenas 1 card** `.course-card`. É um `<a>` (card inteiro clicável) direto dentro de `.cb-container`; não existe wrapper de lista.

### 7.2 Dados por card

| Campo | Origem no original | Observação |
|---|---|---|
| Título (h3) | "Morena <span>Iluminada</span>" | A 2ª palavra é destacada em ouro (`h3 span{color:var(--gold)}`). **Regra de divisão não definida** no original (é manual). Proposta a confirmar: última palavra, ou campo `titulo_destaque` separado |
| Capa | URL remota Shopify (PNG) | `object-fit:cover; object-position:right center`; a composição pressupõe o sujeito à direita e o lado esquerdo coberto pelo overlay → exige arte em formato horizontal (proporção do card: largura do container ≈1180px × 200px ≈ 5.9:1, mas com cover recorta bastante); NÃO VERIFICADA a imagem Shopify |
| Tag de desconto | "30% OFF" (`.tag`, fundo ouro) | Só deve renderizar se houver desconto. Percentual calculado ou campo. Original só mostra % |
| Tag do profissional | "Lukas Campos" (`.tag.dark`, borda branca 30%) | Nome do profissional dono da página |
| Link | produto Shopify | Trocar pela rota do curso na plataforma (ex.: `/cursos/[slug]`), mesma aba (sem `target`) |
| Alt da imagem | "Morena Iluminada" | título do curso |
| Botão "+" | texto "+" fixo, não é link separado (card inteiro é o link) | decorativo |
| Preço, duração, nível, nº de aulas | **não existem** no card atual | não inventar; confirmar se o design pede mais |

### 7.3 CSS final do card (valores efetivos)

- `.course-card`: `height:200px; min-height:200px; position:relative; overflow:hidden; background:#050505; color:#fff; border-radius:24px; border:none; padding:28px 36px; display:flex; flex-direction:column; justify-content:space-between; isolation:isolate` (657-671). Em ≤620px: `min-height:180px; height:auto; padding:22px`.
- `.course-card-bg`: `position:absolute; inset:0; width/height:100%; object-fit:cover; object-position:right center; z-index:1; transition:transform .8s cubic-bezier(.16,1,.3,1)`; hover `scale(1.03)`.
- `.course-card-overlay`: `z-index:2; background:linear-gradient(90deg,#000 0%,rgba(0,0,0,.96) 30%,rgba(0,0,0,.65) 55%,rgba(0,0,0,.1) 80%,transparent 100%)`.
- `.course-card-body`: `z-index:3; flex coluna; space-between; height/width 100%`.
- `.tag`: `padding:5px 9px; background:var(--gold); color:#111; font:700 8.5px/1 var(--mono); letter-spacing:.08em; uppercase; radius 4px`; `.tag.dark`: transparente, branco, `border:1px solid rgba(255,255,255,.3)`. `.course-tags`: flex gap 8.
- `h3`: `clamp(32px,3.2vw,48px); weight 800; letter-spacing -.04em; line-height 1; branco`.
- `.course-plus`: 48×48, círculo ouro, `#111`, 22px, `box-shadow:0 6px 20px rgba(0,0,0,.25)`; hover do card: `rotate(90deg)` (`.3s ease`).
- Cabeçalho: `.course-head{display:flex; align-items:flex-end; justify-content:space-between; gap:30px; margin-bottom:24px}`; `h2 clamp(40px,3.6vw,56px)`; `p max-width:420px; 14px; #585349`.
- **Atenção**: nada define espaçamento entre múltiplos `.course-card`. O elemento `<a>` com `display:flex` é de nível de bloco, então vários cards ficariam **colados sem margem**, pois o original só tem 1. Com N cursos, será preciso definir `gap` vertical (ex.: wrapper `display:grid; gap:...`). Valor a confirmar com o design (sugestão não verificada: 20px, igual ao gap da seção de trabalhos).
- O stagger de 100ms por índice **não se aplica** aos cursos (o pai é `.cb-container`, não `.cb-courses`); todos aparecem com atraso 0 ao entrar na viewport, cada um com o próprio IO.

### 7.4 Recomendações para o CMS
- Componente `<CourseCard>` presentational recebendo `{slug, titulo, tituloDestaque?, capaUrl, desconto?, profissionalNome}`; lista = `cursos.filter(publicado && profissionalId)` ordenada (critério a definir: data/ordem manual).
- Estado vazio: o original não prevê. Definir (ocultar seção? mensagem?).
- Cada card deve ser envolvido pelo mesmo mecanismo de reveal.
- Título do h2 ("Cursos de Lukas.") usa o primeiro nome; para nomes compostos definir campo "nome de exibição curto".

---

## 8. Campos do modelo de dados usados pela página

Campos do profissional (deduzidos do HTML):

| Campo proposto | Exemplo no original | Onde usado |
|---|---|---|
| `nome_exibicao` (completo) | "Lukas Campos" | title, alt, nav/ticker, h2 vídeo, tag curso, aria-label vídeo, texto trabalhos |
| `primeiro_nome` | "Lukas" | h1 (linha 1), ticker "LUKAS", h2 "Cursos de Lukas." |
| `sobrenome_destaque` | "Campos." | h1 em contorno ouro `-webkit-text-stroke:1.6px` (inclui o ponto final do design) |
| `slug` | (implícito) | URL da página |
| `foto_perfil_hero` | `lukas/lukas_perfil.png` (PNG transparente) | hero-portrait |
| `instagram_handle` | "@lucascam" | hero meta, bio card |
| `instagram_url` | `https://instagram.com/@lucascam` (incorreto) | bio card |
| `seguidores` (texto) | "53,6 Mil seguidores" | hero meta + bio card (mesmo valor duplicado) |
| `anos_experiencia` | 15 | HUD ("15 anos") |
| `especialidade` / rótulo HUD | "Expert / Hair" | HUD |
| `frase_destaque` (opcional) | "Seus sucessos na carreira e sua jornada profissional." | hero-sub |
| `bio` (parágrafos / rich text) | 2 parágrafos | bio |
| `titulo_bio` (opcional) | "Uma carreira construída com técnica." | h2 bio |
| `trabalhos[]` | 3 itens (+ 1 imagem sobrando) | galeria |
| `trabalhos[].imagem` | trabLukas0X.png | idem |
| `trabalhos[].titulo` | "Morena Iluminada – Técnica & Contraste" | `.cb-course-title` |
| `trabalhos[].categoria` | "mechas", "loiro", "corte & cor" | segunda tag (minúscula via texto; CSS faz uppercase) |
| `trabalhos[].alt` | "Morena Iluminada" etc. | alt e aria-label do "+" (alt ≠ título completo) |
| `trabalhos[].link` | `#video` | botão "+" (destino real a definir) |
| `video_apresentacao` (URL/arquivo + poster?) | `lukas/video.mp4` | vídeo |
| `cursos[]` | 1 | seção cursos (via relação com cursos publicados) |

Não usados (não existem na página): cidade, e-mail, telefone, WhatsApp, marcas/parceiros, depoimentos, certificados, redes além do Instagram, SEO/OG, YouTube/TikTok pessoais (as redes do footer são da plataforma). Se o CMS tiver esses campos, não aparecem no design atual.

Textos que hoje contêm o nome embutido e precisam de template: parágrafo da seção trabalhos (1202 "Uma seleção exclusiva de trabalhos de Lukas Campos, ..."), parágrafo vídeo (1267, não cita o nome), aria-label do vídeo (1270), títulos de seção. O parágrafo 1202 também menciona "mechas, iluminação e acabamento" (específico de colorista) e o tag "destaques" é fixo → torná-los campos ou texto de template.

---

## 9. Componentes candidatos, limitações, riscos

### 9.1 Componentes reutilizáveis
- `<SiteNav>` (global, a home também deve ter nav semelhante; este usa marca "CARREIRA BEAUTY").
- `<HeroFx>` (grid-floor, horizon, energy bed, threads, partículas, pulse dots) + `<TelemetryCanvas variant="base|left|boost">` (hook `useTelemetryCanvas`; mesmo padrão copiado 3×; podem ser um só hook parametrizado, mantendo parâmetros de cada camada).
- `<Reveal delay>` (IntersectionObserver com mesmos parâmetros) — uso em todas as seções.
- `<Marquee>` (ticker do `.bio-bg`).
- `<SectionIndex>` e `<Eyebrow>` (pill do trabalhos e linha com ponto do hero).
- `<WorkCard>` (card claro 20px de radius), `<CourseCard>` (card escuro 24px de radius). Atenção: dois estilos de card diferentes, ambos com botão "+" que gira 90° ao hover.
- `<VideoShell>` (grid info + vídeo).
- `<SiteFooter>` (global; ondas + pontos).
- `<InstagramCard>`, `<MetaGrid>`, `<HeroHud>`.

### 9.2 Itens que não poderão ser reproduzidos exatamente / exigem decisão
1. Partículas CSS e posições dos canvas são aleatórias (`Math.random`): cada carga é diferente; no original também. Em React evitar render no servidor (hydration mismatch).
2. Canvas boost com frame estático por causa do bug `reduce` (3.1): "fiel" significa replicar um frame estático aleatório; provavelmente a intenção era animar.
3. Ticker com reduced-motion anulado por ordem de CSS; fidelidade vs. acessibilidade.
4. Autoplay do vídeo não funciona sem `muted`.
5. Efeito `.reveal` depende de IO; sem JS o conteúdo fica invisível.
6. Vídeo `.mp4` é um QuickTime de 28,6 MB: plano de entrega/transcodificação (HLS/MP4 H.264) a definir.
7. Retrato do hero: o visual depende de PNG recortado (fundo transparente) + filtro grayscale; fotos do CMS fora desse padrão quebram o layout (cortes, `object-fit:contain` encostado na base).
8. Alinhamento do hero em larguras 1000-1500px depende de percentuais empilhados em 3 patches; em Next deve-se consolidar nos valores finais listados em 2.5.
9. Imagens dos trabalhos 379×379 (baixa resolução para 320 px de altura em retina).
10. Texto "mono" bold sintético (JetBrains Mono 700/800 não carregado).
11. Cursos ocupam 200px de altura fixa e o design da capa pressupõe arte com sujeito à direita.

### 9.3 Riscos
- Performance: 3 canvas full-hero com `mix-blend-mode:screen` + `filter` + 72 partículas animadas + animações de `left` e `background-position` (não-compositadas); rAF sem pausa fora de tela; conexões O(n²). Sugerir pausar com IO/`visibilitychange` (alteração de comportamento a validar) e testar em mobile.
- Hero canvas dimensionado via `getBoundingClientRect` do hero: precisa re-medir em resize (original não reposiciona partículas existentes).
- `unobserve` permanente: reveal não repete (manter).
- Cascata `!important`/patches: risco de divergir se copiar de forma literal; verificar visualmente lado a lado.
- Conflito de conteúdo (Lukas/Lucas/Kampos) e de marca (Carreira Beauty/Academia Beauty).
- Links Shopify e imagem remota: se o domínio cair, o card quebra.
- Sem SEO básico (meta description, OG), sem `lang` por trecho, tags `<h2>` no footer logo (semântica ruim: footer usa `h2`).
- Acessibilidade: `.cb-plus` tem aria-label mas o card de cursos é um `<a>` com `<img alt>` sem texto de link claro; contraste do `#aaa` nav/`#777` labels em fundo preto não calculado (NÃO VERIFICADO); sem `prefers-reduced-motion` em CSS da hero.

### 9.4 Pontos a confirmar com o dono do produto
1. Definição da marca exibida no nav/ticker/eyebrow (Carreira Beauty vs Academia Beauty).
2. Grafia correta do nome ("Lukas Campos" vs "Lucas Kampos") e do Instagram (`lucascam`).
3. Quais textos são do template e quais viram campos (hero-sub, h2 bio, copy de trabalhos, copy de vídeo, copy de cursos, HUD "Expert / Hair").
4. Número de trabalhos em destaque (3 no HTML; existe `trabLukas04.png` não usado) e destino do botão "+".
5. Espaçamento entre cards de cursos com N > 1, ordenação, estado vazio, regra do destaque em ouro no título e origem do percentual de desconto.
6. Proporção/arte exigida para a capa do curso (formato horizontal ~5.9:1 recortado por cover).
7. Corrigir ou replicar o bug do canvas boost e o ticker em reduced-motion.
8. Vídeo: autoplay (com `muted`?), poster, formato final e onde hospedar.
9. Navegação: destino de "Acessar conta", ausência de menu mobile, URLs reais das redes do footer.
10. Se a faixa 621-900px deve manter 3 colunas na galeria (comportamento atual por regra morta) ou passar a 2.
