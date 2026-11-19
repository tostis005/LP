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
 assert.deepEqual(Object.keys(left).sort(),Object.keys(right).sort(),"Translated keys differ in "+name);
 for(const key of Object.keys(left)){
  const a=left[key],b=right[key];
  if(a&&b&&typeof a==="object"&&!Array.isArray(a))assertSameKeys(a,b,name+"."+key);
  else if(Array.isArray(a)){
   assert.equal(a.length,b.length,"Translated item counts differ in "+name+"."+key);
   a.forEach((item,i)=>assertSameKeys(item,b[i],name+"."+key+"["+i+"]"));
  }else{
   assert.equal(typeof a,"string");
   assert.equal(typeof b,"string");
   assert.ok(a.trim()&&b.trim(),"Empty translated copy: "+name+"."+key);
  }
 }
}
assertSameKeys(es,en);
assert.match(es.hero.title,/Haz que cada visita/);
assert.match(en.hero.title,/Turn every visit into/);
for(const lang of [es,en]){
 const all=JSON.stringify(lang);
 assert.doesNotMatch(all,/SVG|cuatro perfiles|four profiles|tablet|tableta/i);
}
const iconSource=readFileSync(new URL("../../components/StampMarks.tsx",import.meta.url),"utf8");
assert.match(iconSource,/strokeWidth:3\.2/);
assert.doesNotMatch(iconSource,/fill="currentColor"/);
assert.match(iconSource,/k==="beard"/);
assert.match(iconSource,/k==="hair"/);
assert.equal((iconSource.match(/\{id:"/g)||[]).length,22,"All 22 stamps remain available");
const brand=readFileSync(new URL("../../components/Brand.tsx",import.meta.url),"utf8");
assert.doesNotMatch(brand,/<span>\.<\/span>/);
console.log("Commercial landing: ES/EN copy parity, icon collection and logo verified.");
