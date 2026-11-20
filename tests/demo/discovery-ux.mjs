import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";

function load(path,imports={}){
 const source=readFileSync(new URL(path,import.meta.url),"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};
 runInNewContext(js,{module,exports:module.exports,require:(id)=>{if(!(id in imports))throw Error("Unexpected import "+id);return imports[id]},Intl});
 return module.exports;
}
const filled=load("../../lib/kreyv-icon-paths.ts");
const icons=load("../../lib/stamp-drawings.ts",{"@/lib/kreyv-icon-paths":filled});
assert.equal(Object.keys(filled.KREYV_FILLED_PATHS).length,43,"The original gallery and four business-specific additions remain available");
assert.equal(icons.STAMP_OPTIONS.length,25,"Every approved business-category icon is selectable");
for(const option of icons.STAMP_OPTIONS){
 assert.ok(filled.KREYV_FILLED_PATHS[option.id],option.id+" has no approved filled path");
 const svg=icons.stampMarkup(option.id,28);
 assert.match(svg,/width="28" height="28" viewBox="[^"]+"/);
 assert.match(svg,/fill="currentColor"/);
 assert.match(svg,/fill-rule="evenodd"/);
 assert.doesNotMatch(svg,/stroke-width="3\.5"/);
}
assert.equal(icons.resolveStampIcon("coffee"),"cafeteria","Saved legacy stamps remain readable");
assert.equal(icons.resolveStampIcon("beard"),"barberia","Legacy beard silhouette is upgraded");
assert.equal(icons.resolveStampIcon("bread"),"panaderia","Existing bread stamps use the new baguette");
assert.equal(icons.resolveStampIcon("croissant"),"panaderia","Old croissant IDs remain compatible");
assert.match(icons.stampMarkup("bread",24),/width="24"/);
assert.match(icons.stampMarkup("beard",24),/width="24"/);

assert.equal(icons.resolveStampIcon("unknown"),"cafeteria","Unknown stamps have a safe fallback");
const cats=load("../../lib/business-categories.ts",{"@/lib/stamp-drawings":icons});
for(const [category,kind] of [["Cafetería","cafeteria"],["Restaurante","restaurante"],["Barbería","barberia"],["Peluquería","peluqueria"],["Panadería","panaderia"],["Taquería","taqueria"],["Heladería y postres","heladeria"],["Gimnasio","gimnasio"],["Librería","libreria"]]){
 assert.equal(cats.categoryStampKind(category),kind,category+" should have its product icon");
}
assert.equal(cats.categoryStampKind("no identificada"),"comercio");
assert.equal(cats.categoryStampKind("Floristería"),"floristeria");
assert.equal(icons.resolveStampIcon("flower"),"floristeria");
assert.notEqual(filled.KREYV_FILLED_PATHS.floristeria,filled.KREYV_FILLED_PATHS.spa);
assert.match(icons.STAMP_DRAWINGS.beard,/M32 26/,"Barber must be mustache and beard");
assert.ok(!/circle[^>]+cx="32" cy="34"/.test(icons.STAMP_DRAWINGS.beard),"Barber does not include a head");
assert.ok(!/M21 33v9/.test(icons.STAMP_DRAWINGS.hair),"Old face silhouette removed");
const presentation=load("../../lib/program-presentation.ts");
assert.equal(presentation.programPromise({type:"stamps",reward_cost:8,reward_label:"Un café gratis"}),"Cada 8 sellos, Un café gratis");
assert.equal(presentation.programPromise({type:"points",reward_cost:100,reward_label:"Un descuento"}),"Canjea 100 puntos por Un descuento");
assert.match(presentation.programPromise({type:"cashback",cashback_bps:500}),/5 %/);
assert.doesNotMatch(presentation.programPromise({type:"stamps",reward_label:"Café gratis"}),/8/);
const map=readFileSync(new URL("../../components/DirectoryMap.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../../app/workspace.css",import.meta.url),"utf8");
assert.match(map,/pinIcon\(Boolean\(l\.hasCard\)\)/,"Map icons depend on membership, not business category");
assert.match(map,/hasCard\?:boolean/);
assert.match(map,/hasCard\?'currentColor':'none'/,"Owned stars fill, unknown stars stay outlined");
assert.doesNotMatch(map,/stampMarkup|categoryStampKind|stampKind/,"Map must never show business-category stamp drawings");
const discover=readFileSync(new URL("../../app/app/descubrir/page.tsx",import.meta.url),"utf8");
assert.match(discover,/hasCard:Boolean\(myCards\[e\.business_id\]\)/,"Memberships drive markers per business");
assert.match(discover,/directory-map-legend/);
assert.match(map,/iconAnchor:\[23,52\]/);
const outer=css.match(/\.loyally-map-marker\{([^}]*)\}/)?.[1]||"";
assert.ok(outer&&!/transform\s*:/.test(outer),"Map marker must not override Leaflet positioning");
assert.match(css,/\.loyally-map-symbol\{[^}]*place-items:center/);
assert.match(css,/\.workspace-business \.mobile-bottom-nav\{display:none/);
const business=readFileSync(new URL("../../components/BusinessWorkspace.tsx",import.meta.url),"utf8");
const card=readFileSync(new URL("../../components/LoyaltyCard.tsx",import.meta.url),"utf8");
assert.match(business,/STAMP_COLOR_PRESETS/,"Owner can choose a stamp preset");
assert.match(business,/Cambiar color del sello/,"Owner has a custom color picker");
assert.match(business,/stamp_color:biz\.stamp_color/,"Chosen ink color is saved");
assert.match(business,/StampMark kind=\{option\.id\} size=\{30\} color=\{biz\.stamp_color/,"Gallery previews chosen color");
assert.match(card,/image\/png/,"Downloaded card is a PNG with QR");
assert.doesNotMatch(card,/filledCount|STAMP_DRAWINGS/,"Download must not freeze stamp progress");
assert.match(css,/\.stamp-color-palette\{/);

const join=readFileSync(new URL("../../app/unirse/[slug]/page.tsx",import.meta.url),"utf8");
assert.match(join,/\[marketing,setMarketing\]=useState\(false\)/);
assert.match(join,/join_program_with_notifications/,"A single card opt-in authorizes all named channels");
assert.match(join,/p_opted_in:accepted/,"The registered choice is respected");
console.log("OK: 24 shared outline icons, category pins, reward rules, mobile business menu and optional marketing.");
