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
assert.match(deck,/onPointerMove=\{pointerMove\}/,"The wheel follows the finger throughout the gesture");assert.match(deck,/wheelDestination\(pos.current,velocity\)/,"Release retains momentum");assert.match(deck,/requestAnimationFrame/);assert.match(deckCss,/perspective:1050px/);assert.match(deckCss,/border:1px solid rgba\(255,255,255,.30\)/);
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

const wheelCode=ts.transpileModule(read("lib/customer-wheel.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const wheelModule={exports:{}};runInNewContext(wheelCode,{module:wheelModule,exports:wheelModule.exports});
const {wheelSlots,wheelTransform,wheelDestination,wrapIndex}=wheelModule.exports;
assert.equal(wrapIndex(-1,5),4);assert.equal(wrapIndex(5,5),0);
for(const n of [1,2,3,7,163])for(const p of [-8.7,-.5,0,.4,2.7,n+.2]){
 const slots=wheelSlots(p,n);assert.equal(new Set(slots.map(x=>x.index)).size,slots.length);
 assert.ok(slots.length<=7);assert.ok(slots.every(x=>x.index>=0&&x.index<n));
 const active=slots.find(x=>x.index===wrapIndex(Math.round(p),n));assert.ok(active);
}
assert.ok(wheelTransform(.2).y<wheelTransform(.8).y);assert.ok(wheelTransform(1).z<0);assert.ok(wheelTransform(1).scale<wheelTransform(0).scale);
assert.ok(wheelDestination(1.3,.018)>=5,"A fast gesture moves several cards");
assert.ok(wheelDestination(1.3,-.018)<0,"Momentum also works in reverse");
assert.match(deckCss,/customer-wallet-lower-label/,"Lower cards keep a visible merchant label");
console.log("Circular wheel: continuous geometry, depth, inertial travel, stable unique cards and wraparound.");

assert.match(deck,/capture\.setPointerCapture\(e\.pointerId\)/);
assert.match(deck,/d\.capture=e\.currentTarget/);
assert.match(deck,/onDragStart=\{e=>e\.preventDefault\(\)\}/);
assert.match(deck,/onClickCapture=/);
assert.match(deckCss,/\.customer-wallet-tab \*\{pointer-events:none/);
const designsSql=read("db/migrations/999_zzzzzzzzzzzzzzzz_showcase_card_designs.sql");
assert.match(designsSql,/NULLIF\(btrim\(b\.card_background\),''\) IS NULL/);
assert.doesNotMatch(designsSql,/'interno-cafe-noma'/);
for(const slug of ["brunch-club","barba-norte","studio-verde","taco-lumbre","pan-mar","dulce-frontera","punto-fit","lavanda-spa","marea-pets"]){
 assert.ok(designsSql.includes("'interno-"+slug+"'"));
 assert.match(read("public/brand/card-designs/showcase-"+slug+".svg"),/<svg.*viewBox="0 0 860 540"/);
}

const vividSql=read("db/migrations/999_zzzzzzzzzzzzzzzzzz_vivid_showcase_card_designs.sql");
assert.match(vividSql,/CREATE OR REPLACE FUNCTION public\.apply_internal_showcase_card_designs/);
assert.match(vividSql,/b.slug='interno-'\|\|d.slug AND b.name=d.name/);
assert.match(vividSql,/b.card_background='\/brand\/card-designs\/showcase-'\|\|d.slug\|\|'\.svg'/);
assert.doesNotMatch(vividSql,/'cafe-noma'/);
for(const slug of ["brunch-club","barba-norte","studio-verde","taco-lumbre","pan-mar","dulce-frontera","punto-fit","lavanda-spa","marea-pets"]){
 assert.ok(vividSql.includes("'"+slug+"'"));
 assert.match(read("public/brand/card-designs/gallery-vivid-"+slug+".svg"),/<svg.*viewBox="0 0 860 540"/);
}
assert.match(read("components/StampCard.tsx"),/gallery-\(food\|vivid\)-/);
assert.match(read("components/CustomerCardDeck.tsx"),/gallery-\(food\|vivid\)-/);

// Compact home keeps one count, with reward promotion below the cards.
assert.match(home,/customer-home-compact/);
assert.doesNotMatch(home,/TUS RECOMPENSAS|Desliza para girar/);
assert.ok(home.indexOf("<CustomerCardDeck")<home.indexOf('className="customer-spotlight"'));
assert.match(deckCss,/height:clamp\(470px/);
// Project the top and bottom edges through the CSS perspective for the smallest mobile stage.
for(let offset=-3.5;offset<=3.5;offset+=.025){
 const g=wheelTransform(offset);if(g.opacity<=0)continue;
 const radians=g.rotate*Math.PI/180;
 for(const edge of [-102.5,102.5]){
  const y=g.y+edge*g.scale*Math.cos(radians),z=g.z+edge*g.scale*Math.sin(radians);
  const projected=y*1050/(1050-z);
  assert.ok(Math.abs(projected)<235-12,"Visible wheel card stays within the mobile stage: "+offset);
 }
}
console.log("OK: compact heading and unclipped projected wheel on mobile.");
