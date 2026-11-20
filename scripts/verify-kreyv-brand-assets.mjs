import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const pngs={"kreyv-mark-v3-192.png":[192,192],"kreyv-mark-v3-512.png":[512,512],"kreyv-apple-touch-v3.png":[180,180],"kreyv-favicon-v3-48.png":[48,48],"icon-192.png":[192,192],"icon-512.png":[512,512],"apple-touch-icon.png":[180,180]};
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
assert.match(sw,/kreyv-mark-v3-192.png/);
console.log("OK: iconos Kreyv versionados (48/180/192/512 px) en web, manifest y push.");
