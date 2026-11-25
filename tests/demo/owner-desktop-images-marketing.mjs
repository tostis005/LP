import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const owner=read("components/BusinessWorkspace.tsx");
const css=read("app/role-app.css");
const upload=read("app/api/local/assets/route.ts");
const serve=read("app/api/assets/[...path]/route.ts");
const stamp=read("components/StampCard.tsx");
const loyalty=read("components/LoyaltyCard.tsx");
const discovery=read("app/app/descubrir/page.tsx");
const marks=read("components/StampMarks.tsx");
const preview=read("app/negocio/vista-previa/page.tsx");

assert.match(css,/\.workspace-business \.workspace-section-body \.program-form\{[^}]*max-width:none/,"Funcionamiento y límites must fill its desktop container");
assert.match(css,/\.workspace-business \.program-form \.form-stack\{[^}]*max-width:none/,"All limits fields should extend into the available space");
const panels=read("components/OwnerDataPanels.tsx");
const navStart=owner.indexOf('owner-start-links owner-start-primary-links');
const heroStart=owner.indexOf('className="owner-start-hero"');
assert.ok(navStart>heroStart&&navStart<owner.indexOf('className="owner-start-card"'),"Business details follow the name and precede the card");
assert.match(css,/\.workspace-business \.owner-start-primary-links\{[^}]*grid-template-columns:repeat\(3/);
assert.match(owner,/title="Dirección y ubicación"/);
assert.match(css,/\.stamp-visual-rebalanced \.stamp-visual-pill\{[^}]*align-self:flex-end/,"Reward club badge aligns to right card padding");
assert.match(css,/\.stamp-visual-rebalanced \.stamp-visual-side\{[^}]*align-items:stretch/);

assert.match(owner,/slug==="interno-cafe-noma"&&c\.full_name\?\.includes\("· Demo"\)/,"Simulated marketing status is restricted to example customers");
assert.match(owner,/n%10<8/,"Most synthetic demo customers may appear opted-in in the mock directory");
assert.match(panels,/demo\?"Aceptado":"No"/);
assert.match(panels,/estados de marketing de los clientes de ejemplo son simulados y no permiten enviar campañas/);
assert.doesNotMatch(owner,/update\(\{opted_in:true/,"Mock display must never update real permissions");
assert.match(panels,/c\.marketing_ok\?<span className="table-pill">Aceptado/,"Real consent still takes precedence");

assert.match(upload,/isLogo=match\[2\]\.startsWith\("logo-"\)/);
assert.match(upload,/isStamp=match\[2\]\.startsWith\("sello-"\)/);
assert.match(upload,/\.webp\(\{quality:80,effort:4\}\)/);
assert.match(owner,/field==="logo_url"\?"logo-":"sello-"/);
assert.match(serve,/\[96,192,256,512,480,720,960,1200\]\.includes\(width\)/);
assert.match(serve,/\[96,192,256,512,480,960\]\.includes\(width\)\?"inside":"cover"/);
for(const src of [owner,stamp,discovery,marks])
 assert.match(src,/logoImageUrl|stampImageUrl/,"All small customer and merchant visual assets must load a responsive variant");
for(const src of [loyalty,preview,discovery])assert.match(src,/<MerchantCard /,"Customer and owner previews must use shared responsive assets");

const compiled=ts.transpileModule(read("lib/asset-images.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
runInNewContext(compiled,{module,exports:module.exports});
const {logoImageUrl,stampImageUrl}=module.exports;
const url="https://example.org/api/assets/business-assets/12345678-1234-1234-1234-123456789012/logo.png";
assert.equal(logoImageUrl(url,96),url+"?w=96");
assert.equal(logoImageUrl(url+"?download=1",192),url+"?download=1&w=192");
assert.equal(stampImageUrl(url,256),url+"?w=256");
assert.equal(logoImageUrl("https://cdn.example.org/logo.png",96),"https://cdn.example.org/logo.png");
assert.equal(logoImageUrl(null,96),undefined);
console.log("OK: full-width desktop rules, prominent owner shortcuts, aligned badge, legal mock consent and optimized logos.");
