// One-time initialization on the VPS. Runs in a throwaway Node container with
// the production env file mounted; secrets never leave the VPS or enter GitHub.
import {readFileSync,writeFileSync} from "node:fs";
import {generateKeyPairSync} from "node:crypto";

const path=process.argv[2]||"/loyally/.env.production";
const original=readFileSync(path,"utf8");
const lines=original.split(/\r?\n/);
function get(key){
 const found=lines.filter(x=>x.startsWith(key+"=")).at(-1);
 return found===undefined?"":found.slice(key.length+1).trim();
}
function put(key,value){
 const index=lines.findLastIndex(x=>x.startsWith(key+"="));
 if(index<0)lines.push(key+"="+value);
 else lines[index]=key+"="+value;
}
// Only the production deployment invokes this flag; local/test configuration is untouched.
if(process.argv.includes("--kreyvi-production")){
 put("NEXT_PUBLIC_SITE_URL","https://kreyviapp.com");
 put("LP_ALLOWED_ORIGINS","https://kreyviapp.com,https://www.kreyviapp.com");
 const subject=get("VAPID_SUBJECT");
 if(/^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(subject)||/^https?:\/\/(?:www\.)?kreyvi\.com\/?$/.test(subject))put("VAPID_SUBJECT","https://kreyviapp.com");
}
const url=new URL(get("NEXT_PUBLIC_SITE_URL"));
if(url.protocol!=="https:"||url.username||url.password)
 throw Error("Web Push requiere NEXT_PUBLIC_SITE_URL con HTTPS válido.");
const pub=get("VAPID_PUBLIC_KEY"),priv=get("VAPID_PRIVATE_KEY");
if(Boolean(pub)!==Boolean(priv))
 throw Error("VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY deben estar completas o ambas vacías.");
if(!pub&&!priv){
 const pair=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
 const publicJwk=pair.publicKey.export({format:"jwk"});
 const privateJwk=pair.privateKey.export({format:"jwk"});
 const x=Buffer.from(publicJwk.x,"base64url"),y=Buffer.from(publicJwk.y,"base64url");
 const publicKey=Buffer.concat([Buffer.from([4]),x,y]).toString("base64url");
 const privateKey=privateJwk.d;
 if(!/^[A-Za-z0-9_-]{87}$/.test(publicKey)||!/^[A-Za-z0-9_-]{43}$/.test(privateKey))
  throw Error("No se pudo generar el par VAPID.");
 put("VAPID_PUBLIC_KEY",publicKey);
 put("VAPID_PRIVATE_KEY",privateKey);
}
if(!get("VAPID_SUBJECT")||get("VAPID_SUBJECT").includes("TU_DOMINIO"))
 put("VAPID_SUBJECT",url.origin);
if(get("LP_PUSH_INITIALIZED")!=="true"){
 put("LP_ENABLE_PUSH_SEND","true");
 put("LP_PUSH_INITIALIZED","true");
}
writeFileSync(path,lines.filter((x,i)=>i!==lines.length-1||x!=="").join("\n")+"\n",{encoding:"utf8",mode:0o600});
console.log("Web Push configurado en el VPS; claves privadas preservadas y no mostradas.");
