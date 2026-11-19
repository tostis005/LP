import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";

const dir=mkdtempSync(join(tmpdir(),"lp-gmail-"));
const env=join(dir,".env.production");
const input="mi-cuenta@gmail.com\nabcdefghijklmnop\n";
try{
 writeFileSync(env,"NEXT_PUBLIC_SITE_URL=https://169.58.121.198\nSMTP_HOST=\nSMTP_USER=\nSMTP_PASSWORD=\n");
 const spawn=()=>spawnSync(process.execPath,["scripts/configure-gmail-smtp.mjs",env],{input,encoding:"utf8"});
 const first=spawn();
 assert.equal(first.status,0,first.stderr);
 const text=readFileSync(env,"utf8");
 assert.match(text,/SMTP_HOST=smtp\.gmail\.com/);
 assert.match(text,/SMTP_PORT=465/);
 assert.match(text,/SMTP_SECURE=true/);
 assert.match(text,/SMTP_USER=mi-cuenta@gmail\.com/);
 assert.match(text,/SMTP_FROM=mi-cuenta@gmail\.com/);
 assert.match(text,/SMTP_PASSWORD=abcdefghijklmnop/);
 assert.ok(!first.stdout.includes("abcdefghijklmnop"),"No filtrar clave SMTP en stdout");
 const second=spawn();
 assert.equal(second.status,0,second.stderr);
 assert.equal(readFileSync(env,"utf8"),text,"No duplicar claves en reejecución");
 const bad=spawnSync(process.execPath,["scripts/configure-gmail-smtp.mjs",env],{input:"user@gmail.com\nwrong\n",encoding:"utf8"});
 assert.notEqual(bad.status,0,"No se admiten contraseñas de Google normales");
 assert.equal(readFileSync(env,"utf8"),text,"Una contraseña inválida no rompe la configuración");
 console.log("OK: SMTP Gmail seguro, sin imprimir secretos y configuración idempotente.");
}finally{rmSync(dir,{recursive:true,force:true})}
