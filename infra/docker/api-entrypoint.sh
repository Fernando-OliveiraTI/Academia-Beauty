#!/bin/sh
# Entrada do container da API: aplica as migrações pendentes e sobe o servidor.
# O deploy troca a imagem, mas não roda migrações: sem este passo uma versão com migração nova sobe com o banco antigo
# e as rotas que usam as colunas novas respondem 500.
#   SKIP_MIGRATIONS=true  sobe sem migrar (ex.: instâncias extras ao escalar, ou para recuperar de uma migração com erro).
# Falha na migração derruba o container de propósito: melhor parar do que servir com o esquema pela metade.
set -e

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "[entrypoint] aplicando migrações pendentes…"
  node ace.js migration:run --force
fi

exec node bin/server.js
