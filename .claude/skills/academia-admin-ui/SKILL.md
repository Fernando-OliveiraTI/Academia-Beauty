---
name: academia-admin-ui
description: Padrão visual e de UX do painel admin da Academia Beauty (apps/web). Use SEMPRE ao criar ou alterar qualquer tela, modal, lista, formulário, estado vazio, confirmação ou componente do painel (/admin). Proíbe alert/confirm/prompt do navegador, telas improvisadas e textos cortados; exige conferir a tela renderizada num navegador antes de dizer que terminou.
---

# Academia Beauty — padrão de UI do painel admin

O usuário rejeita telas improvisadas, feias ou com cara de "protótipo". Este documento é o contrato: tela nova segue o padrão abaixo, reaproveita os componentes que já existem e **só é entregue depois de vista renderizada** (seção "Verificação obrigatória").

## 0. Regras inegociáveis

1. **Nunca use `window.alert`, `window.confirm` ou `window.prompt`** (nem `alert(`/`prompt(`). Confirmação = `useConfirm()` de `components/confirm-dialog.tsx`. Aviso/erro = mensagem na própria tela (`role="status"` / `role="alert"`, classes `form-ok` / `form-error`) ou banner no padrão do modal. Há um teste (`src/lib/no-native-dialogs.test.ts`) que falha se alguém reintroduzir.
2. **Nada de `<select>` nativo quando a opção precisa de imagem, descrição ou busca.** Use o padrão do `ProductPicker` (campo + lista com miniatura e busca). `<select>` nativo só para listas curtas de texto (ordenar, itens por página).
3. **Nome que o usuário precisa ler nunca é cortado com reticências.** Quebre a linha (`white-space: normal; overflow-wrap: anywhere`). Reticências só em dado secundário (URL/ID longo) e sempre com o valor completo disponível (`title` ou outra linha).
4. **Sem sobras.** Nenhum painel, caixa ou `<dialog>` vazio visível. Em `<dialog>`, **nunca** ponha `display` no seletor base (anula o "fechado = oculto"): use `.minha-classe[open] { display: grid }`.
5. **Estado vazio é discreto.** Ícone pequeno (40 px) em fundo suave, título ~.9rem, uma frase, link de ação. **Nunca** borda tracejada, caixa grande ou aura: isso é cara de área de upload (dropzone) e só vale para upload de verdade (`media-dropzone`).
6. **Tipografia contida.** Modais e painéis densos: base `.8125rem`; títulos de cartão 1–1.15rem; nada acima de 1.3rem dentro de modal; rótulos de coluna em mono `.66–.72rem` com caixa alta. Se o usuário disse "a fonte está grande", reduza o conjunto todo, não um elemento.
7. **Só tokens.** Cores, raios, espaços e fontes vêm de `packages/design-system/src/tokens.css` (`var(--color-*)`, `--radius-*`, `--space-*`, `--font-*`). Sem hex solto: erro/destrutivo = `var(--color-error)`, sucesso = `var(--color-success)`. Dourado (`--color-primary`) é o único destaque.
8. **Idioma pt-BR**, frases curtas e concretas; erro diz o que fazer ("Cadastre a oferta antes de informar o ID"), não só o que falhou.

## 1. Linguagem visual (tokens)

Tema escuro. Fundo `--color-background #0b0a09`, superfície `--color-surface #151311`, superfície 2 `#1d1a17`, texto `#f6f2ea`, secundário `#aaa194`, mudo `#7c7468`, borda `rgba(246,242,234,.10)` e forte `.22`, dourado `#e3c98a`. Raios: 8 (campos/botões), 14 (cartões), 24 (modais grandes), 999 (pílulas/chips). Espaços 4/8/12/16/24/32/48. Fontes: Geist (texto) e Geist Mono (rótulos, IDs). Realce de destaque: `color-mix(in srgb, var(--color-primary) 10–14%, transparent)` com borda `color-mix(... 45–60%, transparent)`.

## 2. Catálogo — reaproveite antes de criar

| Preciso de… | Use |
|---|---|
| Cabeçalho de página | `.admin-hero` (`.admin-eyebrow` + `h1` + `p`) e `.admin-hero-actions` para botões |
| Lista paginada | `ListToolbar` (busca, `statusOptions`, ordenar, itens/página, abas com ícone) + `.admin-table` dentro de `.admin-panel` + `Pager` + `RowActions` |
| Linha de tabela de curso/profissional | capa retangular (`.cl-cover`, 160×64) ou avatar redondo só para pessoa (`.cl-avatar`); oferta com preço riscado + etiqueta `−N%`; data + `relativeTime` |
| Confirmar ação | `useConfirm()` (`tone: 'danger'` para apagar/remover; foco vai para Cancelar) |
| Modal grande com cartões | `<dialog className="media-dialog tm-dialog">`, blocos `.tm-card` (cabeçalho com `.tm-icon-box`), filtros em chips `.tm-filter`, rodapé com `Cancelar` (secundário) e ação principal em pílula |
| Escolher item com imagem | `ProductPicker` (digitar o ID **ou** abrir lista com busca, miniatura 4:3, nome completo, ID mono) |
| Imagem de campo | `ImageField` + janela "Trocar arquivo" (`media-dropzone` só aqui) |
| Galeria de modelos | `TemplateGallery` |
| Formulário em etapas | `wizard-ui` (`WizardSteps`, `PanelHead`, `Field`/`TextArea` do design-system com ícone, prefixo, dica, contador) |
| Painel do editor visual | `.ed-form` / `.ed-advanced`; ver regras de overflow abaixo |
| Filtro por situação | chips `.tm-filter` com contagem (`aria-pressed`), nunca `<select>` escondendo as opções |
| Estado vazio | `.tm-empty` (discreto) — ver regra 5 |
| Botão só com ícone | `.icon-button` 40–46 px, `aria-label` **e** `title` |

Padrões de comportamento: campo + botão de salvar ao lado (ícone ✓) para edição inline; ação destrutiva sempre com `useConfirm`; sucesso mostra banner/linha de status e **atualiza a lista na hora** (`router.refresh()` + recarregar o resumo); Esc fecha só a camada mais de cima; clicar no fundo do modal fecha.

## 3. Regras de layout que já quebraram aqui

- **Grid/flex com filhos de conteúdo longo**: `grid-template-columns: minmax(0, 1fr)` e `min-width: 0` nos filhos. Sem isso, um campo de URL estoura o painel e aparece barra de rolagem horizontal (aconteceu no painel Avançado do editor).
- `<fieldset>` precisa de `min-width: 0`.
- **Contêiner com rolagem** (`overflow: auto`): `padding-right` + `scrollbar-gutter: stable`; campo nunca encostado na barra.
- **Popover/lista suspensa** não pode ficar dentro de ancestral com `overflow: hidden` (corta a lista). Cartões que hospedam popover não usam `overflow: hidden`.
- Colunas de tabela larga: dê `fr` proporcional ao conteúdo (nomes ~2.3fr, etiqueta ≥1.4fr, "o que muda" ~2.8fr); etiqueta com `white-space: nowrap` precisa de coluna que a comporte.
- Capas de curso/produto: **retangulares 4:3**; redondo só para foto de pessoa.
- Em ≤ 1000 px (modais/tabelas) empilhe as colunas em 1; nada de rolagem horizontal da página.
- Imagem que pode faltar: `onError` **e** checagem `img.complete && naturalWidth === 0` ao montar (a falha pode ocorrer antes da hidratação); mostre ícone/inicial como substituto.
- Ícone dentro de componente com `img` genérico: escope a regra (`.tm-course .tm-ext img`) para a regra da capa não esticar o ícone.

## 4. Verificação obrigatória (antes de dizer "pronto")

1. Código: `pnpm --filter @academia/web typecheck`, testes do web (`pnpm exec vitest run`) e, se mexeu na API, `PUBLIC_SHOW_DRAFTS=false node ace test`.
2. **Ver a tela renderizada.** Dev servers: web `pnpm dev` (3100) e API `node ace serve --hmr` (3333) — recarregam sozinhos; só reinicie a API se mudar `.env`/`config`.
   Script Playwright (em `scratchpad`, importando `playwright-core` de `apps/web/node_modules`; usa `channel: 'chrome'`): faz login em `/admin/login` com `ADMIN_EMAIL`/`ADMIN_PASSWORD` lidos de `apps/api/.env` **sem imprimir a senha** (autorizado só para testes locais), abre a tela, tira screenshot do elemento/página e **leia a imagem**.
3. Teste de estouro horizontal: no navegador, `[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > container.right + 1)` deve voltar vazio; `scrollWidth <= clientWidth` nos contêineres de rolagem.
4. Confira em ~1440 px **e** ~390 px. Abra os estados que a tela tem: vazio, carregando, erro, com muitos itens, nome longo, popover aberto.
5. Se o usuário mandou referência (imagem), compare ponto a ponto e liste o que **não** seguiu e por quê. Não invente comportamento que a referência não mostra; pergunte quando a decisão for do negócio.
6. Se a ação toca dados reais (remover vínculo, apagar), **cancele** no teste; nunca confirme ação destrutiva em dado do usuário só para validar.
7. Só então relate, dizendo o que foi **visto** e o que não foi.

## 5. Anti-padrões (todos já aconteceram — não repetir)

- `window.confirm(...)` para despublicar/arquivar/apagar → use `useConfirm`.
- Estado vazio com borda tracejada e caixa enorme (parece dropzone).
- Modal com fonte do tamanho da página (parece zoom); títulos de 1.7rem dentro de modal.
- `<dialog>` com `display: grid` no seletor base → painel vazio aparece no cabeçalho da página.
- Nome do curso/produto cortado com "…" na lista suspensa.
- Grid de painel lateral estourando por campo de URL (sem `minmax(0, 1fr)`).
- Campo encostado na barra de rolagem.
- Lista de produtos num `<select>` nativo sem miniatura.
- Bloco duplicado para a mesma tarefa (ex.: seção separada para digitar ID quando o campo cabia na própria linha) — pergunte/olhe a referência antes de criar uma tela nova para algo que cabe na existente.
- Ícone esticado por regra de imagem genérica; capa redonda onde o padrão é retangular.
- Dizer "pronto" sem abrir a tela.

## 6. Checklist final (marque mentalmente)

- [ ] Nenhum `alert/confirm/prompt` nativo; destrutivo usa `useConfirm(tone: 'danger')`.
- [ ] Só tokens; fonte contida; sem hex solto.
- [ ] Nomes legíveis (quebram linha); sem reticências em dado principal.
- [ ] Estados: vazio discreto, carregando, erro com ação, sucesso com atualização imediata.
- [ ] Botões de ícone com `aria-label` + `title`; foco visível; Esc fecha só o topo.
- [ ] Sem estouro horizontal em 1440 e 390 px; popover não cortado.
- [ ] Reaproveitou componente existente (tabela acima) em vez de criar variante.
- [ ] Vi a tela renderizada e comparei com a referência, quando houve.
- [ ] typecheck + testes passam; nada commitado sem pedido.
