# Plano — Academia Beauty Platform (Fase 1: análise e arquitetura)

Status: **proposta aguardando aprovação**. Nenhum código de produto foi escrito.
Inventários detalhados (CSS, JS, assets, seções, animações): `analysis/01-home.md`, `analysis/02-profissional.md`, `analysis/03-curso.md`. Decisões: `decisions.md`.

## 1. Objetivo e critérios de aceite
Transformar três páginas aprovadas (Home, Profissional, Curso) em plataforma dinâmica e administrável, com fidelidade visual. Aceite geral: os 20 critérios do briefing (seção 28), validados fase a fase.

## 2. Diagnóstico resumido
| Página | Fonte | Situação |
| --- | --- | --- |
| Home | `Site_Academila/Home.html` | 13.312 linhas, 139 `<style>` (137 patches `cb-*`, ~3.900 `!important`), 76 `<script>`. ~41% das regras de patch não casam elemento. Vence o último `!important`. Sem Swiper/GSAP/jQuery. Tema Shopify ausente em disco e não é necessário ao visual. |
| Profissional | `Site_Academila/Lukas_20.html` | 1.946 linhas, CSS/JS embutidos, 6 blocos de patch. Só Google Fonts como dependência. Hero com 10 animações CSS, 72 partículas JS e 3 canvas 2D. |
| Curso | `pagina-navalha/index.html` + `css/style.css` + `js/script.js` + `js/gateway.js` | Melhor organizada. 14 seções, tokens em `:root`, checkout de 3 etapas (mock). Preço calculado no cliente. |

Conclusão técnica: a fidelidade será obtida **medindo o resultado final renderizado** (estilo computado da regra vencedora), não copiando cada patch. Isso mantém o visual e descarta o peso morto.

### Achados que exigem decisão (ver seção 12)
- Home: fonte Gilroy usada sem `@font-face` (renderiza fallback genérico hoje); hero com 5 loops rAF sem pausa; h1 do hero cresce no mobile; título de "Marcas" cortado em 768/390; card órfão em tablet; link do Lukas aponta para arquivo inexistente; slug do curso 1 não bate com o título.
- Profissional: bug no canvas "boost" (`reduce` vs `reduced`, camada nunca anima); ticker ignora reduced-motion; vídeo com `autoplay` sem `muted` (bloqueado pelos navegadores); `video.mp4` de 28,6 MB; capa do curso é imagem remota da Shopify e não existe em disco; cards de curso sem gap entre si; nome "Lukas Campos"/"Lucas Kampos" inconsistente.
- Curso: depoimentos de exemplo; garantia, FAQ, parcelas, PIX/boleto são premissas do protótipo; `lukas-perfil.jpg` ausente; preço e payload (`amount`) vêm do cliente; bugs de `cardBrand`, parcelas somando R$ 175,02, contador que pisca.
- Marca: "Academia Beaty" (briefing) × "Academia Beauty" (arquivos) × "Carreira Beauty" (partes das páginas).

## 3. Arquitetura proposta
Monorepo pnpm (reaproveitando o que o briefing pede: Next.js + AdonisJS + MySQL).

```text
apps/web      Next.js: site público (SSG/ISR) + admin + editor
apps/api      AdonisJS: domínio, auth/RBAC, publicação, mídia, comércio, webhooks
packages/
  design-system   tokens + primitivas extraídos das 3 páginas
  page-schema     schemas Zod, tipos, migrações de schema das seções
  page-renderer   registry de seções + PageRenderer (público e preview)
  contracts       DTOs web<->api
  visual-baseline screenshots/medições de referência e testes de fidelidade
infra/            containers de dev, manifests
docs/
```

Princípios: público lê **snapshots publicados** (JSON validado, cacheável); admin edita **rascunhos**; preço/estado comercial só do backend; nenhum HTML/JS/CSS arbitrário no JSON.

### 3.1 Estratégia de fidelidade visual
1. Fixar baseline: screenshots + estilos computados + animações ativas das três referências em 1440/1024/900/768/620/390.
2. Extrair tokens e CSS final por seção (valores vencedores), não os patches.
3. Reconstruir como componentes React com CSS equivalente; efeitos visuais como componentes client-only isolados (evita mismatch de hidratação dos `Math.random()`).
4. Teste visual automatizado (Playwright) comparando original × React por viewport, mais teste de estados (hover, reveal, carrossel, accordion, etapas).
5. Qualquer divergência inevitável é listada e só aplicada com autorização.

### 3.2 Organização de componentes React
`design-system/{tokens,primitives,patterns}`; `page-renderer/sections/{home,professional,course,common}`; `apps/web/src/features/{professionals,courses,pages,templates,media,commerce,publishing}`; `components/{admin,editor}`. Efeitos (`HeroTelemetry`, `ParticleField`, `Ticker`, `ScrollReveal`, `ProfessionalCarousel`) viram componentes isolados reutilizáveis entre as três páginas.

## 4. Modelo de dados inicial (MySQL)
- Identidade/auditoria: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`.
- Catálogo: `professionals` (nome, nome de exibição, slug, especialidade, bios, métricas, status, `home_visible`, `home_order`, `featured`), `professional_social_links`, `professional_certifications`, `professional_works` (portfólio), `courses` (FK `professional_id` obrigatória, slug, descrições, modalidade, nível, carga, status, `showcase_visible`, `showcase_order`, `featured`), `course_curriculum_items`.
- CMS: `templates`, `template_versions`, `pages` (tipo, owner polimórfico, slug, status, `published_version_id`), `page_drafts` (JSON + revisão), `page_versions` (snapshot imutável), `page_publications` (agendamento).
- Mídia: `media_assets`, `media_variants`, `media_usages`.
- Comércio: `commercial_configs` (preços em centavos, moeda, oferta, status), `checkout_integrations` (provedor, modo, IDs externos, URL validada, ambiente, referência de segredo), `checkout_events` (ID externo único, payload, status, tentativas).
- Índices: slug único por tipo, `(status, home_visible, home_order)`, `(professional_id, status, showcase_order)`.

## 5. Editor visual
Documento JSON versionado: `{schemaVersion, template, sections[{id, type, schemaVersion, variant, content, settings, visibility, responsive, mediaRefs}]}`. Registry de seções conhecidas (tipo, schema Zod, defaults, editor de propriedades, componente, thumbnail, migração). Comandos com undo/redo; autosave com revisão esperada (rejeita conflito); preview em iframe usando o mesmo renderer; publicar = snapshot imutável em transação + invalidação por tag. Sem script, HTML, CSS ou URL não validados; rich text em estrutura limitada.

## 6. Templates e seções
Template = versão imutável de composição + defaults; página criada a partir dele passa a ter documento próprio. Iniciais: **Home Original**, **Profissional Original**, **Curso Original** (fiéis). Autoridade, Vídeo, Conversão, Imersivo, Premium só depois da fidelidade dos três originais, seguindo o design system.

## 7. Fluxos
- **Profissional**: Novo → dados → template → editor → preview (URL assinada) → publicar/agendar → aparece automaticamente na vitrine da Home (se publicado, ativo e `home_visible`), ordenado por `home_order`.
- **Curso**: dentro do profissional → dados → template → editor → oferta (módulo comercial separado) → checkout → preview → publicar → aparece na seção de cursos do profissional. Duplicar não copia IDs externos, webhooks nem slug.
- **Atualização automática**: publicar/alterar/despublicar dispara invalidação por tag (`home`, `professional:{id}`, `course:{id}`); Home e página do profissional leem do snapshot + lista publicada, nunca de tabelas por visita.

## 8. Integração The Members
Sem documentação oficial confirmada, **nada de endpoints presumidos**. Contrato `CheckoutProvider`. Fase inicial só **Modo A** (redirecionamento a URL HTTPS validada/allowlist, preço do backend, sem inferir pagamento pelo retorno do navegador). **Modo B** só após documentação oficial: autenticação, checkout, eventos, assinatura de webhook, idempotência, sandbox, métodos de pagamento, liberação de acesso. Webhooks: persistir antes de processar, chave única por evento, validação de autenticidade, retentativa com backoff.

## 9. Mídia, CDN e cache
Object storage + CDN; upload por URL assinada com validação de tipo real; derivados AVIF/WebP/posters via fila; cards exibidos a 96px não podem servir arquivos de 2990×3397. ISR/SSG com invalidação por tag; Redis só para locks, rate limit e filas se justificado.

## 10. Segurança
RBAC server-side, CSRF, CSP/HSTS, validação Zod nos dois lados, rate limiting, auditoria de publicação/preço/integração, secrets fora do banco e do JSON, LGPD (consentimento para analytics).

## 11. Fases (cada uma exige aprovação)
0. **Confirmações e baseline** — decisões da seção 12, ativos fechados, baseline visual congelado.
1. **Fundação** — monorepo, ambientes, design-system, auth/RBAC, banco, CI.
2. **Migração fiel** — schemas, registry, renderer, os 3 templates originais, testes visuais. *Aceite: comparação aprovada nos breakpoints.*
   - **2A Curso** (concluída): `packages/page-renderer`, template `course-original`, rota `/preview/curso`.
   - **2B Profissional** (concluída): template `professional-original`, rota `/preview/profissional`, ferramenta `extract-css`.
   - **2C Home** (concluída; correções de D-004 item 3 em `review/home-fixes/`).
   - **2D Consolidação**: relatório visual final, a11y, desempenho dos efeitos, docs/review-context da fase.
3. **Profissionais** — CRUD, assistente, publicação, vitrine automática na Home. *(concluída, aguardando revisão — D-017/D-018, progress.md)*
4. **Cursos e comércio** — CRUD, vitrine automática no profissional, config comercial, Modo A. *(concluída, aguardando revisão — D-019, progress.md)*
5. **Editor visual** — árvore, propriedades, drag/drop, undo/redo, histórico. *(concluída, aguardando revisão — D-020/D-021, progress.md; subfases abaixo)*
   - **5A Motor do editor** (`packages/editor-core`): comandos puros sobre `PageDocument` (adicionar, remover, mover, duplicar, editar conteúdo, visibilidade), regras (seção única, obrigatória, mover só dentro da mesma região), histórico undo/redo com coalescência de digitação. *Aceite: testes unitários cobrindo cada comando, limites e invariantes (ids únicos, documento sempre válido no `parsePageDocument`).*
   - **5B API de documentos**: colunas `document`/`document_revision` em `professionals` e `courses` (e `document` nos snapshots), `GET/PUT /admin/{professionals,courses}/:id/document` com revisão esperada (409), restaurar do cadastro, histórico de versões publicadas e restauração para rascunho, permissões e auditoria; publicação inclui o documento; público lê o documento do snapshot com partes dinâmicas reinjetadas. *Aceite: testes de API (RBAC, CSRF, conflito, schema inválido 422, snapshot imutável, publicado × rascunho).*
   - **5C UI do editor** (`/admin/editor/profissionais/[id]`): árvore de seções (arrastar + botões/teclado), painel de propriedades gerado do schema Zod, preview em iframe com o mesmo renderer, undo/redo, autosave com detecção de conflito, histórico. *Aceite: E2E no Chrome + a11y básica (teclado) + 390px.*
   - **5D Cursos** no mesmo editor e **5E validação** (E2E, segurança/XSS, review-context da fase).
6. **The Members** — condicionada à documentação oficial.
7. **CMS da Home e mídia** — *(concluída, aguardando revisão — D-023 a D-027, progress.md)*.
   - **7A Mídia**: migração `media_assets`/`media_variants`/`media_usages`; interface `MediaStorage` com implementação local; upload multipart (`media.manage`, CSRF, limite de tamanho, tipo real por assinatura do arquivo: jpeg/png/webp/avif e mp4/webm; sem SVG), derivados webp/avif por largura gerados com `sharp` no upload (sem fila: volume baixo, só admin), entrega `GET /media/:id?w=` com negociação por `Accept`, cache imutável, `nosniff` e Range para vídeo; biblioteca `/admin/midia` (listar, enviar, ver usos, excluir só sem uso); seletor de mídia no `SchemaForm`; `safeMediaSchema` aceita `/site/`, `/media/` e `https://` do host `MEDIA_CDN_HOST` (a API confere o host; CSP `img-src`/`media-src` abre ao mesmo host). *Aceite: testes de API (RBAC, CSRF, tipo falso recusado, tamanho, derivados, uso bloqueia exclusão), testes de schema/CSP e E2E de envio→uso no editor.*
   - **7B Home como documento + cursos dinâmicos**: `home_page` (documento, revisão, versões publicadas imutáveis), `GET/PUT /admin/home/document`, publicar/histórico/restaurar, editor `/admin/editor/home`, `/` lê o snapshot publicado; seção de cursos da Home vem dos cursos publicados com `showcase_visible` (fim dos 404). *Aceite: testes de API e E2E (editar Home → publicar → `/` muda; curso publicado aparece na Home).*
   - **7C Templates adicionais** (Autoridade, Vídeo, Conversão, Imersivo, Premium): cada um é um template novo de profissional, escolhido na criação, reutilizando tokens do design system e as seções existentes quando possível. *Aceite: renderiza do `build*Document`, passa em `validatePageDocument`, testes de renderer e E2E de criação com cada template.*
   - **7D Validação**: suítes completas, E2E das fases anteriores sem regressão, segurança de upload (tipo falso, path traversal, tamanho), `review-context.md` e checkpoint.
8. **Produção** — SEO, CDN, observabilidade, carga, backup, rollback.
9. **Editor visual v2 (refinamento de telas, pedido do usuário em 2026-10-17)** — modelo de referência: cabeçalho "Editar página" (Voltar, chip da página, status, Desktop/Tablet/Celular em ícones, Ver página, Mais ações, Publicar), lista de seções numerada com miniatura e descrição, painel direito com abas Conteúdo/Estilo/Avançado. *(9A, 9B e 9C implementadas; aguardam a sua conferência em tela)*
   - **9A Modelo visual** *(autorizada)*: cabeçalho, lista com miniaturas reais (capturas geradas uma vez por script e servidas de `public/admin/section-thumbs/`), abas Conteúdo e Avançado (visibilidade, posição, identificador, remover), Estilo como aba reservada, menu "Administrador". *Aceite: E2E do editor (editor, home-editor, templates) ajustados e passando; 1440 e 390 px conferidos.*
   - **9B Aba Estilo funcional — só Fundo** *(implementada em 2026-10-19, D-031; aguardando conferência em tela)*: `settings.background` por seção, em tons nomeados (sem cor livre, sem CSS/HTML livre). Como o texto de cada seção é ligado ao fundo original dela, os tons dependem do **esquema de cores** da seção no modelo (`backgroundSchemeOf`, medido nas páginas renderizadas): esquema escuro (texto claro) aceita `surface`/`dark`/`glow`; esquema claro (texto escuro) aceita `white`/`paper`/`gold`. Aceitam fundo: seções do corpo do Curso (todas escuras, menos hero, oferta e checkout) e do Profissional (Trajetória e Cursos claras, Vídeo/Números/Chamada escuras, Trabalhos clara, escura nos modelos Imersivo e Premium). **A Home fica de fora** (alterna claras e escuras com cores fixas por seção). O servidor recusa tom de outro esquema ("não combina"), valor fora da lista e seção sem suporte. Renderer: invólucro `.pg-bg[data-bg]` (`display: contents`) só quando há tom; sem tom o HTML não muda. Editor: aba Estilo com amostras, só dos tons permitidos. Documentos salvos continuam válidos (campo opcional, sem migração).
   - **9C Criar e duplicar seções — texto/destaque, vídeo/galeria, CTA e FAQ/depoimentos** *(implementada em 2026-10-19, D-031; aguardando conferência em tela)*: repetíveis `course.benefits`, `course.faq`, `course.proof`, `course.final-cta`, `professional.bio`, `professional.works`, `professional.video`, `professional.cta`, `home.cta`; limite de **4 por tipo e 30 seções por documento** (validado no servidor e no `editor-core`, `too_many_of_type`). Menu "+ Adicionar seção" oferece "Outra «seção»" (conteúdo padrão do cadastro) e a aba Avançado tem "Duplicar seção" (copia conteúdo e fundo). Ids de seção `<tipo>-<n>`; ids de DOM da 2ª instância em diante ganham o sufixo `--<n>` (`faq--2`; o `--` evita colidir com itens de acordeão como `faq-2`), a primeira mantém as âncoras do modelo. Tipos com CSS preso a `#id` na Home (`home.benefits`, `home.brands`) e os demais ficam únicos. *Fora do escopo desta entrega:* menu de navegação só aponta para a primeira instância.

10. **Checkout próprio do Curso (pedido do usuário em 2026-10-17; ver D-028)** — o checkout em 3 etapas do protótipo passa a existir na página real do curso, totalmente editável, com redirecionamento ao link do provedor no fim. Conexão real com o The Members continua na Fase 6. *(10A implementada em 2026-10-17, aguardando conferência; 10B–10D por fazer)*
   - **10A Schema e renderer**: `course.checkout` ganha `schemaVersion` 2 com migração (documentos salvos continuam válidos): textos de todas as etapas e botões, rótulos do resumo ("Produto", "Desconto", "Total"), nota de garantia, textos de PIX/boleto/cartão, e **campos do comprador configuráveis** (lista de 1 a 8: rótulo, tipo `text|email|cpf|phone`, placeholder, ajuda, obrigatório; máscara e validação por tipo no cliente). `build.ts` deixa de desligar a seção. Etapa 2 em modo redirecionamento mostra a forma de pagamento como informação, o seletor de parcelas vindo da oferta e o botão final. *Aceite: testes de schema (migração v1→v2, limites), de renderer (campos dinâmicos, validação por tipo, sem seção quando a oferta está inativa) e `build.test`.*
   - **10B Valores e link**: continuam em `commercial_configs` (preço, desconto, parcelas, link, ativo; só `commerce.manage`). Acrescentar, se aprovado, textos de oferta que não são do documento só se necessário. Botão final redireciona ao `checkout.url` já validado (`rel=noopener`, sem enviar dado). *Aceite: testes de API/contrato sem regressão e E2E do clique até a URL.*
   - **10C Editor**: aba Conteúdo da seção Checkout com lista de campos (adicionar/remover/ordenar) e textos; seção ligável/desligável por curso; miniatura. *Aceite: E2E do editor de cursos (editar texto + adicionar campo → publicar → página pública).*
   - **10D Validação**: suítes completas, E2E `courses`/`editor`, 390 px, a11y de teclado e review-context.

## 12. Decisões e bloqueadores pendentes
1. Grafia da marca: **Beaty** ou **Beauty** (e o uso de "Carreira Beauty").
2. Fonte da Home: fornecer **Gilroy** (arquivos/licença) ou manter fallback genérico atual.
3. Defeitos do snapshot da Home (h1 do hero no mobile, "Marcas" cortado, card órfão no tablet): **reproduzir como estão ou corrigir**.
4. Canvas "boost" do profissional (bug que o deixa estático): **replicar estático ou corrigir**; ticker em reduced-motion; pausar efeitos fora da viewport.
5. Cards de curso sem espaçamento: definir gap, ordem e estado vazio.
6. Ativos ausentes: capa do curso (Shopify), `lukas-perfil.jpg`, retrato PNG recortado; vídeo (autoplay/mudo, formato, hospedagem; arquivo de 28,6 MB).
7. Conteúdo do curso: preço, desconto, parcelas, garantia, FAQ, depoimentos reais, certificado/carga horária.
8. The Members: documentação, sandbox, modos suportados, webhooks, métodos de pagamento.
9. Provedor de object storage/CDN e hospedagem; domínio e URLs finais.
10. Papéis administrativos iniciais, MFA/SSO.

## 13. Riscos
Patches empilhados na Home podem esconder regras que só o teste visual revela; efeitos pesados (3 canvas + blend) afetam LCP/INP no mobile; edição concorrente; mudanças de schema exigem migradores desde o primeiro template; preço divergente se o cliente puder enviar valores.

## 14. Validação
Visual (Playwright por viewport), comportamento (estados e animações), regra de negócio (vitrines automáticas, rascunho vs. publicado), segurança (permissões, upload, XSS), carga (cache hit/miss, admin, webhooks).
