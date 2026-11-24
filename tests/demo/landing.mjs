import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";

const file=readFileSync(new URL("../../lib/landing-copy.ts",import.meta.url),"utf8");
const js=ts.transpileModule(file,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};
runInNewContext(js,{module,exports:module.exports});
const {LANDING_COPY}=module.exports;
const es=LANDING_COPY.es,en=LANDING_COPY.en;
function assertSameKeys(left,right,name="root"){
 if(typeof left==="string"){
  assert.equal(typeof right,"string","Wrong type in "+name);
  assert.ok(left.trim()&&right.trim(),"Empty translated copy: "+name);
  return;
 }
 if(Array.isArray(left)){
  assert.ok(Array.isArray(right),"Expected array in "+name);
  assert.equal(left.length,right.length,"Translated item counts differ in "+name);
  left.forEach((item,i)=>assertSameKeys(item,right[i],name+"["+i+"]"));
  return;
 }
 assert.deepEqual(Object.keys(left).sort(),Object.keys(right).sort(),"Translated keys differ in "+name);
 for(const key of Object.keys(left))assertSameKeys(left[key],right[key],name+"."+key);
}
assertSameKeys(es,en);
assert.equal(es.hero.title,"Tarjetas de fidelización");
assert.equal(en.hero.title,"Digital loyalty cards");
assert.match(es.hero.description,/sellos, puntos o cashback/);
assert.match(en.hero.description,/stamp, points or cashback/);
for(const lang of [es,en]){
 const all=JSON.stringify(lang);
 assert.doesNotMatch(all,/SVG|cuatro perfiles|four profiles|tablet|tableta/i);
}
const iconSource=readFileSync(new URL("../../lib/stamp-drawings.ts",import.meta.url),"utf8");
assert.match(iconSource,/fill-rule="evenodd"/);
assert.match(iconSource,/fill="currentColor"/);
assert.match(iconSource,/beard:/);
assert.match(iconSource,/hair:/);
assert.match(iconSource,/bread:/);
assert.equal((iconSource.match(/\{id:"/g)||[]).length,25,"All 25 approved business icons remain available");
const brand=readFileSync(new URL("../../components/Brand.tsx",import.meta.url),"utf8");
assert.doesNotMatch(brand,/<span>\.<\/span>/);

const landingCss=readFileSync(new URL("../../app/landing.css",import.meta.url),"utf8");
const landingUi=readFileSync(new URL("../../components/LandingHome.tsx",import.meta.url),"utf8");
assert.match(landingCss,/--loi-dark:var\(--color-brand-900\)/,"The landing uses the wine-and-black brand tokens");
assert.match(landingCss,/\.loi-site \.loi-hero\{background:radial-gradient/,"The hero gradient uses the new palette");
assert.match(landingCss,/\.loi-site \.loi-final-card\{background:linear-gradient\(120deg,var\(--color-brand\)/);
assert.match(landingCss,/\.loi-public-header\{background:color-mix/);
assert.doesNotMatch(landingCss,/#214936|#2d6449|#1e4031|#23503b/i,"Old green brand palette still visible");
assert.match(landingUi,/name="Tu cafetería" color="#5E1A2B"/,"The mock customer card also uses the new palette");


// La home vende una experiencia para personas, no instrucciones técnicas.
const headerUi=readFileSync(new URL("../../components/PublicHeader.tsx",import.meta.url),"utf8");
const installUi=readFileSync(new URL("../../components/InstallGuide.tsx",import.meta.url),"utf8");
const appEntry=readFileSync(new URL("../../app/mi-loyally/page.tsx",import.meta.url),"utf8");
const manifest=readFileSync(new URL("../../app/manifest.ts",import.meta.url),"utf8");
const rootLayout=readFileSync(new URL("../../app/layout.tsx",import.meta.url),"utf8");

assert.match(landingUi,/Kreyvi en mi móvil/,"Consumer-friendly action in the landing");
assert.match(landingUi,/<InstallGuide lang=\{lang\}\/>/,"The install section stays on the landing");
assert.match(headerUi,/"La app"/,"The top navigation links to the app");
assert.match(installUi,/Tus próximos premios/,"The install section is customer-focused");
assert.match(installUi,/beforeinstallprompt/,"Native browser install prompts still work");
assert.match(installUi,/mi-loyally\?instalar=1/,"Installation leads to customer app entry");
assert.match(installUi,/QRCodeSVG/,"QR code opens the customer-first app");
for(const copy of [/"APK"/,/sin App Store/i,/sin Google Play/i,/sin coste/i,/PWA/i,/No APK/i,/gratis/i,/una aplicación web/i]){
 assert.doesNotMatch(installUi,copy,"Technical/commercial language must not appear in consumer installation copy");
}
assert.match(appEntry,/display-mode: standalone/,"Installed app must detect standalone mode");
assert.match(appEntry,/Abrir como app web/,"iPhone must enable the app launch mode");
assert.match(appEntry,/router\.replace\("\/app"\)/,"Returning customers must reach their cards");
assert.match(appEntry,/Añadir a mi móvil/,"Customers can install from app entry");
assert.match(manifest,/start_url:"\/mi-loyally"/,"The installed icon opens the customer-first experience");
assert.match(manifest,/display:"standalone"/,"The app has a standalone window");
assert.doesNotMatch(rootLayout,/<InstallLoyally\/>/,"Remove the old floating install widget");

assert.match(landingCss,/@media\(max-width:650px\)\{\s*\.loi-site \.loi-feature-grid\{grid-template-columns:minmax\(0,1fr\)/,"Mobile benefits use a compact single column");
assert.match(landingCss,/\.loi-site \.loi-feature\{display:grid;[^}]*min-height:0/,"Mobile feature height follows content");
assert.match(landingCss,/\.loi-site \.loi-showcase-caption\{position:relative/,"Preview caption has a separate row");
assert.match(landingUi,/stampColor="#5E1A2B"/,"Coffee stamps use the wine palette");
assert.match(landingCss,/\.loi-site \.loi-install-app-stamps span\.filled\{background:var\(--color-bg\);border-color:var\(--color-bg\);color:var\(--color-brand\)/,"Install preview coffee stamps are high contrast");
const brandText=readFileSync(new URL("../../components/BrandText.tsx",import.meta.url),"utf8");
assert.match(brandText,/className="loi-brand-text"/,"Brand copy has its own inline text wrapper");
assert.doesNotMatch(landingCss,/\.loi-audience-strip\s+span(?:[:\s{])/,"Category styles must never apply to spans inside body copy");
assert.match(landingCss,/\.loi-site \.loi-brand-text\{display:inline;white-space:normal;font:inherit/,"Sentences wrap and inherit paragraph typography");
assert.match(landingCss,/\.loi-site \.loi-brand-word\{display:inline-block;white-space:nowrap/,"Kreyvi stays on a single line");
assert.match(landingCss,/\.loi-site \.loi-brand-word>span\{display:inline;white-space:nowrap/,"Gold letters stay inline");
assert.doesNotMatch(landingCss,/\.loi-feature:nth-child\(n\) \.loi-feature-icon/,"Desktop icon width must not override mobile grid tracks");
assert.match(landingCss,/\.loi-site \.loi-feature\{display:grid;grid-template-columns:44px minmax\(0,1fr\);grid-template-rows:auto auto;column-gap:20px/,"Leave a full 20px between icon background and text");
assert.match(landingCss,/\.loi-site \.loi-feature \.loi-feature-icon\{grid-column:1;grid-row:1 \/ 3;width:44px;height:44px/,"Mobile icon fits its 44px grid column");
console.log("Commercial landing: ES/EN copy parity, filled business icon collection and KREYVI mark verified.");
