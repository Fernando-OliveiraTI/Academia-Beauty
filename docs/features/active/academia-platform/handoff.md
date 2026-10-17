# Handoff — Academia Beauty Platform

**Feature:** academia-platform · **Fase atual:** Fases 0–5 concluídas e aprovadas (D-017 a D-022); **Fase 7 concluída (7A mídia, 7B Home + cursos dinâmicos, 7C modelos, 7D validação), aguardando a sua conferência em tela e revisão (D-023 a D-027)**; Fase 6 (The Members) não autorizada; Fase 8 não iniciada · **Data:** 2026-10-17

## Entregas
- Fase 0: `references/` (somente leitura) + baseline congelado em `packages/visual-baseline`.
- Fase 1: monorepo, design-system, contracts, page-schema, API (auth/RBAC/auditoria), web (login + /admin), CI, README.
- Fase 2: `packages/page-renderer` (PageRenderer, schemas Zod por seção, registry, 3 templates originais), rotas `/preview/{home,profissional,curso}`, fontes Geist e JetBrains Mono hospedadas, ferramentas `compare` e `extract-css`, 3 suítes E2E.
- Fase 3: CRUD/assistente/publicação de profissionais (painel `/admin/profissionais`), snapshots imutáveis, páginas públicas `/profissionais/[slug]` e `/` (vitrine real), invalidação de cache por tag, seed de desenvolvimento, `e2e:professionals`. Revisão: `review-context.md` (seção Fase 3).
- Fase 4: cursos (CRUD/assistente/publicação/vitrine no profissional), oferta com preço calculado só no backend, checkout Modo A (redirecionamento a domínio autorizado), página pública `/cursos/[slug]`, `e2e:courses`. Revisão: `review-context.md` (seção Fase 4).
- Fase 5: `packages/editor-core`, `packages/section-schemas` (+ `page-schema` compilado), API de documentos/versões, editor `/admin/editor/{profissionais,cursos}/[id]` com pré-visualização ao vivo, `e2e:editor`. Revisão: `review-context.md` (seção Fase 5).
- Fase 7: biblioteca de mídia (`/admin/midia`, upload com derivados WebP/AVIF, `/media/<id>?w=`, seletor nos formulários), Home como documento (`/admin/editor/home`, publicar/histórico, `/` lê o snapshot) com vitrine de cursos dinâmica, e 5 modelos novos de página do Profissional (Autoridade, Vídeo, Conversão, Imersivo, Premium; escolha no assistente, exemplos em `/preview/modelos/<key>`). Revisão: `review-context.md` (seção Fase 7).
- Resultados de teste: `progress.md`. Decisões: `decisions.md` (D-001 a D-018). Orientação para review independente: `review-context.md`. Antes/depois das correções da Home: `review/home-fixes/`.

## Como retomar
1. `docker compose -f infra/containers/docker-compose.yml up -d` (MySQL em 3317).
2. API: `cd apps/api && node ace migration:run && node ace db:seed && node ace serve` (3333). Defina também `CHECKOUT_ALLOWED_HOSTS` (ex.: `pay.example.com`): vazio = nenhum link de checkout é aceito. Em produção atrás de proxy defina `TRUSTED_PROXIES` (IP real no limite de login). Defina `REVALIDATE_URL` e `REVALIDATE_SECRET` (>= 24 caracteres) na API e o mesmo `REVALIDATE_SECRET` em `apps/web/.env.local`, senão publicar não atualiza o cache do site na hora (só em até 300 s). Web em produção: `pnpm --filter @academia/web build && pnpm --filter @academia/web start` (3100); os E2E e `compare` precisam do build de produção.
3. `pnpm install` (gera `dist` de contracts/page-schema/section-schemas), `node ace migration:run` (inclui `add_page_documents`), depois `pnpm typecheck && pnpm lint && pnpm test` deve passar (page-renderer 93, page-schema 34, contracts 31, design-system 4, editor-core 19, section-schemas 8, web 56, api 97; a suíte inteira da API roda de uma vez, D-027). Variáveis novas da API/site: `MEDIA_STORAGE_PATH` (padrão `storage/media`) e `MEDIA_CDN_HOST` (mesmo valor na API e no build do web; vazio = só o próprio site). Depois de mudar código do web, rebuild + restart (`pnpm --filter @academia/web build && … start`).
4. `pnpm --filter @academia/web e2e:course|e2e:professional|e2e:home|e2e:media|e2e:home-editor|e2e:templates|e2e:editor|e2e:courses` e `E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm --filter @academia/web e2e:professionals` e, em `packages/visual-baseline`, `pnpm compare ...` (comandos completos no README).

## Armadilhas conhecidas
- **Next corta o corpo do proxy `/api` em 10 MB** por padrão: `experimental.proxyClientMaxBodySize: '70mb'` em `next.config.ts` é o que deixa o envio de vídeo funcionar (D-024).
- Imagens novas só aparecem no `<img>` com `?w=` pelo `mediaSrc`; o original enviado nunca é servido (só derivados). Vídeo QuickTime (`.mov`/o `video.mp4` atual) entra como MP4.
- Testes de API: use `truncateAll()` (tests/helpers) em vez de `testUtils.db().truncate()` (D-027). Processos `bin/test.js` antigos podem ficar vivos segurando o banco de teste: confira com `ps`.
- O E2E espera o texto exato "Publicado. A página pública já foi atualizada." (a regex genérica corria contra a publicação).
- `pkill -f "ace serve"` não mata o processo-filho: confira `lsof -iTCP:3333`. Para o web use `kill $(lsof -tiTCP:3100 -sTCP:LISTEN)`.
- Portas 3000 e 3307 pertencem a outros projetos; não encerrar.
- Scripts `tsx` que usam `page.evaluate` com funções internas precisam do shim `window.__name = (f) => f` (já embutido em `compare`, `extract-css` e nos E2E).
- `fetch` público do Next precisa de `cache: 'force-cache'` e `revalidateTag(tag, { expire: 0 })` (não `'max'`); ver D-018. O E2E de profissionais cria registros `e2e-*` (arquivados) no banco de desenvolvimento.
- Seed/CLI não invalida o cache do Next: após semear, chame `/internal/revalidate` ou espere o ISR (300 s) antes de testar páginas públicas.
- A captura `fullPage` do Playwright não dispara os reveals (seções saem vazias): capture por viewport rolando até a seção.
- Reiniciar a API após mudar `.env` ou `config/*` (o `ace serve` sem `--hmr` não recarrega).
- Os CSS `*.generated.css` são saída da ferramenta: ajustes manuais vão em `*.extra.css` (nunca editar o gerado). `course.css` é a única exceção (portado e mantido à mão).
- O wrapper de cada template (`.pg-course`, `.pg-pro`, `.pg-home`) substitui o `<body>` do original: tudo que o `body` do painel herdaria (line-height, fonte) precisa ser zerado no CSS do template. Classes genéricas do painel usam prefixo `admin-`.
- Home/Profissional não são reproduzíveis em pixel nas camadas de efeito (D-007): use `compare --hide`.

## Pendências
- D-017 a D-022 e a revisão independente **aprovadas** (D-023); ajustes virão após teste em tela do usuário.
- **Fase 7 implementada e validada por testes (progress.md); falta a sua conferência em tela** (principalmente o visual dos 6 modelos em `/preview/modelos/<key>`, o editor da Home, a biblioteca de mídia) e a revisão independente. A Fase 7 foi commitada e enviada (`0b803d5`, `origin/main`). Revisão do código feita em 2026-10-17 sem bloqueios; riscos baixos: upload em memória (até 60 MB) e janela de concorrência entre checagem de uso e exclusão de mídia (rever na Fase 8).
- Decidir (D-026): rótulos/descrições dos modelos, se Curso e Home também terão modelos, e se `/preview/modelos/*` e `/preview/*` saem do ar já (hoje públicas, noindex).
- Decidir (D-025): Home sem curso publicado esconde a seção (em vez de mostrar cartões fixos); confirmar.
- Mídia: escolher provedor real de storage/CDN na Fase 8 (hoje local); vídeo sem poster/transcodificação.
- **Fase 6 (The Members) não autorizada** e depende de documentação oficial.
- Aprovar/ajustar a Fase 4 (D-019): oferta dentro do snapshot (preço só muda ao republicar), parcela arredondada para baixo (29,16 × 29,17 do protótipo), `commerce.manage` só admin, curso só publica com profissional publicado, domínios de `CHECKOUT_ALLOWED_HOSTS` reais, Home de cursos ainda estática (dinamizar agora ou só na Fase 7).
- Conteúdo do curso 1 que o negócio ainda decide: garantia de 7 dias, FAQ e depoimentos reais (hoje fora da página dinâmica), "30% de desconto" como valor real, link real do The Members.
- Aprovar/ajustar a Fase 3 (D-017/D-018): snapshot guarda dados e não o documento, JSON em vez de tabelas de trabalhos/certificações, sem agendamento, `/` público (noindex) já com a vitrine real × manter só `/preview/home` até a Fase 7, mídia agora vem da biblioteca (7A).
- Dados reais dos outros 4 profissionais da Home (hoje rascunhos com só nome e foto).
- Aprovar/ajustar: boost do Profissional animado (D-014), gap de 20px dos cards de curso (D-014), valores das correções da Home (D-016), slug do curso 1 da Home, grafia "Lucas Kampos" × "Lukas Campos", remoção das camadas escondidas da Home (D-015).
- Conteúdo do Curso que precisa de decisão do negócio: garantia de 7 dias, FAQ, depoimentos de exemplo, "30% de desconto" no título, nomes de celebridades (ver `analysis/03-curso.md`).
- Ativos: foto do instrutor (`lukas-perfil.jpg`) e capa definitiva do curso (hoje SVG local), vídeo de 28,6 MB (otimizar/hospedar), PNGs de até 2990×3397, logo oficial.
- `/preview/*` são públicas (noindex): remover/proteger na Fase 8. Os cartões de curso da Home ainda são estáticos: só `/cursos/morena-iluminada` existe; os demais levam a 404.
- Repositório git ativo (`main`, remote `origin` no GitHub); `ci.yml` ainda não foi confirmado como executado no GitHub Actions.

## Próximo passo
Decididas pelo usuário: AdonisJS 7/`braces` depois se necessário; gatilhos MySQL não; pausa do autoplay e CLS aguardam a verificação visual dele; **nova rodada de comparação visual (`compare --max-diff`) a combinar**. Depois da sua conferência da Fase 7: Fase 6 (The Members, depende de documentação oficial) e Fase 8 (produção: SEO, CDN/storage real, observabilidade, remover/proteger `/preview/*`). Seguem abertas as pendências de negócio (conteúdo real, ativos, git).
