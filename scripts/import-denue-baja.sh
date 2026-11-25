#!/usr/bin/env bash
set -euo pipefail
# Run only on the production host using the existing Compose credentials.
compose=("$@" --env-file .env.production)
already="$("${compose[@]}" exec -T db sh -c 'psql -XAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "SELECT count(*) FROM public.crm_import_runs WHERE report->>'edition'='2025-05' AND report->>'stateCode'='02' AND report->>'scope'='02003' AND report->>'pilotFood'='true'")"
if [[ "$already" =~ ^[1-9][0-9]*$ ]]; then echo "DENUE Tecate food pilot 2025-05 already imported."; exit 0; fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
curl --fail --silent --show-error --location --retry 2 --connect-timeout 15 --max-time 180 \
 'https://www.inegi.org.mx/contenidos/masiva/denue/2025_05/denue_02_0525_csv.zip' -o "$work/denue.zip"
python3 - "$work" <<'PY'
import pathlib, sys, zipfile, shutil
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(root/'denue.zip') as z:
    matches=[i for i in z.infolist() if 'conjunto_de_datos' in pathlib.PurePosixPath(i.filename).parts and i.filename.lower().endswith('.csv')]
    if len(matches)!=1 or matches[0].file_size>300*1024*1024:
        raise ValueError('Unexpected archive structure or size')
    with z.open(matches[0]) as src, (root/'denue_02_0525.csv').open('wb') as dst:
        shutil.copyfileobj(src,dst)
PY
"${compose[@]}" run --rm -T --no-deps -v "$work:/denue:ro" migrate \
 node --experimental-strip-types scripts/import-denue.mjs 2025-05 02003 /denue/denue_02_0525.csv
