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
const icons=load("../../lib/stamp-drawings.ts");
assert.equal(icons.STAMP_OPTIONS.length,23);
for(const option of icons.STAMP_OPTIONS){
 assert.ok(icons.STAMP_DRAWINGS[option.id],option.id+" has no drawing");
 const svg=icons.stampMarkup(option.id,28);
 assert.match(svg,/width="28" height="28" viewBox="0 0 64 64"/);
 assert.match(svg,/stroke-width="3"/);
 assert.match(svg,/fill="none"/);
 assert.doesNotMatch(icons.STAMP_DRAWINGS[option.id],/fill="currentColor"/);
}
const cats=load("../../lib/business-categories.ts",{"@/lib/stamp-drawings":icons});
for(const [category,kind] of [["Cafetería","coffee"],["Barbería","beard"],["Peluquería","hair"],["Panadería","bread"],["Taquería","taco"],["Heladería y postres","icecream"],["Gimnasio","gym"],["Librería","book"]]){
 assert.equal(cats.categoryStampKind(category),kind,category+" should have its product icon");
}
assert.equal(cats.categoryStampKind("no identificada"),"star");
assert.ok(!/M19 25c0-11 5-18 13-18/.test(icons.STAMP_DRAWINGS.beard),"Old face silhouette removed");
assert.ok(!/M21 33v9/.test(icons.STAMP_DRAWINGS.hair),"Old face silhouette removed");
const presentation=load("../../lib/program-presentation.ts");
assert.equal(presentation.programPromise({type:"stamps",reward_cost:8,reward_label:"Un café gratis"}),"Cada 8 sellos, Un café gratis");
assert.equal(presentation.programPromise({type:"points",reward_cost:100,reward_label:"Un descuento"}),"Canjea 100 puntos por Un descuento");
assert.match(presentation.programPromise({type:"cashback",cashback_bps:500}),/5 %/);
assert.doesNotMatch(presentation.programPromise({type:"stamps",reward_label:"Café gratis"}),/8/);
const map=readFileSync(new URL("../../components/DirectoryMap.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../../app/workspace.css",import.meta.url),"utf8");
assert.match(map,/stampMarkup\(categoryStampKind\(category\)/);
assert.match(map,/iconAnchor:\[23,52\]/);
const outer=css.match(/\.loyally-map-marker\{([^}]*)\}/)?.[1]||"";
assert.ok(outer&&!/transform\s*:/.test(outer),"Map marker must not override Leaflet positioning");
assert.match(css,/\.loyally-map-symbol\{[^}]*place-items:center/);
assert.match(css,/\.workspace-business \.mobile-bottom-nav\{display:none/);
const join=readFileSync(new URL("../../app/unirse/[slug]/page.tsx",import.meta.url),"utf8");
assert.match(join,/\[marketing,setMarketing\]=useState\(false\)/);
assert.match(join,/p_opted_in:true/);
console.log("OK: 23 shared outline icons, category pins, reward rules, mobile business menu and optional marketing.");
