#!/usr/bin/env bash
# Ejecutar en VPS: bash /opt/lp/scripts/backup.sh
set -euo pipefail
cd /opt/lp
umask 077
OUT="${LP_BACKUP_DIR:-/var/backups/lp}"
mkdir -p "$OUT"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
SQL="$OUT/lp-$TS.sql.gz"
UPLOADS="$OUT/lp-uploads-$TS.tar.gz"
docker compose --env-file .env.production exec -T db \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$SQL"
docker run --rm -v lp_uploads:/data:ro -v "$OUT":/backup \
  alpine:3.21 tar czf "/backup/lp-uploads-$TS.tar.gz" -C /data .
test -s "$SQL"
test -s "$UPLOADS"
echo "Copias creadas: $SQL y $UPLOADS"
echo "IMPORTANTE: replicar fuera del VPS y ensayar restauración."
