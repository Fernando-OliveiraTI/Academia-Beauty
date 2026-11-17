# Handoff — Editor único

**Feature:** editor visual como único lugar de edição de profissionais e cursos (plano: `plan.md`; decisão: D-039 em `../academia-platform/decisions.md`).
**Branch:** `feat/fase-8-seo-observabilidade` (o trabalho foi feito nela, sem commit; separar em branch própria antes do PR se o usuário quiser).
**Fase atual:** F1–F3 concluídas; F4 parcial (cadastro removido; E2E pendentes); F5 não iniciada.

## Entregue
- `packages/contracts/src/document-sync.ts`: `professionalFieldsFromDocument`, `courseFieldsFromDocument`, `syncDataFromDocument`, `locateField` (+ dicas por campo), `canonicalJson`, `PLACEHOLDER_MEDIA`/`PLACEHOLDER_BIO` (o renderer reusa).
- API: sincroniza na gravação do documento (`DocumentService.save`, devolve `revision` do cadastro), na publicação (profissional e curso) e na atualização do cadastro (página prevalece). Curso: todas as pendências numa resposta `not_ready`.
- Web: painel Configurações (`editor/page-settings.tsx`), pendências (`editor/publish-issues.tsx`), oferta que cria a oferta (`editor/checkout-settings.tsx`), nota "Para publicar" fixa na seção, aviso de seção oculta, troca de modelo nas Configurações, `data-field-path` nos grupos do `SchemaForm`, máscaras em `lib/money-input.ts`.
- Removidos: `profissionais/wizard.tsx`, `cursos/wizard.tsx`, os dois `form-model` (+ testes), `components/wizard-ui.tsx`, "Restaurar do cadastro" (só a Home mantém "Restaurar padrão"). `/admin/{profissionais,cursos}/:id` redireciona ao editor; listas abrem o editor.

- Publicação com retorno visual (`editor/publish-overlay.tsx`): "Salvando alterações…"/"Publicando…" com anel (mín. 0,9 s) e, no sucesso, ✓ animado + "Ver página no site"/"Continuar editando" (Esc ou clique fora fecham). Situação da página vira estado da tela (Despublicar e Ver página atualizam sem recarregar). Conferido com a publicação **simulada** no navegador (nenhuma escrita na API).

- Campo ↔ página: focar um campo do formulário (por pendência ou clique) manda `EDITOR_FIELD` ao quadro, que rola até o elemento e mostra a moldura com o nome do campo (`fieldAnchor` em `lib/section-dom.ts`; campo vazio marca o bloco dos vizinhos). Campos pendentes ficam marcados "Pendente" no formulário até serem preenchidos.

- Next.js 16.4.2 → 16.4.6 (e `eslint-config-next`): corrige GHSA-mfr8-8qww-v76h (moderada). A auditoria ainda aponta 4 moderadas na API (AdonisJS http-server/core e minimatch), não tratadas aqui.
- Escolher uma seção (lista ou clique na página) fecha os painéis Configurações/Pendências, que escondiam o formulário da seção (achado pelo E2E).

## Testes executados (2026-11-16)
- contracts 50 ✔ · page-renderer 157 ✔ (inclui ida e volta nos 6 modelos) · web vitest 130 ✔ · API 226 ✔ · typecheck web/api/renderer ✔ · lint web/api sem erros (48 avisos já existentes no web).
- Tela conferida no Chrome (banco **local** de dev, 1440 e 390 px, sem estouro horizontal): pendência do profissional → foco no campo dos anos → resolvido ao preencher (valor revertido depois); curso com 6 pendências (profissional, público, benefícios/entregáveis em seção oculta, oferta); Configurações do profissional e do curso; diálogo de troca de modelo (cancelado); redirecionamento da rota antiga.

## Pendências
1. ~~E2E~~ **reescritos e verdes (2026-11-16)**: os 12 roteiros passam contra o banco local (build de produção do web, API com `PUBLIC_SHOW_DRAFTS=false` e `THEMEMBERS_WEBHOOK_SECRET` temporário). `professionals` e `courses` reescritos para o editor (Configurações, pendências → campo, página → cadastro, confirmação de publicação, arquivar/restaurar pela lista); `media` escolhe o retrato na seção Topo; `templates` troca o modelo em Configurações; `editor` verifica página → cadastro. Limpeza de todos passou a **apagar** o que cria (contagem de `e2e-*` no banco não sobe).
2. CSS `wz-*`/`wizard-*` do assistente ficou sem uso em `globals.css` (algumas classes, como `wizard-hint`, continuam em uso; remover só o que não tiver consumidor).
3. Revisão independente (F5) e `review-context.md`.

## Riscos conhecidos
- "Mostrar e preencher" numa seção de curso oculta revela o conteúdo de exemplo do template; o usuário vê na pré-visualização e edita, mas pode publicar o exemplo se não revisar.
- Rótulos genéricos do `SchemaForm` ("Destaque", "Subtítulo"): mitigado pelas dicas de `locateField`, não renomeado.

## Atenção operacional
- `apps/api/.env` aponta para o MySQL de **produção** (Azure). Para dev local, a API foi iniciada com `DB_HOST=127.0.0.1 DB_PORT=3317 DB_USER=academia DB_PASSWORD=academia_dev_only DB_DATABASE=academia` no ambiente do processo (sobrepõe o `.env`).
