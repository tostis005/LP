import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const cssFiles=[
 "app/globals.css","app/workspace.css","app/brand-wine.css",
 "app/landing.css","app/mi-loyally/mi-loyally.css"
];
function greenish(hex){
 const [r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i+1,i+3),16)/255);
 const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,l=(mx+mn)/2;
 if(d===0)return false;
 const saturation=d/(1-Math.abs(2*l-1));
 let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;
 h=((h*60)%360+360)%360;
 return (h>=65&&h<=212&&saturation>.06)||(g>r+.01&&g>b+.01&&saturation>.03);
}
for(const path of cssFiles){
 const css=read(path);
 const matches=[...css.matchAll(/#[a-f\d]{6}(?:[a-f\d]{2})?(?![a-f\d])/ig)];
 const green=matches.map(m=>m[0].slice(0,7).toLowerCase()).filter(c=>greenish(c));
 const expected=path==="app/globals.css"?["#34a853"]:[];
 assert.deepEqual([...new Set(green)].sort(),expected, "Legacy green CSS in "+path);
}
const shell=read("app/workspace.css");
const base=read("app/globals.css");
const secondary=read("app/brand-wine.css");
const designer=read("components/BusinessWorkspace.tsx");
const demo=read("lib/demo-local.ts");
const clientCard=read("components/StampCard.tsx");
const login=read("app/acceder/page.tsx");
const tableDefault=read("db/migrations/130_brand_defaults.sql");
assert.match(base,/--brand-wine:var\(--color-brand\)/,"Global brand colors must be centralized");
assert.match(shell,/\.auth-story\{background:var\(--color-brand-900\)/,"Login must use the dark wine background");
assert.match(shell,/\.workspace\{min-height:100vh;background:var\(--color-bg\)/,"Workspace must use off-white");
assert.match(shell,/\.side-link\.active\{background:var\(--color-brand-100\);color:var\(--color-brand\)/,"Side navigation must be wine");
assert.match(shell,/\.mobile-bottom-link\.active\{color:var\(--color-brand\);background:var\(--color-brand-100\)/,"Mobile navigation must be wine");
assert.match(shell,/\.scanner-placeholder\{[^}]+background:var\(--color-bg\)/,"Staff scanner must not use sage");
assert.match(shell,/\.data-table th\{[^}]+background:var\(--color-bg\)/,"Tables must use pink-tinted header");
assert.match(secondary,/\.button-dark,\.loi-button-main\{background:var\(--color-brand\)/,"Buttons must use wine");
assert.match(designer,/const COLOR_PRESETS=\["#571c32"/,"Business designer starts with wine");
assert.match(designer,/const STAMP_COLOR_PRESETS=\["#571c32"/,"Stamp palette starts with wine");
assert.match(designer,/accent_color:biz\.accent_color/,"Business settings keep their customized card colors");
assert.match(clientCard,/backgroundColor:color/,"Customer cards keep the business color");
assert.match(demo,/loyally_role_sample_tijuana_v6/,"Demo data must refresh to new palette");
assert.match(demo,/slug:"cafe-noma",category:"Cafetería",color:"#571c32"/);
assert.match(login,/name="Tu cafetería" color="#5E1A2B"/,"The login example uses a generic business name");
assert.match(tableDefault,/ALTER COLUMN accent_color SET DEFAULT '#571c32'/);
assert.match(tableDefault,/ALTER COLUMN stamp_color SET DEFAULT '#571c32'/);
function luminance(hex){
 const rgb=[0,2,4].map(i=>parseInt(hex.slice(i+1,i+3),16)/255)
  .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
const contrast=(1.05/(luminance("#845268")+.05));
assert.ok(contrast>=4.5,"Small secondary text must contrast with light backgrounds");
console.log("KREYVI theme: consistent wine shell, accessible secondary color, and independent merchant colors.");
