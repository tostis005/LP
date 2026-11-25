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

assert.match(landingCss,/\.loi-site \.loi-showcase-phone \.stamp-visual-card\.stamp-visual-rebalanced\{\s*display:block;position:relative;aspect-ratio:auto;height:auto;min-height:0!important/,"Preview does not inherit a fixed card aspect ratio");
assert.match(landingCss,/\.loi-site \.loi-showcase-phone \.stamp-visual-main\{[^}]*overflow:visible/,"No clipped card content");
assert.match(landingCss,/\.loi-site \.loi-showcase-phone \.stamp-grid\{\s*grid-template-columns:repeat\(var\(--stamp-columns\),minmax\(0,1fr\)\)/,"Stamps span the full preview width");
assert.match(landingCss,/\.loi-site \.loi-showcase-phone \.stamp-visual-footer \.stamp-reward-name\{[^}]*white-space:normal;overflow:visible/,"Reward text wraps and remains readable");
assert.match(landingCss,/\.loi-site \.loi-showcase-phone\{\s*display:flex;flex-direction:column;align-items:stretch;\s*width:min\(340px,100%\);max-width:100%;height:auto;min-height:0/,"Phone height follows its content");

const posterUi=readFileSync(new URL("../../components/CounterPoster.tsx",import.meta.url),"utf8");
const ownerUi=readFileSync(new URL("../../components/BusinessWorkspace.tsx",import.meta.url),"utf8");
assert.match(ownerUi,/workspaceHref\("\/negocio\/poster"\)/,"Poster is available in My business");
assert.match(posterUi,/width="60" height="60" viewBox="0 0 360 360"/,"Large QR for print");
assert.match(posterUi,/marginSize=\{4\}/,"QR quiet zone");
assert.doesNotMatch(posterUi,/business\.card_background|business\.stamp_image_url|program\.reward_label|business\.logo_url/,"Universal poster is independent of the business design");
assert.match(posterUi,/publicJoinUrl\(business.slug\)/);
const loadTs=(path)=>{const module={exports:{}};runInNewContext(ts.transpileModule(readFileSync(new URL("../../"+path,import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,URL,URLSearchParams,Blob,TextEncoder,Uint8Array});return module.exports};
const {POSTER_SIZES,posterPdf,PRINT_DPI}=loadTs("lib/counter-poster-export.ts");
assert.equal(PRINT_DPI,300);assert.equal(POSTER_SIZES.A6.width,105);assert.equal(POSTER_SIZES.A5.height,210);
for(const size of ["A5","A6"]){const paper=POSTER_SIZES[size],pdf=await posterPdf(new Uint8Array([255,216,255,217]),{width:Math.round(paper.width/25.4*300),height:Math.round(paper.height/25.4*300)},size).text();assert.match(pdf,/^%PDF-1.4/);assert.ok(pdf.includes("/MediaBox [0 0 "+(paper.width*72/25.4).toFixed(5)+" "+(paper.height*72/25.4).toFixed(5)+"]"));assert.match(pdf,/startxref\n\d+\n%%EOF/)}
const {publicJoinUrl,safeJoinTarget}=loadTs("lib/public-url.ts");
assert.equal(publicJoinUrl("cafe-noma"),"https://kreyvi.com/unirse/cafe-noma");
assert.equal(safeJoinTarget("/unirse/cafe-noma?alta=1"),"/unirse/cafe-noma?alta=1");
for(const value of ["https://evil.example","//evil.example","/unirse/../admin","/unirse/cafe?next=https://evil.example"])assert.equal(safeJoinTarget(value),null);

const {CARD_RATIO,posterAssetUrl}=loadTs("lib/counter-poster-export.ts");
assert.ok(Math.abs(CARD_RATIO-1.586)<.001);
assert.equal(posterAssetUrl("https://kreyvi.com/api/assets/business-assets/id/logo.webp?w=512",96),"/api/assets/business-assets/id/logo.webp?w=96");
const joinUi=readFileSync(new URL("../../app/unirse/[slug]/page.tsx",import.meta.url),"utf8");
assert.ok(joinUi.indexOf('className="join-action-panel"')<joinUi.indexOf('className="join-info-panel"'));
assert.match(joinUi,/logoImageUrl\(offer.logo_url,192\)/);

assert.match(posterUi,/QR para mostrador/);
assert.match(posterUi,/showTitle&&/);
assert.match(posterUi,/showSubtitle&&/);
assert.match(posterUi,/showFooter&&/);
assert.match(posterUi,/Escanea y/);
