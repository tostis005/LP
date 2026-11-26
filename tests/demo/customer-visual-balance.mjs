import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const code=ts.transpileModule(read("lib/customer-card-contrast.ts"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const module={exports:{}};
runInNewContext(code,{module,exports:module.exports});
const contrast=module.exports.readableCardText;
const luminosity=hex=>{
 const nums=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
 return .2126*nums[0]+.7152*nums[1]+.0722*nums[2];
};
const contrastRatio=(a,b)=>{
 const x=luminosity(a),y=luminosity(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};
for(const bg of ["#5E1A2B","#D9A23A","#F5EFE6","#16171B","#FF7A31","#92AD95","#E9E2D7"]){
 const text=contrast(bg,"#FFFFFF");
 assert.ok(contrastRatio(bg,text)>=4.5, `Text ${text} on ${bg} must reach WCAG AA normal text`);
}
assert.equal(contrast("#5E1A2B","#FFFFFF"),"#FFFFFF");
assert.equal(contrast("#D9A23A","#FFFFFF"),"#22201F");
assert.equal(contrast("#F5EFE6","#22201F"),"#22201F");
assert.equal(contrast("#5E1A2B","#333333",true),"#FFFFFF","Photos use a dark scrim and white text");
const css=read("app/customer-app.css");
assert.match(css,/equilibrio visual 2026/);
assert.match(css,/body:has\(\.workspace-customer\)\{background:var\(--color-bg\)\}/);
assert.match(css,/\.customer-map-stage \.leaflet-tile-pane\{\s*filter:saturate/);
assert.match(css,/\.loyalty-global-bottom-nav\.loyalty-nav-customer\{\s*border:1px solid #e2d5cb;background:#fffdf9f7/);
assert.match(css,/\.workspace-customer \.qr-modal\{\s*background:var\(--color-bg\)/);
assert.match(css,/\.workspace-customer \.customer-profile-only/);
const home=read("app/app/page.tsx"),map=read("app/app/descubrir/page.tsx");
const deck=read("components/CustomerCardDeck.tsx"),deckCss=read("app/customer-deck.css");
assert.match(home,/<CustomerCardDeck/,"Keep the customer card deck");
assert.match(deck,/onPointerMove=\{pointerMove\}/,"The wheel follows the finger throughout the gesture");assert.match(deck,/wheelDestination\(pos.current,velocity\)/,"Release retains momentum");assert.match(deck,/requestAnimationFrame/);assert.match(deckCss,/perspective:1050px/);assert.match(deckCss,/border:2px solid rgba\(255,255,255,.9\)/);
assert.match(deck,/modalOnly autoOpen/,"Open the existing QR and reward details");
assert.match(deckCss,/\.customer-wallet-tab\{/);assert.match(deckCss,/\.customer-wallet-logo\{/);
assert.match(map,/className="customer-map-stage"/,"Keep integrated discovery map");
assert.doesNotMatch(map,/Wallet|wallets/,"Keep wallet issuance hidden");
const nav=read("components/AppBottomNav.tsx");
for(const name of ["Tarjetas","Descubrir","Avisos","Ajustes","Mi perfil"])assert.match(nav,new RegExp('label:"'+name+'"'));
assert.doesNotMatch(nav,/label:"Mi QR"/);
console.log("OK: branded light surfaces, readable text, map, cards, QR and unchanged navigation.");

assert.match(css,/\.workspace-customer:has\(\.customer-first-layout\)\{[\s\S]*?var\(--color-surface\)/,"My cards uses its own light background");
assert.match(css,/\.customer-first-layout \.customer-spotlight\{[\s\S]*?var\(--color-surface\)/,"Reward highlight has a light surface");
assert.match(css,/\.customer-first-layout \.customer-spotlight h3\{color:var\(--color-brand-900\)\}/,"Dark readable reward heading");
assert.match(css,/\.customer-first-layout \.customer-spotlight-foot a\{background:var\(--color-brand\);color:var\(--color-on-brand\)/,"High contrast reward action");

const roleCss=read("app/role-app.css");
assert.match(roleCss,/\.workspace-customer \.customer-first-layout \.card-grid \.merchant-card-button\{\s*background:transparent;box-shadow:none;/,"Transparent carousel wrappers");
assert.match(roleCss,/\.workspace-customer \.customer-first-layout \.card-grid\{\s*box-sizing:border-box;width:calc\(100% \+ 24px\);margin-inline:-12px;\s*padding:12px 14px 36px;scroll-padding-inline:14px;/,"Space around the scrolling cards preserves individual shadows");
assert.match(roleCss,/\.workspace-customer \.customer-first-layout \.card-grid \.stamp-visual-card\{\s*box-shadow:0 4px 7px -3px #3d0f1b55,0 15px 22px -9px #3d0f1b66,inset 0 1px 0 #ffffff30,inset 0 0 0 1px #00000012;/,"Visible layered local elevation instead of a diffuse shadow band");
