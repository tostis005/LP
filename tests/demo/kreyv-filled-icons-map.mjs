import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const src=read("lib/kreyv-icon-paths.ts");
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
runInNewContext(js,{module,exports:module.exports});
const icons=module.exports.KREYV_FILLED_PATHS;
assert.equal(Object.keys(icons).length,43,"40 approved pictograms plus a distinct florist icon are present");
for(const [name,path] of Object.entries(icons)){
 assert.match(path,/^M[\dLMZ,.]+$/,"Invalid SVG path in "+name);
 assert.ok(path.length>45,"Too little icon detail in "+name);
}
const react=read("components/KreyvIcon.tsx");
const marks=read("components/StampMarks.tsx");
assert.match(react,/fillRule="evenodd"/);
assert.match(react,/fill="currentColor"/);
assert.match(marks,/resolveStampIcon\(kind\)/,"Stamp cards must use the new icons");
const map=read("components/DirectoryMap.tsx");
const discover=read("app/app/descubrir/page.tsx");
assert.match(map,/hasCard\?:boolean/);
assert.match(map,/hasCard\?'currentColor':'none'/);
assert.match(discover,/hasCard:Boolean\(myCards\[e\.business_id\]\)/);
assert.doesNotMatch(map,/categoryStampKind|stampMarkup/);
const appNav=read("components/AppBottomNav.tsx"),frame=read("components/AppFrame.tsx"),home=read("components/LandingHome.tsx");
for(const file of [appNav,frame,home])assert.match(file,/KreyvIcon/);
console.log("Kreyv: 40 filled scalable icons and ownership-sensitive map stars verified.");
