# Deploy no Azure (imagens Docker)

O workflow `.github/workflows/main_academia-beauty.yml` roda a cada push na `main`:

1. **verify**: o CI completo (`ci.yml`: typecheck, lint, testes com MySQL, `pnpm audit:prod`, build do web). Se falhar, nada é publicado.
2. **images**: constrói `infra/docker/api.Dockerfile` e `infra/docker/web.Dockerfile` e publica em `ghcr.io/<dono>/academia-api` e `academia-web` (tags `:<sha>` e `:latest`).
3. **deploy-api / deploy-web**: só rodam se as variáveis abaixo existirem. Sem elas, o workflow termina depois de publicar as imagens (o deploy não quebra).

O workflow anterior (publicar o repositório inteiro como um único app Node) foi substituído: o projeto tem dois serviços (API na porta 3333, web na 3100) e o `package.json` da raiz não tem `start`.

## Configuração (GitHub → Settings → Secrets and variables → Actions)

| Tipo | Nome | Valor |
|---|---|---|
| Variável | `AZURE_WEBAPP_API` | Nome do Web App for Containers da API |
| Variável | `AZURE_WEBAPP_WEB` | Nome do Web App for Containers do site/painel |
| Variável | `WEB_API_ORIGIN` | URL interna da API vista pelo web (ex.: `https://<app-da-api>.azurewebsites.net`); é gravada no build do web |
| Variável | `MEDIA_CDN_HOST`, `CHECKOUT_ALLOWED_HOSTS` | Como na API (CSP e validação de mídia do web) |
| Config. do Web App do site (execução) | `SITE_URL`, `SITE_INDEXING` | `SITE_URL` = origem pública (ex.: `https://dominio.com.br`, sem caminho). `SITE_INDEXING=true` libera os buscadores (só em produção e com `SITE_URL` válido). **Sem isso o site inteiro fica `noindex` e o `robots.txt` bloqueia tudo.** Defina só quando o domínio definitivo estiver no ar |
| Config. dos Web Apps (execução) | `APPLICATIONINSIGHTS_CONNECTION_STRING` (API e site), `TELEMETRY_REQUEST_SAMPLING` (opcional, API) | Telemetria (Fase 8B). Vazio = desligada, sem efeito. Criação dos recursos e alertas: `infra/azure/monitoring.sh`; detalhes em [`observabilidade.md`](observabilidade.md) |
| Segredo | `AZURE_PUBLISHPROFILE_API`, `AZURE_PUBLISHPROFILE_WEB` | Perfil de publicação de cada app (Azure → app → Get publish profile) |

Crie também o *environment* `production` (Settings → Environments); aprovação manual opcional.

## No Azure (uma vez)

- Dois **Web Apps for Containers** (Linux), ou o mesmo plano com dois apps. Porta: API `3333`, web `3100` (`WEBSITES_PORT`).
- Imagens no GHCR: torne os pacotes públicos **ou** configure `DOCKER_REGISTRY_SERVER_URL=https://ghcr.io`, `DOCKER_REGISTRY_SERVER_USERNAME` e `DOCKER_REGISTRY_SERVER_PASSWORD` (token com `read:packages`).
- Variáveis de ambiente da API: veja `docs/seguranca/operacao.md` (a API recusa subir com configuração insegura). Banco: o MySQL do Azure, com `SESSION_DRIVER=database` e `LIMITER_STORE=database`.
- Variáveis do web: `API_ORIGIN` (mesmo valor do build) e `REVALIDATE_SECRET` (igual ao da API).
- Mídia enviada: monte armazenamento persistente em `/app/storage` da API (Azure Files); sem isso os arquivos somem a cada deploy.
- Primeira vez e a cada versão com migração: `node ace migration:run --force` (SSH/console do app da API). Agende `node ace maintenance:purge` (retenção) diariamente.
- Se o app `academia-beauty` atual for de stack Node, recrie-o como Web App for Containers (a configuração de publicação muda).
