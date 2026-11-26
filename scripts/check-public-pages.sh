#!/usr/bin/env bash
# Verify actual public HTML, not text embedded in Next.js flight scripts.
set -euo pipefail
base="${1:?Base URL required}"
base="${base%/}"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
page() {
 local path="$1" file="$2" status
 status="$(curl -sS --max-time 15 -H 'Cache-Control: no-cache' -o "$dir/$file" -w '%{http_code}' "$base$path")"
 if [[ "$status" != 200 ]]; then echo "PUBLIC_FAIL $path HTTP=$status"; return 1; fi
}
page / customer
grep -Fq '<main class="customer-public" data-public-landing="customer">' "$dir/customer" || { echo 'PUBLIC_FAIL / missing customer main'; exit 1; }
grep -Fq '<h1>Tus lugares favoritos.' "$dir/customer" || { echo 'PUBLIC_FAIL / missing rendered heading'; exit 1; }
grep -Fq 'href="/para-negocios"' "$dir/customer" || { echo 'PUBLIC_FAIL / missing business link'; exit 1; }
grep -Fq 'href="/entrar"' "$dir/customer" || { echo 'PUBLIC_FAIL / missing login link'; exit 1; }
page '/para-negocios?lang=es' business_es
grep -Fq 'Más clientes. Más visitas.' "$dir/business_es" || { echo 'PUBLIC_FAIL business ES'; exit 1; }
page '/para-negocios?lang=en' business_en
grep -Fq 'More customers. More visits.' "$dir/business_en" || { echo 'PUBLIC_FAIL business EN'; exit 1; }
page /help help
grep -Fq '¿En qué podemos ayudarte?' "$dir/help" || { echo 'PUBLIC_FAIL help'; exit 1; }
page '/help?lang=en' help_en
grep -Fq 'How can we help?' "$dir/help_en" || { echo 'PUBLIC_FAIL help EN'; exit 1; }
page /manifest.webmanifest manifest
grep -Eq '"start_url"[[:space:]]*:[[:space:]]*"/entrar"' "$dir/manifest" || { echo 'PUBLIC_FAIL app start URL'; exit 1; }
echo "PUBLIC_OK $base: customer landing, business ES/EN, help ES/EN and app startup"
