#!/usr/bin/env bash
# Restaura um backup gerado por backup.sh. DESTRUTIVO: substitui o banco e a mídia atuais.
#   ./restore.sh <academia-db-AAAA....sql.gz> <academia-media-AAAA....tar.gz>
# Confirme digitando RESTAURAR (ou exporte CONFIRM=RESTAURAR para uso em ensaio automatizado).
set -euo pipefail

dump="${1:?informe o arquivo .sql.gz}"
media="${2:?informe o arquivo de mídia .tar.gz}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/containers/docker-compose.prod.example.yml}"
: "${MYSQL_ROOT_PASSWORD:?defina MYSQL_ROOT_PASSWORD}"

[ -f "$dump" ] && [ -f "$media" ] || { echo "arquivo não encontrado" >&2; exit 1; }
gzip -t "$dump"; tar -tzf "$media" > /dev/null

confirm="${CONFIRM:-}"
if [ -z "$confirm" ]; then read -r -p "Isto APAGA o banco e a mídia atuais. Digite RESTAURAR: " confirm; fi
[ "$confirm" = "RESTAURAR" ] || { echo "cancelado"; exit 1; }

echo "→ parando a API"
docker compose -f "$COMPOSE_FILE" stop api web

echo "→ banco"
docker compose -f "$COMPOSE_FILE" exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql \
  mysql -uroot -e "DROP DATABASE IF EXISTS academia; CREATE DATABASE academia CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
gzip -dc "$dump" | docker compose -f "$COMPOSE_FILE" exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql mysql -uroot academia

echo "→ mídia"
docker compose -f "$COMPOSE_FILE" run --rm --no-deps -T --entrypoint sh api -c 'rm -rf /app/storage/* /app/storage/.[!.]* 2>/dev/null; true'
docker compose -f "$COMPOSE_FILE" run --rm --no-deps -T --entrypoint tar api -C /app/storage -xzf - < "$media"

echo "→ subindo"
docker compose -f "$COMPOSE_FILE" up -d api web
echo "ok"
