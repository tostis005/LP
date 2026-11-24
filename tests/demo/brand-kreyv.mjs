import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const config=read("lib/brand.ts");
const tokens=read("app/brand-tokens.css");
const layout=read("app/layout.tsx");
const manifest=read("app/manifest.ts");
const logo=read("components/Brand.tsx");
const theme=read("app/brand-kreyv.css");
const card=read("components/LoyaltyCard.tsx");
assert.match(config,/BRAND_NAME = "KREYVI"/);
assert.match(config,/BRAND_THEME: BrandTheme = "vino-mostaza"/);
assert.match(layout,/data-theme=\{BRAND_THEME\}/);
assert.match(layout,/kreyv-favicon-v3.svg/);
assert.match(layout,/kreyv-apple-touch-v3.png/);
assert.match(layout,/import ".\/brand-tokens.css"/);
assert.match(layout,/import ".\/brand-kreyv.css"/);
assert.match(manifest,/name:BRAND_NAME,short_name:BRAND_NAME/);
assert.match(manifest,/kreyv-mark-v3-192.png/);
for(const token of ["brand","accent","bg","text","text-2","success","pin-have","pin-missing"])assert.match(tokens,new RegExp("--color-"+token+":"));
assert.match(tokens,/\[data-theme="tinta-maiz"\]/);
assert.match(tokens,/Bricolage\+Grotesque/);
assert.match(tokens,/Figtree/);
for(const pal of ["vino-mostaza","tinta-maiz"])for(const variant of ["claro","oscuro"]){
 const file="public/brand/kreyv-pegada-"+pal+"-"+variant+".svg";
 assert.match(logo,new RegExp("kreyv-pegada-"+pal+"-"+variant+"\\.svg"));
 assert.match(read(file),/<svg/);
 assert.match(read(file),/>KR<tspan[^>]*>EY<\/tspan>VI<\/text>/);
}
for(const file of ["public/kreyv-mark-v3.svg","public/kreyv-favicon-v3.svg","public/icon.svg","public/icon-192.png","public/icon-512.png","public/apple-touch-icon.png"]){
 const size=statSync(new URL("../../"+file,import.meta.url)).size;assert.ok(size>200,"Missing real PWA icon: "+file);
}
assert.match(theme,/--brand-wine:var\(--color-brand\)/);
assert.match(card,/backgroundColor:color/,"Business card keeps merchant color");
assert.doesNotMatch(card,/color:var\(--color-brand\)/);
console.log("KREYVI brand: names, colors, typefaces, logo variants, PWA artwork and merchant card isolation OK.");
