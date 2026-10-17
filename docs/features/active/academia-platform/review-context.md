# review-context — Fase 2 (Migração fiel: renderer e templates originais)

> Para review independente em sessão limpa. Git e código são a fonte de verdade; aqui só o necessário para orientar. Projeto **sem repositório git** (ver pendências).

## Objetivo e aceite
Reproduzir fielmente Home, Profissional e Curso como templates do `PageRenderer` (documento JSON validado → React), com comparação visual aprovada nos breakpoints (plan.md fase 2). Decisões: `decisions.md` D-008 a D-016.

## Escopo (arquivos/módulos)
- `packages/page-renderer/src`: `PageRenderer.tsx`, `templates.tsx` (shells), `registry.ts`, `section-entry.ts`, `offer.ts` (preço só por `OfferView`), `hooks.ts`, `fx/` (canvas e partículas compartilhados); `course/`, `professional/`, `home/` (schemas Zod por seção, componentes, template com o conteúdo aprovado, CSS).
- CSS: `course/course.css` (portado e escopado por script), `professional/professional.generated.css` e `home/home.generated.css` (gerados por `visual-baseline/src/tools/extract-css.ts`) + `*.extra.css` (ajustes manuais, correções).
- `packages/visual-baseline`: `compare.ts`, `measure.ts`, `tools/extract-css.ts`.
- `apps/web`: rotas `/preview/{home,profissional,curso}`, `public/site/*` e `public/fonts/*` (Geist, JetBrains Mono, licenças OFL), `fonts.css`, `e2e/{course,professional,home}-preview.e2e.mts`, `icon.svg`.
- `packages/page-schema`: `hasSection` (registro idempotente).
- Painel: classes `.eyebrow`/`.card` renomeadas para `admin-*` (vazavam para os templates).

## Contratos
Documento `{schemaVersion, template{key,version}, sections[{id,type,schemaVersion,visibility,content}]}`; tipos `course.*`, `professional.*`, `home.*`; templates `course-original`, `professional-original`, `home-original`. Texto sem `<`/`>`; URLs `https`, `/`, `#`, `mailto`, `tel`. `RenderContext = { offer: OfferView, year }`. Sem migrações de banco nesta fase; API intacta.

## Testes executados (resultados reais em progress.md)
page-renderer 35 · page-schema 16 · contracts 5 · design-system 4 · web 5 · api 16 · lint api · E2E Chrome 14 + 11 + 15 · comparação visual dos 3 templates em 6 viewports.

## Riscos e limitações
- Checkout (Curso): etapa 2 só apresentação, nada é lido/enviado (D-009); preço de exemplo em `apps/web/src/lib/fixtures.ts` (D-011).
- Conteúdo comercial/jurídico do protótipo mantido como copy (garantia de 7 dias, FAQ, "30% de desconto" no título, depoimentos de exemplo) — precisa de revisão do negócio.
- `!important` do CSS original preservado (cascata idêntica); consolidar é opcional.
- Rotas `/preview/*` públicas (noindex) e links `/profissionais/*`, `/cursos/*` ainda 404.
- Não cobertos: hover/foco por pixel, Safari/Firefox, desempenho medido (FPS/LCP) dos efeitos, acessibilidade automatizada (axe).
- A comparação usa a fonte de reserva do baseline (sem Geist); com Geist só há revisão visual.

## Decisões a confirmar
Boost animado (D-014), gap de 20px dos cards de curso (D-014), valores das correções da Home (D-016), slug do curso 1, grafia "Lucas Kampos", rename da marca aplicado, remoção de camadas escondidas (D-015).


---

# review-context — Fase 3 (Profissionais)

## Objetivo e aceite
CRUD de profissionais, assistente em etapas, publicação com snapshot imutável e vitrine automática na Home (plan.md §7). Decisões: D-017 e D-018 (desvios do §4, cache/revalidação, rotas públicas). Resultados reais: progress.md.

## Escopo
- `packages/contracts/src/professional.ts`: schemas (dados, criação, atualização com `revision`, vitrine, consulta), `slugify`, `publishReadiness`, respostas públicas/admin.
- `apps/api`: migração `1792239700001_create_professionals_tables`; modelos `professional`, `professional_version`; `services/professional_service.ts` (regras, transações com `forUpdate`), `revalidation_service.ts`; controllers `admin_professionals_*` e `public_professionals_*`; `start/routes.ts`; `config/bodyparser.ts` (JSON sem `""`→`null`); seeder `professionals_seeder`; testes `tests/functional/professionals.spec.ts`.
- `packages/page-renderer`: `professional/build.ts`, `home/build.ts`, `NO_OFFER`, `build.test.tsx`.
- `apps/web`: `app/admin/(protected)/profissionais/*` (lista, `wizard.tsx`, `form-model.ts`), `app/admin/preview/profissionais/[id]`, `app/profissionais/[slug]`, `app/page.tsx`, `app/internal/revalidate/route.ts`, `lib/api-client.ts` (`apiSend`), `lib/api-server.ts` (`adminGet`, `publicGet`), `e2e/professionals.e2e.mts`.
- `packages/design-system`: `TextArea`.

## Pontos para o revisor
- Concorrência e estados: `update`/`publish`/`transition` travam a linha (`forUpdate`); `slug_locked` considera versões existentes (inclui despublicado).
- Segurança: RBAC por rota, CSRF nas mutações, dados sem marcação e URLs só `https://` ou `/caminho`, público só lê snapshot e expõe 3 campos na vitrine, `/internal/revalidate` por segredo (tempo constante), pré-visualização exige sessão. `GET /public/*` não tem rate limit (Fase 8).
- Cache: `force-cache` + tags + `{ expire: 0 }`; confirmar o comportamento em produção multi-instância (cache de dados do Next é por instância sem handler compartilhado).
- Compatibilidade: mudar `professional-original` altera páginas publicadas (snapshot guarda dados, não documento).

## Riscos e pendências
Ver D-017/D-018 e progress.md (agendamento, mídia, exclusão, conteúdo real dos demais profissionais, `/` público e noindex).


---

# review-context — Fase 4 (Cursos e comércio, Modo A)

## Objetivo e aceite
CRUD de cursos, vitrine automática no profissional, configuração comercial e checkout Modo A (plan.md §4, §7, §8). Decisões: D-019. Resultados reais: progress.md.

## Escopo
- `packages/contracts/src/course.ts` (+ `course.test.ts`); `professional.ts` ganhou `courseCardSchema` e `courses` na resposta pública; `tsconfig` do contracts usa lib DOM (`URL`).
- `apps/api`: migração `1792239800001_create_courses_tables`; modelos `course`, `course_version`, `commercial_config`; `services/course_service.ts`, `domain_error.ts` (extraído); controllers `admin_courses_*`, `public_courses_*`; `start/routes.ts`; `admin_professionals_controller` (invalidação em cascata); `professional_service.published` (inclui cursos); `start/env.ts` + `.env*` (`CHECKOUT_ALLOWED_HOSTS`); seeder `courses_seeder`; testes `tests/functional/courses.spec.ts`.
- `packages/page-renderer`: `course/build.ts` (+ teste), `ctx.checkout`/`CheckoutMode` (`offer.ts`), `course/CtaLink.tsx`, `course/state.tsx`, `templates.tsx` (Shell recebe `ctx`), `course/sections.tsx` (desconto/itens opcionais), `course/schemas.ts` (campos opcionais), `professional/build.ts` (`courseCards`).
- `apps/web`: `app/cursos/[slug]`, `app/admin/(protected)/cursos/*` (lista, novo, [id], `wizard.tsx`, `form-model.ts`), `app/admin/preview/cursos/[id]`, `app/profissionais/[slug]` (cartões), layout (menu), `e2e/courses.e2e.mts`.

## Pontos para o revisor
- Segurança: RBAC por rota (`commerce.manage` na oferta), CSRF, URL de checkout (`validateCheckoutUrl`: lista de domínios, sem credenciais/porta/IP) validada na escrita, na publicação e na leitura pública; renderer só navega para https; log de auditoria sem o link; preço nunca vem do documento/navegador; público só lê snapshot e só com profissional publicado.
- Consistência: snapshot de conteúdo + oferta; `hasUnpublishedChanges` considera `revision` e `published_commercial_revision`; locks `forUpdate` em update/oferta/publicar/transições; cascata de cache com o profissional.
- Cache multi-instância e seed por CLI não invalidam tags (ver D-018/progress).
- Arredondamento de parcelas (para baixo) é decisão de produto a confirmar.
- Renderer: schemas do curso aprovado ficaram opcionais (toneScale, citação) e `paragraphs` do instrutor sobe para 1200/6; conferir que o template aprovado (`/preview/curso`, E2E 14) segue idêntico.

## Riscos e pendências
Ver D-019 e progress.md (Home de cursos estática, conteúdo de negócio do curso 1, provedor real/Modo B na Fase 6, mídia, `CHECKOUT_ALLOWED_HOSTS` de produção).


---

# review-context — Fase 5 (Editor visual)

## Objetivo e aceite
Editor visual para páginas de profissional e curso: árvore de seções, propriedades, arrastar, desfazer/refazer, histórico (plan.md §5, §11). Decisões: D-020, D-021. Resultados reais: progress.md.

## Escopo
- `packages/editor-core` (comandos puros, regras, histórico; `editor-core.test.ts`).
- `packages/section-schemas` (schemas das seções movidos do renderer, `SECTION_META`, `validatePageDocument`, `editorRules`) e `packages/page-schema` (agora compilado). `packages/page-renderer`: `resolve.ts` (`resolve*Document`), schemas reexportados, `schemas-version.ts`; testes `resolve.test.tsx`.
- `packages/contracts`: `document.ts`; `documentRevision` nas respostas admin; `document` nas respostas públicas.
- `apps/api`: migração `1792239900001_add_page_documents`; modelos (colunas de documento); `services/document_service.ts`, `base_documents_controller.ts` + 2 controllers; publicação grava o documento no snapshot; `start/routes.ts`; `tests/functional/documents.spec.ts`.
- `apps/web`: `app/admin/(protected)/editor/*` (`editor.tsx`, páginas), `components/schema-form.tsx`, `components/live-preview.tsx`, `app/admin/preview/*/[id]/live`, páginas públicas/preview usando `resolve*`, `next.config.ts` (CSP do quadro), `globals.css`, `e2e/editor.e2e.mts`.

## Pontos para o revisor
- **Segurança**: validação autoritativa no servidor (registry + template + prefixo de seção), texto sem `<>` e URLs seguras também no documento; renderer revalida na renderização; RBAC por rota (leitura/escrita), CSRF, auditoria sem conteúdo; `postMessage` com checagem de origem e `source`; CSP/`X-Frame-Options` relaxados só em `/live`. Verificar o limite do corpo da requisição (padrão do bodyparser) frente a documentos grandes.
- **Consistência**: concorrência por `document_revision` com `forUpdate`; restauração de versão altera cadastro e documento ao mesmo tempo; `hasUnpublishedChanges`; partes dinâmicas reinjetadas (`professional.courses`); preço nunca no documento.
- **Compatibilidade**: `document` nulo preserva o comportamento anterior; `page-schema` e `section-schemas` exigem `pnpm install`/`prepare` (build `dist`) antes de rodar API/testes.
- **UX/a11y**: formulário gerado do schema (rótulos em pt-BR por dicionário, fallback automático), botões de mover como alternativa ao arrastar; avaliar ordem de foco e anúncios (`role=status`), e a ausência de axe.
- Trade-off aceito: depois de personalizada, edições do assistente de cadastro não alteram as seções do documento (aviso/“Restaurar do cadastro”). Confirmar se o aviso na UI do assistente é suficiente (hoje só há o link para o editor).

## Riscos e pendências
Mídia por upload (Fase 7), Home com documento próprio (Fase 7), agendamento, edição de estilo/responsivo por seção, desfazer persistente, teste de carga e acessibilidade automatizada.


---

# review-context — Revisão e correções (Fases 0–5)
Relatório: `review/review-fases-0-5.md` (achados, status de cada um e o que ficou de fora). Decisões: D-019 (escrita na revisão) e D-022. Para uma nova revisão independente: conferir (a) validação do documento no servidor (`section-schemas/src/index.ts`) e revalidação no publicar, (b) `use-autosave.ts` e seus testes, (c) builders com `clip` e `limits.test.ts`, (d) `concurrency.spec.ts` (usa `truncate`: não rodar duas suítes ao mesmo tempo), (e) política de mídia (`/site/`) e de links externos (auditoria dos hosts), (f) `TRUSTED_PROXIES` em produção.


---

# review-context — Fase 7 (Mídia, Home como documento, modelos de página)

## Objetivo e aceite
Biblioteca de mídia com upload, Home gerenciável no editor com vitrine de cursos dinâmica e modelos adicionais de página do Profissional (plan.md §11, item 7; D-023 a D-027). Resultados reais: progress.md. Fora do escopo: agendamento de publicação, provedor real de storage/CDN (Fase 8), modelos de Curso/Home.

## Escopo (arquivos/módulos)
- **7A mídia** — API: migração `..._create_media_tables`; `services/media_service.ts`, `services/media/storage.ts` (interface + local); `controllers/admin_media_controller.ts` e `public_media_controller.ts`; `start/media.ts` (preload com `MEDIA_CDN_HOST`); `force_json_response_middleware` (preserva `x-original-accept`); `config/bodyparser.ts` (`processManually: ['/admin/media']`). Pacotes: `page-schema` (`isSafeMediaPath`, `allowedMediaHosts`), `contracts/media.ts`, `page-renderer/media.ts` (`mediaSrc`). Web: `components/media-library.tsx`, `media-input.tsx`, `schema-form.tsx` (campos `src`), `/admin/midia`, `next.config.ts` (rewrite `/media/:id`, CSP, `proxyClientMaxBodySize`).
- **7B Home** — API: migração `..._create_home_tables`; `services/home_service.ts`; `controllers/admin_home_controller.ts`, `public_home_controller.ts`; `document_service.ts` (`HOME_KIND`, `HOME_ID`); `course_service.ts` (`homeCards`). Pacotes: `contracts/home.ts`; `page-renderer` (`resolveHomeDocument`, `homeCourseItems`). Web: `lib/home-data.ts`, `app/page.tsx`, `editor/home`, `admin/preview/home/live`, `editor.tsx` (kind `home`), `live-preview.tsx`.
- **7C modelos** — `section-schemas` (`PROFESSIONAL_TEMPLATES`, `statsSchema`, `ctaSchema`, `TEMPLATE_PREFIX`); `contracts` (`PROFESSIONAL_TEMPLATE_KEYS`, `templateKey` em criar/atualizar/admin); API: migração `..._add_professional_template_key`, `professional_service.ts`, `document_service.ts` (`templateOf`); renderer: `professional/build.ts` (composição, números, chamada), `professional/sections.tsx` (Stats, Cta), `professional.templates.css`, `templates.tsx` (shell com `data-tpl`), `resolve.ts`; web: seletor no `wizard.tsx`, `/preview/modelos/[key]`.
- **Testes**: `media.spec`, `home.spec`, `templates.spec`; `tests/helpers.ts` (`truncateAll`); renderer `templates.test.tsx`, `resolve.test.tsx`, `media.test.ts`; web `media-input.test.tsx`; E2E `media`, `home-editor`, `templates`.

## Migrações (3, todas reversíveis)
`create_media_tables` (`media_assets`, `media_variants`), `create_home_tables` (`home_pages` com a linha 1, `home_versions`), `add_professional_template_key` (padrão `professional-original`). Variáveis novas: `MEDIA_STORAGE_PATH`, `MEDIA_CDN_HOST` (API e site).

## Contratos alterados
`POST/PUT /admin/professionals` aceitam `templateKey`; `AdminProfessional.templateKey`; novos `/admin/media*`, `/media/:id`, `/admin/home*`, `/public/home`; `isSafeMediaPath` agora aceita só `/site/…`, `/media/<id>` e https de `MEDIA_CDN_HOST` (antes: qualquer caminho interno — pode recusar dados antigos fora de `/site`; o seed e os testes conferem).

## Pontos para o revisor
- **Upload (segurança)**: tipo por assinatura (`file-type`), imagem decodificada por completo com limite de lado/pixels, SVG recusado, nome higienizado, chaves de storage validadas contra a raiz, original nunca servido, `nosniff`, cache imutável; corpo lido manualmente (limite 60 MB + 1 MB) e `proxyClientMaxBodySize: 70mb` no Next. Sem rate limit específico de envio nem varredura antivírus.
- **CSP/host de mídia**: o host de `MEDIA_CDN_HOST` precisa ser o mesmo na API e no build do site (`NEXT_PUBLIC_MEDIA_CDN_HOST` é inlinado no build).
- **Uso de mídia calculado sob demanda** (varre rascunhos + snapshots vigentes de profissionais, cursos e Home): custo cresce com o volume; versões antigas não protegem contra exclusão (D-024).
- **Home**: `ensureHomeRow` (insert ignore) em todo acesso; snapshot publicado inválido cai no template; seções automáticas reinjetadas; confirme se "sem cursos → seção some" é a decisão de produto desejada.
- **Modelos**: `template_locked` e validação do documento contra o modelo do profissional (`templateOf`); restauração de versão troca o modelo; o CSS dos modelos usa `!important` onde o CSS extraído do original já usava (D-013).
- **Testes**: a causa da intermitência (D-027) e a correção (`truncateAll`); conferir que nenhuma outra suíte depende de `testUtils.db().truncate()`.

## Riscos e pendências
Provedor real de storage/CDN e poster/transcodificação de vídeo (Fase 8); rate limit e antivírus no upload; modelos de Curso/Home; revisão visual humana dos 6 modelos; `/preview/*` públicas; agendamento; Fase 6 (The Members) continua não autorizada; pendências de negócio e ativos do handoff.
