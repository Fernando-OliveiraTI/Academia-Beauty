# Academia Beauty Platform

Plataforma de profissionais, cursos, landing pages e CMS visual da Academia Beauty.
Planejamento, decisões e análises: `docs/features/active/academia-platform/`.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `apps/web` | Next.js 16: painel `/admin` e pré-visualização dos templates em `/preview/{home,profissional,curso}` (rotas públicas definitivas vêm com o CMS) |
| `apps/api` | AdonisJS 6: autenticação, RBAC, auditoria, e (próximas fases) domínio, publicação e comércio |
| `packages/design-system` | Tokens oficiais (extraídos de `references/curso`) e primitivas acessíveis |
| `packages/contracts` | Papéis, permissões e DTOs compartilhados (compilado para `dist/`) |
| `packages/page-schema` | Documento de página em JSON versionado, registry de seções, validação segura |
| `packages/section-schemas` | Schemas Zod das seções, catálogo (`SECTION_META`), validação autoritativa do documento (usada pela API e pelo editor); compilado para `dist/` |
| `packages/editor-core` | Motor do editor visual: comandos puros sobre o documento, regras e histórico desfazer/refazer |
| `packages/page-renderer` | `PageRenderer`, seções React e templates originais (Home, Profissional, Curso) com CSS escopado por template |
| `packages/visual-baseline` | Baseline visual das 3 referências (`baseline/`), captura, comparação visual (`compare`) e extração de CSS (`extract-css`) |
| `references/` | Cópia **somente leitura** das 3 páginas aprovadas (hashes em `MANIFEST.sha256`) |
| `infra/containers` | MySQL de desenvolvimento (Docker) |

## Requisitos

Node 20.9+ (testado em 20.18), pnpm 10, Docker (MySQL) e Google Chrome (testes visuais e E2E).

## Primeira execução

```bash
pnpm install
docker compose -f infra/containers/docker-compose.yml up -d     # MySQL em 127.0.0.1:3317
cp apps/api/.env.example apps/api/.env                           # preencha APP_KEY, DB_PASSWORD, ADMIN_PASSWORD
(cd apps/api && node ace generate:key && node ace migration:run && node ace db:seed)
cp apps/web/.env.example apps/web/.env.local
pnpm dev                                                         # web em :3100, api em :3333
```

Em desenvolvimento use as credenciais do `docker-compose.yml` (`academia` / `academia_dev_only`, banco `academia`). `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo 12 caracteres) criam o primeiro administrador no seed. Nunca reutilize essas senhas fora do ambiente local.

## Variáveis de ambiente da API (produção)
- `CHECKOUT_ALLOWED_HOSTS`: hosts exatos autorizados para o link de checkout (Modo A); subdomínios exigem curinga (`*.dominio.com`). Vazio = nenhum link aceito. O mesmo valor também precisa estar no ambiente do **web** (CSP `frame-src` do checkout embutido da The Members; ver D-030).
- `REVALIDATE_URL` e `REVALIDATE_SECRET` (≥ 24 caracteres, o mesmo no web): invalidação do cache do site ao publicar.
- `TRUSTED_PROXIES`: IPs/CIDR do proxy/ingress (ou `loopback`) cujo `X-Forwarded-For` vale como IP do cliente (limite de login, auditoria). Sem isto, só loopback é confiável: atrás de um proxy não listado todos os acessos parecem vir do mesmo IP.
- Defina `NODE_ENV=production` também em staging (stack traces só em dev/teste).
- Opcional (infra): gatilhos MySQL que proíbem UPDATE/DELETE nas tabelas `*_versions` exigem `SUPER` ou `log_bin_trust_function_creators=1`; hoje a imutabilidade dos snapshots é garantida pela aplicação (testada).

## Verificação

```bash
pnpm typecheck
pnpm test                         # contracts, page-schema, design-system, web, api (usa o banco academia_test)
pnpm --filter @academia/api lint
pnpm --filter @academia/web e2e   # requer api e web (build de produção) rodando e E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
pnpm baseline                     # recaptura em packages/visual-baseline/output para comparar
```

Templates (Fase 2) — com o web em produção (`pnpm --filter @academia/web build && pnpm --filter @academia/web start`, porta 3100):

```bash
pnpm --filter @academia/web e2e:course | e2e:professional | e2e:home      # interações no Chrome (não usam a API)
pnpm --filter @academia/web e2e:professionals | e2e:courses | e2e:editor   # fluxo completo no painel (API + web em produção + E2E_ADMIN_*; cursos exige CHECKOUT_ALLOWED_HOSTS na API)
cd packages/visual-baseline
pnpm compare curso                                                         # layout por seção + pixels contra o baseline
pnpm compare profissional --hide ".cb-telemetry-layer,.cb-video-style-fx,.bio-bg"
pnpm compare home --baseline-mode --mask ".cb-footer-fx" \
  --hide ".cb-hero-boldfx,.cb-hero-ribbons,.cb-hero-energy,.cb-telemetry-layer,.cb-video-style-fx,.cb-marquee,.cb-footer-energy"
pnpm extract-css <home|profissional|curso> --scope <classe> --kf <prefixo> --out <arquivo>   # regenera o CSS extraído
```

`compare` usa `--hide` para ocultar camadas animadas/aleatórias nos dois lados (referência capturada ao vivo) e `--baseline-mode` para desligar as correções aprovadas da Home. Por padrão ele bloqueia `/fonts/*` para usar a mesma fonte de reserva do baseline; `--real-fonts` usa a Geist hospedada.

O banco `academia_test` é criado por `infra/containers/mysql-init/` na primeira subida do volume (em volume já existente, crie-o manualmente).

## Segurança já implementada (Fase 1)

Sessão no servidor (revogável por usuário: troca de senha, desativação e "encerrar sessões" invalidam todas), cookie HttpOnly/SameSite=Lax, CSRF por token XSRF, limites de login por IP, por e-mail e por par (só falhas contam), verificação em duas etapas (TOTP + códigos de recuperação, exigível de administradores), política de senha, gestão de usuários com auditoria, respostas de login sem enumeração de contas, RBAC por permissão no servidor, auditoria de ações administrativas, headers de segurança (CSP **com nonce no painel**, `'unsafe-inline'` só no site público estático; HSTS; X-Frame-Options; nosniff) no web e na API, limites por IP nos endpoints públicos em store compartilhado, retenção de dados agendada (`maintenance:purge`) e verificação de configuração na subida em produção. Ver `SECURITY.md` e `docs/seguranca/`.
