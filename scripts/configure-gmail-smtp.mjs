// Configura Gmail SMTP una única vez, desde un workflow manual de GitHub.
// Las credenciales llegan por stdin cifrado en SSH y jamás se imprimen.
import {readFileSync,writeFileSync,statSync} from "node:fs";

const path=process.argv[2]||"/loyally/.env.production";
const input=readFileSync(0,"utf8");
const [address,rawPassword]=input.split(/\r?\n/);
const email=(address||"").trim().toLowerCase();
const password=(rawPassword||"").replace(/\s/g,"");
if(!/^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(email)
 && !/^[A-Za-z0-9._%+-]+@googlemail\.com$/i.test(email)){
 throw Error("La dirección debe ser una cuenta Gmail válida para esta configuración temporal.");
}
if(!/^[A-Za-z]{16}$/.test(password))throw Error("La contraseña de aplicación de Gmail debe tener 16 letras.");
const original=readFileSync(path,"utf8");
const lines=original.split(/\r?\n/);
function set(key,value){
 const positions=lines.map((l,i)=>l.startsWith(key+"=")?i:-1).filter(i=>i>=0);
 if(positions.length>1)throw Error("Variables SMTP duplicadas; revisar .env.production.");
 if(positions.length===1)lines[positions[0]]=key+"="+value;
 else lines.push(key+"="+value);
}
set("SMTP_HOST","smtp.gmail.com");
set("SMTP_PORT","465");
set("SMTP_SECURE","true");
set("SMTP_USER",email);
set("SMTP_PASSWORD",password);
set("SMTP_FROM",email);
const mode=statSync(path).mode&0o777;
writeFileSync(path,lines.filter((x,i)=>i!==lines.length-1||x!=="").join("\n")+"\n",{encoding:"utf8",mode:mode||0o600});
console.log("Configuración de Gmail SMTP guardada en Contabo (sin mostrar credenciales).");
