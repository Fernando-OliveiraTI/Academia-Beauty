# Site e painel (Next.js, saída "standalone"). Contexto de build: raiz do repositório.
#   docker build -f infra/docker/web.Dockerfile -t academia-web \
#     --build-arg API_ORIGIN=http://api:3333 --build-arg MEDIA_CDN_HOST= --build-arg CHECKOUT_ALLOWED_HOSTS=pay.exemplo.com .
FROM node:20-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# Valores lidos no build (rewrites, CSP e validação de mídia).
ARG API_ORIGIN=http://api:3333
ARG MEDIA_CDN_HOST=
ARG CHECKOUT_ALLOWED_HOSTS=
ENV API_ORIGIN=$API_ORIGIN MEDIA_CDN_HOST=$MEDIA_CDN_HOST CHECKOUT_ALLOWED_HOSTS=$CHECKOUT_ALLOWED_HOSTS
RUN pnpm --filter @academia/web build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/admin/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
