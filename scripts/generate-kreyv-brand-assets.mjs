import sharp from "sharp";
import {readFile,mkdir} from "node:fs/promises";
import path from "node:path";
const base=process.cwd();
const dir=path.join(base,"public");
await mkdir(dir,{recursive:true});
const app=await readFile(path.join(dir,"kreyv-mark-v3.svg"));
const mark=await readFile(path.join(dir,"kreyv-favicon-v3.svg"));
// La notificación grande muestra los colores reales de Kreyv, sin recuadro de fondo.
await sharp(mark).resize(192,192).png({compressionLevel:9}).toFile(path.join(dir,"kreyv-notification-icon-v1-192.png"));
// Android exige un badge monocromo: usa solamente el canal alfa para la barra de estado.
const whiteMark=mark.toString("utf8").replace(/#5E1A2B|#D9A23A/gi,"#FFFFFF");
await sharp(Buffer.from(whiteMark)).resize(96,96).png({compressionLevel:9}).toFile(path.join(dir,"kreyv-notification-badge-v1-96.png"));
for(const [name,size] of [["kreyv-mark-v3-192.png",192],["kreyv-mark-v3-512.png",512],["kreyv-apple-touch-v3.png",180],["icon-192.png",192],["icon-512.png",512],["apple-touch-icon.png",180]]){
 await sharp(app).resize(size,size).png({compressionLevel:9}).toFile(path.join(dir,name));
}
await sharp(mark).resize(48,48).png({compressionLevel:9}).toFile(path.join(dir,"kreyv-favicon-v3-48.png"));
console.log("Kreyv: favicon, iconos PWA y notificaciones push generados desde la lupa y estrella oficiales.");
