import sharp from "sharp";
import {readFile,mkdir} from "node:fs/promises";
import path from "node:path";
const base=process.cwd();
const dir=path.join(base,"public");
await mkdir(dir,{recursive:true});
const app=await readFile(path.join(dir,"kreyv-mark-v3.svg"));
const mark=await readFile(path.join(dir,"kreyv-favicon-v3.svg"));
for(const [name,size] of [["kreyv-mark-v3-192.png",192],["kreyv-mark-v3-512.png",512],["kreyv-apple-touch-v3.png",180],["icon-192.png",192],["icon-512.png",512],["apple-touch-icon.png",180]]){
 await sharp(app).resize(size,size).png({compressionLevel:9}).toFile(path.join(dir,name));
}
await sharp(mark).resize(48,48).png({compressionLevel:9}).toFile(path.join(dir,"kreyv-favicon-v3-48.png"));
console.log("Kreyv: favicon e iconos PWA generados desde el isotipo oficial de lupa y estrella.");
