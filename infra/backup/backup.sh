#!/usr/bin/env bash
# Backup diário do MySQL (dump consistente) e da mídia enviada, com retenção e verificação de integridade.
#
# Variáveis (padrões para o compose de produção de exemplo):
#   BACKUP_DIR        pasta de destino (padrão ./backups)          → copie/sincronize para FORA do servidor
#   COMPOSE_FILE      arquivo do compose (padrão docker-compose.prod.example.yml)
#   RETENTION_DAYS    quantos dias manter (padrão 14)
#   MYSQL_ROOT_PASSWORD  obrigatório
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/containers/docker-compose.prod.example.yml}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
: "${MYSQL_ROOT_PASSWORD:?defina MYSQL_ROOT_PASSWORD}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
umask 077

dump="$BACKUP_DIR/academia-db-$stamp.sql.gz"
media="$BACKUP_DIR/academia-media-$stamp.tar.gz"

echo "→ dump do banco"
docker compose -f "$COMPOSE_FILE" exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql \
  mysqldump -uroot --single-transaction --routines --triggers --set-gtid-purged=OFF academia | gzip -9 > "$dump"

echo "→ mídia"
docker compose -f "$COMPOSE_FILE" exec -T api tar -C /app/storage -czf - . > "$media"

echo "→ verificação"
gzip -t "$dump"
tar -tzf "$media" > /dev/null
[ "$(gzip -dc "$dump" | grep -c 'CREATE TABLE')" -gt 0 ] || { echo "dump sem tabelas: backup inválido" >&2; exit 1; }

sha256sum "$dump" "$media" > "$BACKUP_DIR/academia-$stamp.sha256" 2>/dev/null || shasum -a 256 "$dump" "$media" > "$BACKUP_DIR/academia-$stamp.sha256"

echo "→ retenção (${RETENTION_DAYS} dias)"
find "$BACKUP_DIR" -name 'academia-*' -type f -mtime +"$RETENTION_DAYS" -delete

echo "ok: $dump | $media"
