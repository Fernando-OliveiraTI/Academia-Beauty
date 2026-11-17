# API (AdonisJS). Contexto de build: raiz do repositório.
#   docker build -f infra/docker/api.Dockerfile -t academia-api .
FROM node:20-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @academia/api build
# Dependências de produção (inclui os pacotes do workspace já compilados) isoladas numa pasta.
RUN pnpm --filter @academia/api deploy --prod --legacy /out

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3333 HOST=0.0.0.0
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/build ./
COPY infra/docker/api-entrypoint.sh ./entrypoint.sh
# Mídia enviada (monte um volume em /app/storage) e usuário sem privilégios.
RUN mkdir -p /app/storage/media && chmod +x /app/entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migra e sobe (ver entrypoint.sh; SKIP_MIGRATIONS=true pula a migração).
CMD ["./entrypoint.sh"]
