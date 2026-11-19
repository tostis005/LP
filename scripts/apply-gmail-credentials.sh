#!/usr/bin/env bash
set -euo pipefail
cd /opt/lp
test -f .env.production || { echo "ERROR: falta /opt/lp/.env.production"; exit 1; }
test -f scripts/configure-gmail-smtp.mjs || { echo "ERROR: despliega primero la última versión de Loyally"; exit 1; }

DOCKER=(docker)
COMPOSE=(docker compose)
if ! docker info >/dev/null 2>&1; then
  sudo -n docker info >/dev/null
  DOCKER=(sudo -n docker)
  COMPOSE=(sudo -n docker compose)
fi

# STDIN contiene dos líneas, usuario y contraseña de aplicación.
# No se escriben en logs, argumentos ni archivos temporales.
"${DOCKER[@]}" run --rm -i --network none \
  --mount type=bind,source=/opt/lp/.env.production,target=/loyally/.env.production \
  --mount type=bind,source=/opt/lp/scripts/configure-gmail-smtp.mjs,target=/configure-gmail-smtp.mjs,readonly \
  node:22-bookworm-slim node /configure-gmail-smtp.mjs

"${COMPOSE[@]}" --env-file .env.production up -d --no-deps --force-recreate web
echo "Gmail SMTP guardado en Contabo; servicio web reiniciado."
