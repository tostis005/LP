import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const wallet=read("components/LoyaltyCard.tsx"),walletActions=read("components/WalletActions.tsx");
const shell=read("components/AppFrame.tsx"),mobile=read("components/AppBottomNav.tsx");
const business=read("components/BusinessWorkspace.tsx"),join=read("app/unirse/[slug]/page.tsx");
const access=read("app/acceder/page.tsx"),entry=read("app/mi-loyally/page.tsx");
const auth=read("app/api/local/auth/route.ts"),migration=read("db/migrations/190_signup_marketing_choice.sql");
const css=read("app/workspace.css");
assert.match(wallet,/loyalty-wallet-open/);
assert.doesNotMatch(wallet,/WalletActions cardId=|walletNotice|unavailableWallet/,"No Wallet actions or notices in the card UI");
assert.match(walletActions,/Añadir a Apple Wallet/);
assert.match(walletActions,/Añadir a Google Wallet/);
assert.match(walletActions,/lp-wallet-disabled/,"Unconfigured providers must not fake a pass");
assert.match(walletActions,/api\/local\/wallet/);
assert.match(wallet,/image\/png/);
assert.match(wallet,/downloadUrl/);
assert.doesNotMatch(wallet,/filledCount|STAMP_DRAWINGS|stampCount|\.svg";/,"Downloaded card must be a static QR identification card, no filled stamps");
assert.match(wallet,/qrUrl/);
const nav=shell.match(/business:\[[\s\S]*?\],\s*staff:/)?.[0]||"";
for(const path of ["/negocio","/negocio/tarjeta","/negocio/team","/negocio/marketing","/negocio/reports"]){
 assert.ok(nav.includes(path),"Missing own menu entry: "+path);
}
assert.doesNotMatch(nav,/Más opciones|\/negocio\/designer|\/negocio\/program|\/negocio\/facturacion|\/negocio\/locations|\/negocio\/settings/);
assert.match(shell,/business-account-menu/);
assert.match(shell,/\/negocio\/facturacion/);
assert.doesNotMatch(shell,/business-mobile-all-sections/,"Use the main mobile bottom bar without duplicating the menu above Tarjeta");
assert.match(mobile,/label:"Tarjeta",icon:"mi-tarjeta"/,"Business nav uses the same card icon as Inicio and sidebar");
assert.match(mobile,/\/negocio\/team/);
assert.doesNotMatch(mobile,/label:"Más"/);
assert.doesNotMatch(business,/business-settings-hub/);
assert.match(business,/teamView==="list"/);
assert.match(business,/Añadir empleado/);
assert.match(business,/team-invite-form/);
assert.match(business,/onSubmit=\{invite\}/);
assert.doesNotMatch(join,/showMarketingPrompt|No, solo mi tarjeta|Sí, recibir ofertas/,"No repeated consent nudge after enrollment");
assert.match(join,/router.replace\("\/app"/,"Join goes directly to the saved card");
assert.match(access,/platform_marketing_opt_in:marketingOptIn/);
assert.match(entry,/platform_marketing_opt_in:marketingOptIn/);
assert.match(auth,/platformMarketingOptIn=input.platform_marketing_opt_in===true/);
assert.match(migration,/OLD.email_confirmed_at IS NULL/);
assert.match(migration,/platform_marketing_opt_in'='true'/);
assert.match(migration,/DO NOTHING/,"Existing preferences must never be overwritten");
assert.match(css,/\.workspace-content\{width:100%;max-width:none/);
assert.match(css,/\.campaign-page-final,\.campaign-editor-full/);
assert.match(css,/\.directory-results-grid>\.directory-card-premium/);
console.log("OK: Wallet UI hidden, QR PNG retained, menu sections, full width, employee workflow and voluntary consent.");

for(const screen of [access,entry]){
 assert.match(screen,/Quiero recibir promociones y regalos/);
 assert.doesNotMatch(screen,/lp-signup-consent-details/,"No expandable consent text");
 assert.doesNotMatch(screen,/checked=\{marketingOptIn\}[^>]*\brequired\b/,"Marketing stays optional");
 assert.match(screen,/Tú decides qué quieres recibir/);
 assert.match(screen,/birth_date:birthDate,gender/);
 assert.match(screen,/type="date" required/);
 assert.match(screen,/<InternationalPhoneInput[^>]*\brequired\b/);
 assert.match(screen,/Prefiero no indicarlo/);
}
assert.match(auth,/birthDate:|birth_date:birthDate/);
assert.match(read("lib/supabase.ts"),/birth_date:data.options\?\.data\?\.birth_date/);
assert.match(read("db/migrations/999_zzzzzzzzzzzzzzzzzz_signup_profile_details.sql"),/UPDATE public.profiles/);
assert.match(join,/p_opted_in:true/);
assert.match(join,/Puedes desactivarlos en Ajustes/);

assert.match(join,/lp_pending_join/,"Preserve the explicit join action through login");
assert.match(access,/return_to:safeJoinTarget\(loginTarget\)/,"Preserve the business in verification links");
assert.match(read("lib/server/auth.ts"),/safeJoinTarget\(returnTo\)/);
assert.match(read("app/api/local/auth/verify/route.ts"),/safeJoinTarget\(request.nextUrl.searchParams.get\("next"\)\)/);

const phoneInput=read("components/InternationalPhoneInput.tsx");
assert.match(phoneInput,/MX:52/,"Mexico is available");
assert.match(phoneInput,/find\(c=>c.iso==="MX"\)/,"Mexico is the default");
assert.match(phoneInput,/autoComplete="tel-national"/,"Only national digits are entered");
assert.match(phoneInput,/onChange\(digits\?"\+"\+next.dial\+digits:""\)/,"Store the complete international number");
assert.match(read("app/app/perfil/page.tsx"),/<InternationalPhoneInput/);

assert.doesNotMatch(phoneInput,/international-phone-chevron|<select/,"No native dropdown arrow");
assert.match(phoneInput,/type="search"/,"Searchable country picker");
assert.match(phoneInput,/normalize\("NFD"\)/,"Search ignores accents");
assert.match(phoneInput,/c\.name,c\.otherName,c\.iso,"\+"\+c\.dial,c\.dial/,"Search country in either language or by prefix");
assert.match(phoneInput,/modal\.showModal\(\)/,"Accessible native dialog");
