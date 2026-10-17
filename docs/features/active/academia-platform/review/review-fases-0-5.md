# Revisão independente — Fases 0 a 5 (2026-10-17)

**Método.** Três revisores independentes e somente leitura (API e contratos; renderer e fidelidade; web e editor), mais verificação própria dos itens de maior severidade. Projeto sem git: não há branch base nem diff; a referência é o código atual contra `plan.md`, `decisions.md`, `review-context.md` e `handoff.md`. Nenhum código foi alterado na revisão.
**Estado verificado:** typecheck e lint sem erros; testes api 59, renderer 58, web 34, editor-core 12, section-schemas 5, contracts 30, page-schema 16, design-system 4; E2E de todas as fases passando.
**Legenda:** CONF = confirmado (leitura e/ou reprodução); POT = risco potencial. "Repro" = reproduzido por mim.

## Alta
| # | Achado | Onde | Status |
| --- | --- | --- | --- |
| A1 | Profissional com nome de 61–80 caracteres derruba a **Home inteira** (500): o schema da vitrine limita a 60, o contrato aceita 80 e o builder não corta. Sem `error.tsx`. | `page-renderer/src/home/build.ts:19`, `section-schemas/src/home.ts:36`, `contracts/src/professional.ts:51` | CONF, repro |
| A2 | Builder do Profissional não corta texto: nome >40, especialidade >31, nome longo no ticker/vídeo geram documento inválido e a **página publicada dá 500**. Publicar não valida o documento montado. | `page-renderer/src/professional/build.ts:42,43,51,57,67,68,76,86` | CONF, repro |
| A3 | Menu do curso com `href` que não seja `#id` (ex.: `/x`, `https://…`) faz `querySelector` lançar e **a página de curso fica em branco**. O schema aceita qualquer URL segura. | `page-renderer/src/course/Effects.tsx:29` | CONF (jsdom) |
| A4 | Autosave perde edição feita durante um salvamento lento e mostra "Salvo"; "Publicar" fica preso em "aguarde". O efeito não reexecuta ao terminar o PUT. | `web/.../editor/editor.tsx:152-188` | CONF (leitura + código conferido) |

## Média
| # | Achado | Onde | Status |
| --- | --- | --- | --- |
| M1 | O **servidor não impõe as regras do editor** (D-021): documento sem `hero`/`course.offer`, vazio ou com seções repetidas é salvo e publicado. Publicar não revalida. Contradiz "servidor é a autoridade" (D-020). | `section-schemas/src/index.ts:23-32`, `document_service.ts`, `*_service.publish` | CONF, repro |
| M2 | `safeUrlSchema` aceita `/\host`, `/<TAB>/host`, `/<LF>/host` (viram `//host` no navegador): redirecionamento externo em qualquer link. Mesmo regex em `contracts`. | `page-schema/src/index.ts:10`, `contracts/src/professional.ts:11`, `course.ts:11` | CONF, repro |
| M3 | Quem tem só `courses.write`/`professionals.write` pode pôr link **https externo** em links secundários do documento e publicar; a allowlist e `commerce.manage` valem só para o CTA principal. Depende de política de negócio. | `section-schemas/src/course.ts` (header/hero.secondary/footer) | CONF código |
| M4 | A seção de demonstração `course.checkout` pode ser reexibida pelo editor num curso real: formulário de cartão/CPF sem efeito e textos fixos de PIX/boleto. | `course/build.ts:167`, `editor.tsx:290`, `course/Checkout.tsx` | CONF |
| M5 | Autosave: o retry em erro (4 s) nunca ocorre; resposta perdida gera falso "conflito" na tentativa seguinte; 401 não leva ao login; `publish`/restaurar sem `try/catch`. | `editor.tsx:161-219`, `lib/api-client.ts` | CONF / POT |
| M6 | D-020 promete aviso no assistente de que a página foi personalizada e o cadastro não a altera; **o aviso não existe** (só o link do editor). Edição do cadastro + publicar não muda a página. | `profissionais/wizard.tsx`, `cursos/wizard.tsx` | CONF |
| M7 | `SchemaForm` não permite limpar campos opcionais: objeto opcional parcial (ex.: `instructor.photo`) vira JSON inválido sem saída; número limpo vira 0; `const`/`min`/`max` ignorados. Sem testes disso. | `web/src/components/schema-form.tsx:56-113` | CONF |
| M8 | Assistentes: campos não controlados com `key` por índice gravam/mostram o item errado ao remover um item (etiquetas de trabalhos, tópicos de módulos). | `profissionais/wizard.tsx:189`, `cursos/wizard.tsx` | CONF |
| M9 | CSP `img-src 'self'`/`media-src` bloqueia mídia `https://` que o schema aceita: imagem quebrada em silêncio quando hospedarem fora de `/site`. Decidir: restringir schema ou abrir CSP (Fase 7/8). | `next.config.ts:9-11`, `safeUrlSchema` | CONF |
| M10 | Limite de login depende do IP, mas não há `trustProxy` e todo o tráfego passa pelo proxy do Next: o limite vira "por e-mail" (qualquer pessoa bloqueia o login do admin por 15 min); IP da auditoria incorreto. | `auth_controller.ts:17`, `config/app.ts`, `next.config.ts:34` | POT (depende do deploy) |
| M11 | Testes de API rodam numa transação global: **nenhum teste de concorrência real** (409 por corrida, publicações simultâneas, slug duplicado). | `tests/functional/*` | CONF |
| M12 | Efeitos de "revelar" (Profissional/Home) só observam o DOM da montagem: seção adicionada/reexibida no editor fica invisível no preview (`opacity:0`). | `professional/Effects.tsx`, `home/Effects.tsx` | POT |
| M13 | `CtaLink` descarta `tabIndex`: botão da barra fixa continua focável fora da tela; estado indisponível sem semântica de botão. | `course/CtaLink.tsx:15-21`, `StickyCta.tsx:37` | CONF |
| M14 | Reduced-motion incompleto no Profissional: loops CSS do hero seguem rodando; `scroll-behavior:smooth` e `behavior:'smooth'` sem override. Contraria D-014. | `professional.generated.css`, `Slider.tsx:26` | CONF |
| M15 | Desempenho: imagens do slider/retrato sem `loading`/dimensões (CLS, arquivos grandes); validação + `postMessage` + re-render completo a cada tecla no editor. | `Slider.tsx:70`, `editor.tsx:130-141` | CONF / POT |
| M16 | Comparação visual não reprova por pixel (`diffRatio` nunca falha); muitas regiões ocultas por `--hide`; números do `progress.md` não reproduzidos pelo revisor. | `visual-baseline/src/compare.ts:159` | CONF |
| M17 | Rotas públicas voltam `no-store` (SSR por visita, sem cache de borda) e `/api/public/*` sem rate limit; slug sem validação vira tag de cache. Causa não esclarecida. | `profissionais/[slug]`, `cursos/[slug]` | CONF headers / POT causa |
| M18 | Item arquivado segue editável na UI e a mensagem do 422 é enganosa; arrastar não funciona no Firefox (falta `dataTransfer.setData`). | `editor.tsx:167,255,274` | CONF / POT |

## Baixa e informativas (resumo)
- **Dados/ops:** corrida de slug devolve 500 em vez de 409 (`ER_DUP_ENTRY`); auditoria fora da transação (falha pós-commit pula a revalidação); `settings`/`variant` do documento sem schema e servidos publicamente (sem limite de tamanho/profundidade); chave do rate limit pode passar de 255 caracteres e a auditoria de bloqueios não tem teto; `restoreVersion` não confere `revision` do cadastro e `versions()` carrega JSON inteiro; oferta/preço só mudam ao republicar e `environment: sandbox` pode ser publicado (D-019); allowlist por sufixo aceita subdomínios; `debug` depende de `NODE_ENV`; resíduos (`/admin/ping`, permissões `pages.*` sem uso); snapshots imutáveis só por convenção da aplicação.
- **Contratos:** schemas de resposta admin e de documento não são usados nem validados no web (cast `as T`); `readiness` fora do schema.
- **Renderer:** `PageRenderer` aceita chaves herdadas em `TEMPLATES` (usar `Object.hasOwn`); `key` de React por texto livre (duplicatas possíveis pelo editor); detalhes de a11y (ticker repetido sem `aria-hidden`, `aria-label` em div, sem pausa no autoplay, sem legendas); `extract-css` ignora `@layer/@container` e divide seletores por vírgula sem respeitar parênteses; `!important` em excesso (D-013).
- **Editor:** erros de validação com caminho técnico do Zod, sem `aria-invalid`; `alertdialog` sem gestão de foco; `limit<=0` no histórico não limita; `addSection` não valida região; `settings` e coalescência por seção inteira; ações de restaurar com autosave pendente; duplo clique em Publicar; `live-preview` sem `window.parent !== window`; `getCurrentUser` chamado 2× por navegação.
- **Docs:** **D-019 não existe em `decisions.md`** (citada por plan/handoff/review-context); D-017 diz que o snapshot guarda "dados, não documento" (superado por D-020); e2e `admin-auth` comenta porta 3000 (é 3100).
- **Dependências (`pnpm audit --prod`, 5 avisos, todos transitivos da API):** `@faker-js/faker` ≤10.4 (alta, via lucid), `braces` ≤3.0.3 (alta, via assembler/dev), `@adonisjs/core`/`http-server` (3 moderadas: open redirect, parâmetros de rota, regex). Nenhum no web/Next.

## O que foi verificado e está correto (consolidado)
RBAC por rota (inclui documento e `commerce.manage`), CSRF em todos os verbos de escrita, mass assignment bloqueado pelos schemas, `LIKE` escapado; `forUpdate` + revisão em update/publicar/transições/oferta/documento; snapshots nunca atualizados e leitura pública só do vigente (404 sem distinguir rascunho/arquivado); preço sempre de `computeOffer` e nunca do documento/navegador; 17 URLs de checkout maliciosas recusadas; auditoria sem conteúdo nem link completo; renderer sem `dangerouslySetInnerHTML`, seções fora do registry recusadas, `rel="noopener"`; CSS 100% escopado (`.pg-*`, 0 seletores soltos); cabeçalhos: só `/live` embutível pelo próprio site; `postMessage` com origem e `source` nos dois lados; `/internal/revalidate` com `timingSafeEqual`; limpeza dos efeitos e pausa fora da viewport; migrações sobem e descem; paridade catálogo × registry testada.

## Não verificado
Fidelidade por pixel, hover/foco e Safari/Firefox; FPS/LCP; contraste medido; concorrência real e `ER_DUP_ENTRY`/profundidade JSON no MySQL; IP efetivo atrás do proxy; cache do Next em produção/multi-instância; divergências do original fora de D-004/D-013–D-016.

## Ordem de correção sugerida (aguardando autorização)
1. **Quebram páginas publicadas:** A1, A2 (cortar com `clip`, alinhar limites contrato × schema, validar o documento montado ao publicar), A3.
2. **Integridade do editor/servidor:** M1 (impor únicas/obrigatórias e revalidar ao publicar), M2 (regex de URL), A4 e M5 (autosave/retry/401), M4, M6, M7, M8.
3. **Decisões suas:** M3 (política de links externos), M9 (mídia externa), M10 (deploy atrás de proxy), D-019 a redigir.
4. Demais itens em lotes (a11y, desempenho, testes de concorrência, dependências).


---

## Status das correções (2026-10-17, autorizadas pelo usuário; decisão D-022)
Respostas do usuário: links externos **permitidos** · mídia **só `/site/`** até a Fase 7 · API **atrás de proxy** (`TRUSTED_PROXIES`).

| Item | Situação |
| --- | --- |
| A1, A2 (builders derrubavam Home/página publicada) | **Corrigido** (`clip`, teste com todos os campos no máximo) |
| A3 (menu do curso com href não-âncora) | **Corrigido** + teste |
| A4, M5 (autosave: corrida, retry, 401/403/409, resposta perdida) | **Corrigido** (hook `use-autosave`, 11 testes com relógio falso) |
| M1 (servidor não impunha único/obrigatório) e revalidação ao publicar | **Corrigido** + testes de API e de section-schemas |
| M2 (`/\host`, tab/LF) | **Corrigido** (page-schema e contracts) + testes |
| M3 (links externos) | **Decidido**: permitidos; salvamento audita os hosts externos |
| M4 (checkout de demonstração em curso real) | **Corrigido** (não renderiza no Modo A) |
| M6 (aviso de página personalizada no assistente) | **Corrigido** |
| M7 (SchemaForm opcionais/números) | **Corrigido** + testes |
| M8 (chaves por índice nos assistentes) | **Corrigido** |
| M9 (mídia externa × CSP) | **Decidido**: mídia só `/site/` (schema e dicas) |
| M10 (IP atrás do proxy) | **Corrigido**: `TRUSTED_PROXIES` + README (ativar no deploy) |
| M11 (concorrência real) | **Corrigido**: `concurrency.spec.ts` (4 testes sem transação global) |
| M12 (reveal de seções novas) | **Corrigido** (MutationObserver) |
| M13 (foco do CTA/barra fixa) | **Corrigido** (`tabIndex`, `inert`, `role=button`) |
| M14 (reduced-motion do Profissional) | **Corrigido** (CSS + rolagem) |
| M15 (desempenho) | **Parcial**: `lazy`/`decoding`, validação e preview com `useDeferredValue`, botões ↑/↓ memoizados; dimensões de imagem (CLS) **não alteradas** (muda o visual aprovado) |
| M16 (comparação visual) | **Parcial**: `--max-diff` opcional; limites reais dependem de nova rodada visual |
| M17 (cache público/slug) | **Corrigido**: ISR (`s-maxage=300`, verificado), slug validado, invalidação por tag testada nos E2E; `/api/public/*` sem rate limit segue como pendência da Fase 8 |
| M18 (arquivado editável, Firefox) | **Corrigido** (`editable`, `dataTransfer`) |
| Baixas/Info (API) | **Corrigidas**: 409 em corrida de slug, auditoria resiliente, `settings` estrito + teto de tamanho/profundidade, chave do limitador com hash, auditoria sem flood, `restoreVersion` confere o cadastro, `versions()` em SQL, sandbox bloqueado em produção, **pausar vendas imediato**, allowlist por host exato, `debug`/CORS seguros, secret de revalidação validado |
| Baixas/Info (renderer/editor/web) | **Corrigidas**: `Object.hasOwn`, chaves de lista, `aria-hidden` do ticker, dialog com foco/Esc, mensagens de validação legíveis, `limit` do histórico, `addSection` por região, `updateContent` clona/sem-op, `apiSend` sem exceção, `error.tsx`, `getCurrentUser` com cache, `live-preview` só do pai, comentário de porta do E2E |
| Documentação | **D-019 escrita**; D-022 registra as correções; README com variáveis de produção |
| Imutabilidade dos snapshots por gatilho MySQL | **Não feito**: exige `SUPER`/`log_bin_trust_function_creators` (infra); mantida por convenção, testada |
| Dependências | `@faker-js/faker` **corrigido** (override ≥10.5). **Pendentes de decisão**: `@adonisjs/core`/`http-server` (3 avisos moderados) exigem migrar AdonisJS 6 → 7; `braces` sem versão corrigida (só cadeia de build) |
| Não alterado de propósito | pausa do autoplay do slider, dimensões de imagem, `!important` em excesso, `extract-css` (`@layer`/`@container`), contraste/axe, Firefox/Safari |

**Verificação após as correções:** typecheck e lint sem erros; testes contracts 31, page-schema 16, design-system 4, section-schemas 8, editor-core 19, page-renderer 72, web 50, api 73; E2E admin-auth, curso, profissional, home, profissionais, cursos e editor passando (0 erros de console inesperados).
