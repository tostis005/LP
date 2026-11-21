import assert from "node:assert/strict";
import sharp from "sharp";
import {readFileSync,statSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const pngs={"kreyv-mark-v3-192.png":[192,192],"kreyv-mark-v3-512.png":[512,512],"kreyv-apple-touch-v3.png":[180,180],"kreyv-favicon-v3-48.png":[48,48],"icon-192.png":[192,192],"icon-512.png":[512,512],"apple-touch-icon.png":[180,180],"kreyv-notification-icon-v2-192.png":[192,192],"kreyv-notification-badge-v2-96.png":[96,96]};
for(const [name,[w,h]] of Object.entries(pngs)){
 const buf=read("public/"+name);
 assert.equal(buf.subarray(0,8).toString("hex"),"89504e470d0a1a0a","PNG corrupto: "+name);
 assert.equal(buf.readUInt32BE(16),w,"Ancho incorrecto: "+name);
 assert.equal(buf.readUInt32BE(20),h,"Alto incorrecto: "+name);
 assert.ok(buf.length>300,"PNG vacío: "+name);
}
for(const name of ["public/kreyv-mark-v3.svg","public/kreyv-favicon-v3.svg","public/icon.svg"]){
 const svg=read(name).toString("utf8");
 assert.match(svg,/stroke="#5E1A2B"/);
 assert.match(svg,/fill="#D9A23A"/);
}
const layout=read("app/layout.tsx").toString("utf8"),manifest=read("app/manifest.ts").toString("utf8"),sw=read("public/sw.js").toString("utf8");
assert.match(layout,/kreyv-favicon-v3.svg/);
assert.match(layout,/kreyv-apple-touch-v3.png/);
assert.match(manifest,/kreyv-mark-v3-512.png/);
const sender=read("lib/server/web-push.ts").toString("utf8");
for(const code of [sw,sender]){
 assert.match(code,/kreyv-notification-icon-v2-192\.png/,"La notificación debe usar la lupa y estrella a color sin fondo.");
 assert.match(code,/kreyv-notification-badge-v2-96\.png/,"Android necesita un badge pequeño monocromo y transparente.");
}
const badge=await sharp(read("public/kreyv-notification-badge-v2-96.png")).ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(badge.info.channels,4);
let visible=0,transparent=0;
for(let i=0;i<badge.data.length;i+=4){
 const alpha=badge.data[i+3];
 if(alpha===0)transparent++;
 if(alpha>128){
  visible++;
  assert.ok(badge.data[i]>=250&&badge.data[i+1]>=250&&badge.data[i+2]>=250,"El badge debe ser blanco, no una imagen a color.");
 }
}
assert.ok(transparent>1000&&visible>100,"El badge debe tener fondo transparente y la silueta visible.");
const notificationIcon=await sharp(read("public/kreyv-notification-icon-v2-192.png")).metadata();
assert.equal(notificationIcon.hasAlpha,true,"El icono a color debe ser transparente para evitar cuadrados.");
console.log("OK: iconos Kreyv y push (color transparente y badge blanco con canal alfa) válidos.");
