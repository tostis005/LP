import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";

const directory=mkdtempSync(join(tmpdir(),"loyally-push-"));
const file=join(directory,".env.production");
const parse=(content)=>Object.fromEntries(content.split(/\r?\n/).filter(x=>x.includes("=")).map(x=>{
 const i=x.indexOf("=");return [x.slice(0,i),x.slice(i+1)];
}));
const run=()=>{
 const result=spawnSync(process.execPath,["scripts/setup-push-env.mjs",file],{encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
 return result.stdout;
};
try{
 writeFileSync(file,"NEXT_PUBLIC_SITE_URL=https://169.58.121.198\nLP_ENABLE_PUSH_SEND=false\n",{mode:0o600});
 const output=run();
 const first=parse(readFileSync(file,"utf8"));
 assert.equal(first.LP_ENABLE_PUSH_SEND,"true");
 assert.equal(first.LP_PUSH_INITIALIZED,"true");
 assert.match(first.VAPID_PUBLIC_KEY,/^[A-Za-z0-9_-]{87}$/);
 assert.match(first.VAPID_PRIVATE_KEY,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(first.VAPID_SUBJECT,"https://169.58.121.198");
 assert.ok(!output.includes(first.VAPID_PRIVATE_KEY),"No filtrar secretos en logs");
 writeFileSync(file,readFileSync(file,"utf8").replace("LP_ENABLE_PUSH_SEND=true","LP_ENABLE_PUSH_SEND=false"));
 run();
 const second=parse(readFileSync(file,"utf8"));
 assert.equal(second.LP_ENABLE_PUSH_SEND,"false","No reactivar un canal que se deshabilitó");
 assert.equal(second.VAPID_PRIVATE_KEY,first.VAPID_PRIVATE_KEY,"No rotar claves VAPID existentes");
 assert.equal(second.VAPID_PUBLIC_KEY,first.VAPID_PUBLIC_KEY);
 const migrated=spawnSync(process.execPath,["scripts/setup-push-env.mjs",file,"--kreyvi-production"],{encoding:"utf8"});
 assert.equal(migrated.status,0,migrated.stderr);
 const third=parse(readFileSync(file,"utf8"));
 assert.equal(third.NEXT_PUBLIC_SITE_URL,"https://kreyviapp.com");
 assert.equal(third.VAPID_SUBJECT,"https://kreyviapp.com");
 assert.equal(third.VAPID_PRIVATE_KEY,first.VAPID_PRIVATE_KEY);
 assert.equal(third.LP_ENABLE_PUSH_SEND,"false");
 console.log("OK: VAPID válido, persistente, privado y desactivación respetada.");
}finally{rmSync(directory,{recursive:true,force:true})}
