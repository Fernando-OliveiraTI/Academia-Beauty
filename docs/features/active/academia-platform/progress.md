# Progresso — Academia Beauty Platform

## Fase 0 — Baseline visual: **concluída** (2026-10-17)
- `references/` com cópia somente leitura das 3 páginas + `MANIFEST.sha256` (cópias conferidas byte a byte com os originais).
- `packages/visual-baseline`: 18 capturas (3 páginas × 6 viewports: 1440, 1024, 900, 768, 620, 390) + métricas JSON, rede externa bloqueada, `Math.random` com semente fixa.
- Reprodutibilidade verificada em duas execuções: métricas de layout idênticas; curso idêntico em pixels; home/profissional diferem só pela camada de canvas/animação (D-007).
- Hosts externos bloqueados e erros de página de cada referência estão em `baseline/*/*.json`.

## Fase 1 — Fundação: **concluída, aguardando revisão** (2026-10-17)
Entregue:
- Monorepo pnpm (`apps/web`, `apps/api`, `packages/*`, `infra/containers`), CI em `.github/workflows/ci.yml`.
- `design-system`: tokens copiados literalmente do `:root` do curso; `Button` e `Field` acessíveis.
- `contracts`: papéis, permissões e DTOs; `page-schema`: envelope versionado, registry, migração de schema, rejeição de HTML/URL insegura.
- API: login/logout/me, sessão em banco, CSRF, rate limit, RBAC (`can`), auditoria, health, headers de segurança, migrations (users, roles, user_roles, audit_logs, sessions, rate_limits), seeder idempotente.
- Web: `/admin/login` (React Hook Form + Zod), área `/admin` protegida no servidor, logout, proxy `/api`, CSP e headers.

Verificação executada (resultados reais):
| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` (6 pacotes) | sem erros |
| contracts | 5 testes passam |
| page-schema | 16 testes passam |
| design-system | 4 testes passam |
| web (unitário) | 5 testes passam |
| api (funcional, MySQL real) | 16 testes passam, 4 execuções seguidas sem falha intermitente |
| api lint | sem erros |
| web build de produção | compila |
| E2E no Chrome (API + web em produção) | 8 passos passam, incluindo revogação da sessão no servidor e CSP sem violações |
| Migrations | `up` e `down` exercitados a cada execução dos testes da API |

Defeitos encontrados e corrigidos durante os testes: CSRF respondia 302 em vez de 403 JSON; usuário inexistente respondia 400 (enumeração de contas) em vez de 401 idêntico ao de senha errada; testes intermitentes por `truncate` (trocado por transação global).

## Não verificado / limitações
- `.github/workflows/ci.yml` **não foi executado** (projeto sem git/GitHub).
- Sem lint configurado no `apps/web` e nos pacotes; só a API tem ESLint.
- Sem MFA/SSO; papéis são `admin`, `editor`, `viewer` (provisórios).
- Rate limit com store em banco; em produção multi-instância avaliar Redis.
- `ADMIN_PASSWORD` do `.env` de desenvolvimento é só local.
- Mudanças de dependências do monorepo antigo não foram reaproveitadas (decisão D-001).

## Fase 2 — Migração fiel: **em andamento**

### 2A Curso: **concluída, aguardando revisão** (2026-10-17)
Entregue: `packages/page-renderer` (schemas Zod por seção, registry, `PageRenderer` com landmarks, template `course-original` v1, componentes React, efeitos de página, checkout visual D-009), rota `/preview/curso`, Geist self-host, `compare.ts` no visual-baseline, `e2e:course` no web.

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` (7 pacotes) | sem erros |
| page-renderer (unit + render + interação) | 19 testes passam |
| page-schema / contracts / design-system / web | 16 / 5 / 4 / 5 passam |
| api (MySQL real) + lint | 16 passam, lint sem erros |
| Comparação visual Curso × baseline, 6 viewports | layout (seções, scrollHeight, largura) **idêntico dentro de 2 px**; diferença de pixels 0,001% a 0,027%, concentrada no hero animado e no selo rotativo da garantia (animações contínuas) |
| E2E Chrome `/preview/curso` | 14 verificações passam: preços da oferta, fonte, header/progresso, scroll-spy, accordion, contador, CTA+foco, validação/máscara/avanço do checkout, método PIX, nenhuma requisição não-GET, sticky mobile, resumo recolhível, reduced-motion, 0 erros/avisos de console |

Defeito achado e corrigido pelo teste visual: vazamento do `.eyebrow` do painel (D-010).
Limitações: baseline sem Geist (D-012); a comparação não cobre estados hover/foco; checkout etapa 2 sem processamento (D-009); conteúdo comercial/jurídico do protótipo mantido como copy (D-011) e depoimentos continuam de exemplo; `ci.yml` não executado.

### 2B Profissional: **concluída, aguardando revisão** (2026-10-17)
Entregue: template `professional-original` (nav, hero com 3 canvas + 72 partículas + faixas CSS, bio com ticker, trabalhos, vídeo, cursos), rodapé da plataforma compartilhado (`site.footer`), `HeroTelemetry`/`telemetry.ts` (portados do original), rota `/preview/profissional`, JetBrains Mono (OFL) hospedada, ferramenta `extract-css` (D-013), `compare --hide/--mask` (efeitos ocultos nos dois lados, referência capturada ao vivo).

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` (7 pacotes) | sem erros |
| page-renderer | 27 testes passam (19 do Curso + 8 do Profissional, incl. XSS/URL/estado vazio) |
| Extração de CSS | 185 regras → 181 mantidas, 7 declarações mortas removidas, 12/14 keyframes |
| `compare profissional --hide ".cb-telemetry-layer,.cb-video-style-fx,.bio-bg"` (referência ao vivo) | layout (seções, scrollHeight, larguras) **idêntico dentro de 2 px nos 6 viewports**; diferença de pixels 0,9–1,8%, **toda** em: nome da marca (nav/eyebrow: rename aprovado), capa do curso (SVG local × imagem Shopify bloqueada) e o quadro do vídeo; hero, retrato, bio, trabalhos e rodapé sem diferença |
| E2E Chrome `/preview/profissional` | 11 verificações: ordem dos 3 canvas e conteúdo desenhado, 72 partículas, boost animando, reveal em cascata, pausa fora da viewport, vídeo sem autoplay, link do curso, **0 erros de console** (o original lançava `ReferenceError`), mobile sem overflow/HUD oculto, reduced-motion |
| E2E do Curso após o refactor | 14 verificações; comparação visual do Curso inalterada (≤0,026%) |

Limitações: efeitos aleatórios/animados (canvas, partículas, ticker) só são validados por contagem/estado e visual, não por pixel (D-007); a comparação não cobre hover/foco; vídeo e imagens não foram otimizados; sem menu mobile (como no original).

### 2C Home: **concluída, aguardando revisão** (2026-10-17)
Entregue: template `home-original` (nav, hero com 4 camadas de efeito + 3 canvas, profissionais com slider, cursos, benefícios, marcas, CTA, rodapé com energia), rota `/preview/home`, 12 imagens renomeadas (sem prefixo de hash) em `public/site/home`, correções D-016 com antes/depois, `fx/` e `hooks.ts` compartilhados entre Home e Profissional.

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` (7 pacotes) | sem erros |
| page-renderer | 35 testes passam (8 novos da Home: estrutura, ordem das camadas, marca, reveal inicial, lista dinâmica/vazia/>5, segurança) |
| Extração de CSS | 1.402 regras → 724 mantidas; 511 declarações mortas removidas; 38/54 keyframes |
| `compare home --baseline-mode` (correções desligadas, efeitos ocultos, rodapé mascarado) | layout **idêntico dentro de 2 px nos 6 viewports**; pixels 0,045% a 0,115%, só o texto "Carreira"→"Academia" |
| `compare home` (com correções) | 1440 idêntico (0,045%); 1024/900/768/620/390 mudam só onde D-016 corrige (hero, marcas, card órfão) |
| E2E Chrome `/preview/home` | 15 verificações: ordem e contagem das camadas (52+44+10+16+72 partículas), 3 canvas animando, parallax (vai e volta a 0), slider (setas, autoplay avança, pausa com ponteiro), reveal, pausa fora da tela, rodapé, **0 erros de console**, 900/768/390 sem overflow e com as correções, reduced-motion |

Defeito achado pelo E2E e corrigido: o foco deixado por um clique numa seta pausava o autoplay para sempre; agora só o foco de teclado pausa.
Limitações: o rodapé (brilho animado no `::before`) é verificado por geometria e visual, não por pixel; efeitos aleatórios só por contagem/estado (D-007); links para `/profissionais/*` e `/cursos/*` ainda levam a 404; sem hover verificado por pixel.

## Fase 2 — fechamento (2D): **pendente de revisão do usuário**
Rotas `/preview/*` são públicas e `noindex`, com dados de exemplo: **remover ou proteger antes de produção** (Fase 8). `video.mp4` (28,6 MB) e PNGs grandes seguem sem otimização.


## Fase 3 — Profissionais: **concluída, aguardando revisão** (2026-10-17)
Entregue: contratos (`professional.ts`: schemas, slug, `publishReadiness`), API (migração `professionals` + `professional_versions`, modelos, `ProfessionalService`, `RevalidationService`, rotas `/admin/professionals/*` e `/public/professionals*`, auditoria), builders puros `buildProfessionalDocument`/`buildHomeDocument`, painel (`/admin/profissionais`: lista com busca/filtro/paginação, assistente em 5 etapas, publicação, vitrine, pré-visualização do rascunho), páginas públicas `/profissionais/[slug]` e `/` (Home com vitrine real), `/internal/revalidate`, seed de desenvolvimento, `TextArea` no design-system, E2E `e2e:professionals`.

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` | sem erros |
| contracts | 9 testes (4 novos: slug, marcação/URLs perigosas, completude) |
| page-renderer | 42 testes (7 novos: builders, determinismo, seções omitidas, XSS, vitrine vazia/>24) |
| web | 10 testes (5 novos: modelo do formulário) · design-system 4 |
| api (MySQL real) + lint | 29 testes (13 novos) · lint sem erros |
| E2E Chrome `e2e:professionals` | 14 verificações: cadastro em etapas, validação no cliente, rascunho incompleto bloqueado, pré-visualização, publicar → página e Home atualizam na hora, edição não vaza até republicar, 409 em edição concorrente, despublicar/arquivar/restaurar, 390px sem overflow, 0 erros de console |
| E2E anteriores (curso 14, profissional 11, home 15, admin-auth) | continuam passando |

Cobertura da API: RBAC (sem sessão 401, viewer lê mas não escreve/publica 403), CSRF 403, 422 (slug reservado, marcação, `javascript:`), slug duplicado 409, `revision_conflict` 409, `slug_locked`, publicar incompleto 422 com pendências, snapshot imutável (2 versões após republicar), rascunho/despublicado/arquivado = 404 no público, vitrine (ordem, `home_visible`, não publicado fora, só 3 campos expostos), busca com `%` literal, booleanos reais, e a revalidação (segredo + tags; servidor fora do ar não lança).

Defeitos achados pelos testes e corrigidos: (1) o Adonis convertia `""` em `null` no JSON e a API rejeitava o payload real do assistente (só o E2E pegou; agora há teste de API com o payload mínimo); (2) `featured`/`home_visible` saíam como 0/1 do MySQL; (3) `whereLike` do Lucid gera collation inválida no MySQL (trocado por `LIKE ... ESCAPE`); (4) `revalidateTag(..., 'max')` servia conteúdo antigo (trocado por `{ expire: 0 }`) e o fetch precisava de `force-cache`; (5) cabeçalho do painel estourava a largura em 390px.

Limitações: sem agendamento de publicação nem exclusão definitiva; mídia só por URL; as 4 demais pessoas da Home existem como rascunho sem dados reais; sem teste de carga/cache hit-miss; `/internal/revalidate` sem rate limit (protegido por segredo); sem axe/Lighthouse; E2E deixa registros arquivados `e2e-*` no banco de desenvolvimento; `ci.yml` não executado.


## Fase 4 — Cursos e comércio (Modo A): **concluída, aguardando revisão** (2026-10-17)
Entregue: contratos (`course.ts`: dados, oferta, `computeOffer`, `validateCheckoutUrl`, completude), API (migração `courses` + `commercial_configs` + `course_versions`, modelos, `CourseService`, rotas `/admin/courses/*` e `/public/courses/:slug`, `commerce.manage` na oferta, auditoria, cascata de cache com o profissional, `courses` em `/public/professionals/:slug`, `CHECKOUT_ALLOWED_HOSTS`, seed), renderer (`buildCourseDocument`, `professionalCourseCards`, `ctx.checkout` redirect, CTA desativável, oferta sem desconto, seções opcionais), web (`/cursos/[slug]`, `/admin/cursos` lista/assistente em 5 etapas/pré-visualização, menu, `e2e:courses`).

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` e `pnpm lint` (workspace) | sem erros |
| contracts | 30 testes (21 novos: oferta/parcelas, 12 URLs de checkout recusadas, completude) |
| page-renderer | 53 testes (11 novos: sem vazamento do curso aprovado, Modo A, com/sem desconto, indisponível, URL não-https, seções opcionais, vitrine) |
| web | 27 testes (17 novos: preço BRL ↔ centavos, etapas) |
| api (MySQL real) | 47 testes (18 novos: RBAC, CSRF, editor sem oferta, URL/domínio, concorrência, auditoria sem link, snapshot imutável, preço só do backend, 404 de rascunho/despublicado/arquivado, cascata do profissional, vitrine/ordem, listagem) |
| E2E Chrome `e2e:courses` (API + web em produção) | 15 verificações: curso do seed no Modo A, vitrine no profissional, assistente, recusa de link fora da lista/http/`javascript:`, prévia de cálculo, publicar → página e vitrine na hora, alterar preço só vale após republicar, oferta inativa bloqueia, despublicar/arquivar/restaurar, 390px sem overflow, 0 erros de console além dos 2 422 provocados |
| E2E anteriores (curso 14, profissional 11, home 15, profissionais 14, admin-auth) | continuam passando |
| Conferência visual `/cursos/morena-iluminada` (1440, seções hero/entrega/oferta) | mantém o design aprovado; sem formulário de checkout |

Defeito achado e tratado: o seed por CLI não invalida o cache do Next (só o ISR de 300 s corrige); em uso normal a publicação invalida por tag.
Limitações: nenhum pagamento real existe (link do seed é fictício; The Members segue sem documentação, Modo B é Fase 6); sem teste de carga/cache hit-miss; sem axe/Lighthouse; comparação por pixel não se aplica (conteúdo dinâmico: verificado por testes de estrutura + conferência visual); `e2e:courses` deixa cursos `e2e-curso-*` (restaurados como rascunho) no banco de desenvolvimento; a captura em página inteira não dispara os reveals (usar viewport); Home de cursos ainda estática.


## Fase 5 — Editor visual (autorizada em 2026-10-17) · subfase 5A **concluída**
Plano e subfases em `plan.md` §11; decisão de arquitetura **D-020 (a aprovar antes da 5B)**.
**5A — `packages/editor-core`** (puro, depende só de `page-schema`): comandos `addSection`, `removeSection`, `moveSection`, `duplicateSection`, `updateContent`, `setVisibility`, `setVariant`, `newSectionId`; regras injetáveis (`singleton`, `required`, `placementOf`, `maxSections`); histórico `commit/undo/redo` com coalescência por chave+janela e limite de passos.

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` (workspace, incluindo editor-core) | sem erros |
| editor-core | 12 testes: imutabilidade, adicionar/remover/mover/duplicar, tipo único/obrigatório, mover só dentro da região (inclui nav sozinho), ids únicos, documento resultante válido no `parsePageDocument`, undo/redo, descarte do futuro, coalescência, limite |

Limitações: as regras reais (quais tipos são únicos/obrigatórios, região de cada um) ainda não foram ligadas ao registry do renderer (entra na 5C); nada de API/UI ainda.


## Fase 5 — Editor visual: **concluída, aguardando revisão** (2026-10-17)
Subfases 5A (motor), 5B (API), 5C (UI profissionais), 5D (cursos), 5E (validação). Decisões: D-020 (aprovada) e D-021.
Entregue: `packages/editor-core`; `packages/section-schemas` (+ `page-schema` compilado); migração `add_page_documents`; `DocumentService` e rotas de documento/versões (profissionais e cursos); `resolveProfessionalDocument`/`resolveCourseDocument`; páginas públicas e pré-visualizações usando o documento; editor `/admin/editor/{profissionais,cursos}/[id]` (árvore, formulário gerado do schema Zod, arrastar + botões, ocultar/mostrar, adicionar seção removida, desfazer/refazer, autosave, conflito, histórico/restauração, restaurar do cadastro, publicar) com pré-visualização ao vivo em iframe (desktop/tablet/celular); `e2e:editor`.

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` e `pnpm lint` (workspace) | sem erros |
| editor-core | 12 testes |
| section-schemas | 5 testes (catálogo, regras, validação autoritativa) |
| page-renderer | 58 testes (5 novos: paridade catálogo × registry, 3 templates válidos, template/seção de outro tipo recusados, `resolve*` preserva edição e reinjeta cursos) |
| api (MySQL real) | 59 testes (12 novos: RBAC, CSRF, 404, revisão 0, salvar, 409, 422 (conteúdo, tipo, template, `<script>`, `javascript:`, id duplicado, texto), arquivado, restaurar do cadastro, snapshot com documento, público só vê o publicado, histórico/restauração, auditoria sem conteúdo, cursos) |
| web | 34 testes (7 novos: todas as 30 seções convertem e renderizam no formulário, edição/lista/limites) |
| E2E Chrome `e2e:editor` (API + web em produção) | 20 verificações: editar com pré-visualização ao vivo e autosave, regras (hero, nav, cursos), reordenar por botão e arrastar, ocultar/desfazer/refazer, `javascript:` recusado, persistência após recarregar, publicar → site público, histórico, conflito entre duas abas, restaurar do cadastro, 390px sem overflow, CSRF, CSP do quadro, curso (oferta obrigatória, edição, preço e checkout vindos do backend), recusa de seção de outro template; 0 erros de console inesperados |
| E2E anteriores (admin-auth, curso 14, profissional 11, home 15, profissionais 14, cursos 15) | continuam passando |

Defeitos achados pelos testes e corrigidos: (1) `frame-ancestors 'none'` global bloqueava o iframe (agora só `/live` é embutível pelo próprio site); (2) indicador preso em "não salvo" depois de desfazer até o estado salvo; (3) histórico não atualizava após publicar; (4) campos de lista de texto sem rótulo individual.
Limitações: sem upload de mídia (campos de imagem/vídeo são URLs, Fase 7); Home ainda sem documento próprio (Fase 7); desfazer não sobrevive a recarga; sem edição de variantes/estilo/responsivo por seção; a pré-visualização dos cartões de cursos usa o cache público (até 300 s); teste de leitura-somente (viewer) coberto na API (403), não no navegador; sem axe/Lighthouse; o seed `lukas-campos` não foi personalizado; a migração foi aplicada ao banco de desenvolvimento.


## Revisão independente e correções (Fases 0–5) — **concluída** (2026-10-17)
Relatório e status item a item: `review/review-fases-0-5.md`. Decisões: D-019 (redigida), D-022.
| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` e `pnpm lint` (workspace) | sem erros |
| contracts 31 · page-schema 16 · design-system 4 · section-schemas 8 · editor-core 19 | passando |
| page-renderer 72 (limites máximos dos builders, robustez, resolve) · web 50 (autosave, SchemaForm, stable) | passando |
| api 73 (inclui 4 de concorrência real, regras do servidor, pausar vendas, limitador de login) | passando (3 rodadas seguidas; rodar uma suíte por vez: `truncate` da concorrência) |
| E2E Chrome: admin-auth 8 · curso 14 · profissional 11 · home 15 · profissionais 14 · cursos 15 · editor 20 | passando; publicar → página atualizada na hora com ISR (`s-maxage=300`) |
| `pnpm audit --prod` | 4 avisos (1 alto `braces`, 3 moderados AdonisJS): dependem de decisão |
Limitações: ver "Não feito" em D-022 e no relatório (gatilhos MySQL, AdonisJS 7, CLS, pausa do autoplay, axe, Firefox/Safari).


## Fase 7 — CMS da Home e mídia (autorizada em 2026-10-17; escopo em D-023) · subfase 7A **concluída**
**7A — Biblioteca de mídia** (D-024). Entregue: migração `media_assets`/`media_variants`; `MediaStorage` local; `MediaService` (tipo real, decodificação, derivados WebP/AVIF, uso sob demanda); `POST/GET/DELETE /admin/media`, `GET /media/:id` (Accept, `?w=`, cache imutável, Range); `isSafeMediaPath` único (`/site`, `/media/<id>`, https de `MEDIA_CDN_HOST`); CSP/rewrite/limite de corpo no Next; `mediaSrc` no renderer; `/admin/midia`, `MediaInput`/`MediaPicker` no `SchemaForm` e nos assistentes.

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` e `pnpm lint` (workspace) | sem erros |
| page-schema | 34 testes (caminhos de mídia: aceitos, recusados, hosts de CDN) |
| contracts 31 · page-renderer 74 (`mediaSrc`) · web 56 (picker, envio, recusa, 403, `SchemaForm`) | passando |
| api (MySQL real) | 85 testes (12 novos de mídia: RBAC, CSRF, tipo falso/SVG/corrompido/vazio/grande, derivados, nome higienizado, Accept/`?w=`/304, Range, QuickTime, uso bloqueia exclusão, caminhos aceitos/recusados nos cadastros, storage contra `..`) |
| E2E Chrome `e2e:media` (API + web em produção) | 11 verificações: envio pelo navegador, WebP/AVIF/`?w=`/cache pelo proxy do site, vídeo de 28 MB com Range, arquivo falso recusado, escolher no assistente → salvar → publicar, página pública com `/media/<id>?w=` carregando sem violação de CSP, detalhes de uso, exclusão bloqueada e exclusão livre, 390px, CSRF 403 |
| E2E anteriores reexecutados (professionals 14, courses 15, editor 20) | passando |

Defeitos achados pelos testes e corrigidos: (1) Next cortava o corpo do proxy em 10 MB (`proxyClientMaxBodySize`); (2) o vídeo atual é QuickTime e era recusado; (3) `getByLabel` ambíguo pelo `aria-label` do botão; (4) overflow a 390px por coluna de grid e `input` com largura intrínseca.
Limitações: vídeo sem poster nem transcodificação (sem ffmpeg); original nunca servido; histórico antigo não protege contra exclusão; sem rate limit específico de envio; derivados síncronos (imagem de 12000 px pode levar segundos).


## Fase 7 — subfases 7B, 7C e 7D **concluídas, aguardando revisão** (2026-10-17)
**7B — Home como documento + cursos dinâmicos** (D-025). Entregue: migração `home_pages`/`home_versions`; `HomeService` (estado, publicar, leitura pública, `ensureHomeRow`); `AdminHomeController` (reusa as ações de documento) e `PublicHomeController`; rotas `/admin/home/*` e `/public/home`; `CourseService.homeCards`; contracts `home.ts`; renderer `resolveHomeDocument`/`homeCourseItems`; `/` lendo o snapshot com fallback ao template; editor `/admin/editor/home` + quadro `/admin/preview/home/live`; menu "Home".
**7C — Modelos de página do Profissional** (D-026). Entregue: seções `professional.stats` e `professional.cta`; 6 modelos (Original, Autoridade, Vídeo, Conversão, Imersivo, Premium) com composição, textos padrão e tema (`professional.templates.css`, `data-tpl`); coluna `professionals.template_key`; `DocumentService` valida o documento contra o modelo do profissional; troca de modelo só antes de personalizar (`template_locked`); restaurar versão restaura o modelo; seletor com "Ver exemplo" no assistente; `/preview/modelos/[key]`.
**7D — Validação**: ver tabela. Conferência visual dos 6 modelos em 1440 e 390 px por capturas (ver "Limitações").

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck` e `pnpm lint` (workspace) | sem erros |
| page-schema 34 · contracts 31 · section-schemas 8 · editor-core 19 · design-system 4 | passando |
| page-renderer 93 (novos: `resolveHomeDocument` ×4, modelos ×16: documento válido e render por modelo, composição prometida, Original idêntico ao caminho antigo, números só do cadastro, chamada com/sem cursos, textos longos, modelo desconhecido, link externo com `rel`) | passando |
| web 56 | passando |
| api (MySQL real) | **97 passando, 8 execuções seguidas na suíte inteira + 3 após o fechamento** (novos: `home.spec` ×7, `templates.spec` ×5, `media.spec` ×12) |
| E2E Chrome (API + web em produção): admin-auth, course 14, professional 11, home 15, professionals 14, courses 15, editor (20), **media 11, home-editor 14, templates 11** | todos passando |
| `pnpm audit --prod` | os mesmos 4 avisos de antes (1 alto `braces`, 3 moderados AdonisJS); `sharp` e `file-type` sem avisos |

E2E `home-editor` (14): editor da Home com prévia ao vivo e autosave, regras (hero obrigatório, profissionais/cursos automáticos), publicar → `/` muda na hora, curso publicado aparece na Home com link que abre, despublicar tira o cartão, rascunho não muda o público, histórico/restaurar versão, "Restaurar padrão", CSRF 403, 390px. E2E `templates` (11): exemplos dos 6 modelos com `data-tpl`, escolher Premium no assistente e criar, um profissional publicado por modelo com composição conferida na página pública, troca de modelo no rascunho, editor com Números/Chamada, bloqueio após personalizar, "Restaurar do cadastro" libera, 390px nos 6 exemplos e no assistente.
Defeitos achados pelos testes e corrigidos: (1) `testUtils.db().truncate()` deixava a suíte de API intermitente (D-027); (2) linha da Home sumia com `truncate` → `ensureHomeRow`; (3) texto escuro sobre cartão branco no Premium/Imersivo, grade do Imersivo com buraco, CTA da Conversão dourada colada na bio dourada, selo "Trabalhos em destaque" ilegível no fundo escuro (ajustados por inspeção das capturas); (4) E2E de mídia dependia de um texto ambíguo ("publicad") e corria contra a publicação.
Limitações: Curso e Home não ganharam modelos adicionais; o tema dos modelos foi validado por inspeção de capturas e por testes de estrutura, **não por comparação de pixel** (não há original para comparar) — espere ajustes após a sua conferência em tela; `/preview/modelos/*` e `/preview/*` são públicas (noindex) até a Fase 8; sem axe/Lighthouse nem Firefox/Safari; Home sem agendamento; vídeo sem poster; nenhum teste de carga; o seed `lukas-campos` continua no modelo Original.
