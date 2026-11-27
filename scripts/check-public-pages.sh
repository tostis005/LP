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
page /inicio customer_alias
if grep -Fq 'Preparando tu espacio' "$dir/customer"; then echo 'PUBLIC_FAIL root serves login router'; exit 1; fi
grep -Fq '<h1>Tus lugares favoritos.' "$dir/customer_alias" || { echo 'PUBLIC_FAIL /inicio missing heading'; exit 1; }
grep -Fq '<main class="customer-public" data-public-landing="customer">' "$dir/customer" || { echo 'PUBLIC_FAIL / missing customer main'; exit 1; }
grep -Fq '<h1>Tus lugares favoritos.' "$dir/customer" || { echo 'PUBLIC_FAIL / missing rendered heading'; exit 1; }
grep -Fq 'href="/para-negocios"' "$dir/customer" || { echo 'PUBLIC_FAIL / missing business link'; exit 1; }
grep -Fq 'href="/entrar"' "$dir/customer" || { echo 'PUBLIC_FAIL / missing login link'; exit 1; }
page '/para-negocios?lang=es' business_es
grep -Fq 'Más clientes. Más visitas.' "$dir/business_es" || { echo 'PUBLIC_FAIL business ES'; exit 1; }
page '/para-negocios?lang=en' business_en
grep -Fq 'More customers. More visits.' "$dir/business_en" || { echo 'PUBLIC_FAIL business EN'; exit 1; }
grep -Fq 'More sales.' "$dir/business_en" || { echo 'PUBLIC_FAIL business EN accent'; exit 1; }
grep -Fq 'id="comunidad"' "$dir/business_en" || { echo 'PUBLIC_FAIL business community'; exit 1; }
grep -Fq 'id="panel-negocio"' "$dir/business_en" || { echo 'PUBLIC_FAIL business dashboard'; exit 1; }
if grep -Fq 'Más clientes. Más visitas.' "$dir/business_en"; then echo 'PUBLIC_FAIL Spanish text in English business landing'; exit 1; fi
page /help help
grep -Fq '¿En qué podemos ayudarte?' "$dir/help" || { echo 'PUBLIC_FAIL help'; exit 1; }
page '/help?lang=en' help_en
grep -Fq 'How can we help?' "$dir/help_en" || { echo 'PUBLIC_FAIL help EN'; exit 1; }
for help_file in help help_en; do
  grep -Fq 'public-header loi-public-header shared-public-header' "$dir/$help_file" || { echo 'PUBLIC_FAIL shared help header'; exit 1; }
  grep -Fq 'href="/help?lang=es"' "$dir/$help_file" || { echo 'PUBLIC_FAIL Spanish language link'; exit 1; }
  grep -Fq 'href="/help?lang=en"' "$dir/$help_file" || { echo 'PUBLIC_FAIL English language link'; exit 1; }
done
grep -Fq 'Contact Kreyvi support' "$dir/help_en" || { echo 'PUBLIC_FAIL English support form'; exit 1; }
grep -Fq 'Contacta con soporte' "$dir/help" || { echo 'PUBLIC_FAIL Spanish support form'; exit 1; }
page '/?lang=en' customer_en
grep -Fq '<h1>Your favorite places.' "$dir/customer_en" || { echo 'PUBLIC_FAIL English customer landing'; exit 1; }
for public_file in customer customer_en business_es business_en help help_en; do
 grep -Fq 'shared-public-header' "$dir/$public_file" || { echo "PUBLIC_FAIL header $public_file"; exit 1; }
 grep -Fq 'shared-public-footer' "$dir/$public_file" || { echo "PUBLIC_FAIL footer $public_file"; exit 1; }
done
page /brand/card-designs/coffee.svg coffee_art
page /brand/card-designs/icecream.svg icecream_art
page /manifest.webmanifest manifest
grep -Eq '"start_url"[[:space:]]*:[[:space:]]*"/entrar"' "$dir/manifest" || { echo 'PUBLIC_FAIL app start URL'; exit 1; }
echo "PUBLIC_OK $base: customer landing, business ES/EN, help ES/EN and app startup"
