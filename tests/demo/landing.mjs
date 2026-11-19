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
assert.match(es.hero.title,/Haz que cada visita/);
assert.match(en.hero.title,/Turn every visit into/);
for(const lang of [es,en]){
 const all=JSON.stringify(lang);
 assert.doesNotMatch(all,/SVG|cuatro perfiles|four profiles|tablet|tableta/i);
}
const iconSource=readFileSync(new URL("../../lib/stamp-drawings.ts",import.meta.url),"utf8");
assert.match(iconSource,/stroke-width="3"/);
assert.doesNotMatch(iconSource,/fill="currentColor"/);
assert.match(iconSource,/beard:/);
assert.match(iconSource,/hair:/);
assert.match(iconSource,/bread:/);
assert.equal((iconSource.match(/\{id:"/g)||[]).length,24,"All 24 stamps remain available");
const brand=readFileSync(new URL("../../components/Brand.tsx",import.meta.url),"utf8");
assert.doesNotMatch(brand,/<span>\.<\/span>/);

const landingCss=readFileSync(new URL("../../app/landing.css",import.meta.url),"utf8");
const landingUi=readFileSync(new URL("../../components/LandingHome.tsx",import.meta.url),"utf8");
assert.match(landingCss,/--loi-dark:#27131e/,"The landing uses the wine-and-black brand tokens");
assert.match(landingCss,/\.loi-site \.loi-hero\{background:radial-gradient/,"The hero gradient uses the new palette");
assert.match(landingCss,/\.loi-site \.loi-final-card\{background:linear-gradient\(120deg,#571c32/);
assert.match(landingCss,/\.loi-public-header\{background:rgba\(252,248,250/);
assert.doesNotMatch(landingCss,/#214936|#2d6449|#1e4031|#23503b/i,"Old green brand palette still visible");
assert.match(landingUi,/name="Café Noma" color="#571c32"/,"The mock customer card also uses the new palette");


// El enlace de instalación debe estar siempre en la home, independientemente del navegador.
const headerUi=readFileSync(new URL("../../components/PublicHeader.tsx",import.meta.url),"utf8");
const installUi=readFileSync(new URL("../../components/InstallGuide.tsx",import.meta.url),"utf8");
assert.match(landingUi,/Descargar la app/,"Visible install CTA must exist in the hero");
assert.match(landingUi,/<InstallGuide lang=\{lang\}\/>/,"Install guide must appear on the homepage");
assert.match(headerUi,/Instalar app/,"Header must link to PWA installation");
assert.match(installUi,/beforeinstallprompt/,"Direct install prompt should be supported");
assert.match(installUi,/Añadir a pantalla de inicio/,"iOS manual installation instructions required");
assert.match(installUi,/Instalar aplicación/,"Android manual installation instructions required");
assert.match(installUi,/QRCodeSVG/,"Desktop QR scan flow required");

console.log("Commercial landing: ES/EN copy parity, 24-icon collection and logo verified.");
