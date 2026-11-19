import {createHash,createPrivateKey,randomBytes,sign} from "node:crypto";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {deflateRawSync} from "node:zlib";
import {ApiError} from "@/lib/server/db";

export type WalletProvider="google"|"apple";
export type WalletCard={
 id:string;card_token:string;balance:number;
 name:string;slug:string;accent_color:string;reward_label:string;reward_cost:number;type:string;
};
const exec=promisify(execFile);
function baseUrl(){
 const url=process.env.NEXT_PUBLIC_SITE_URL||"";
 try{const u=new URL(url);return u.protocol==="https:"&&u.hostname.includes(".")&&!/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)&&u.hostname!=="localhost"?u.origin:null}
 catch{return null;}
}
export function walletAvailable(p:WalletProvider){
 if(!baseUrl())return false;
 if(p==="google")return !!(process.env.GOOGLE_WALLET_ISSUER_ID&&
  process.env.GOOGLE_WALLET_SERVICE_EMAIL&&process.env.GOOGLE_WALLET_PRIVATE_KEY_B64);
 return !!(process.env.APPLE_WALLET_PASS_TYPE_ID&&process.env.APPLE_WALLET_TEAM_ID&&
  process.env.APPLE_WALLET_CERT_PEM_B64&&process.env.APPLE_WALLET_KEY_PEM_B64&&
  process.env.APPLE_WALLET_WWDR_PEM_B64);
}
function safeColor(input:string){return /^#[a-f0-9]{6}$/i.test(input)?input:"#571c32";}
export function googleWalletUrl(card:WalletCard){
 if(!walletAvailable("google"))throw new ApiError("Google Wallet aún no está disponible.",503);
 const issuer=process.env.GOOGLE_WALLET_ISSUER_ID!;
 if(!/^\d{8,30}$/.test(issuer))throw new ApiError("Configuración Google Wallet inválida.",503);
 const classId=issuer+".loyally_generic",objectId=issuer+".loyally_"+card.id.replaceAll("-","");
 const site=baseUrl()!;
 const localized=(value:string)=>({defaultValue:{language:"es",value}});
 const payload={
  iss:process.env.GOOGLE_WALLET_SERVICE_EMAIL!,aud:"google",origins:[site],
  typ:"savetowallet",iat:Math.floor(Date.now()/1000),
  payload:{
   genericClasses:[{id:classId}],
   genericObjects:[{
    id:objectId,classId,state:"ACTIVE",
    genericType:"GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor:safeColor(card.accent_color),
    cardTitle:localized(card.name),header:localized(card.reward_label),
    subheader:localized("Tarjeta Loyally"),
    barcode:{type:"QR_CODE",value:site+"/t/"+card.card_token,alternateText:"Escanea en el establecimiento"},
    textModulesData:[{header:"Tu progreso",body:String(card.balance)+(card.type==="stamps"?" / "+card.reward_cost+" sellos":card.type==="points"?" puntos":" de saldo"),id:"progress"}]
   }]
  }
 };
 const head=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT"})).toString("base64url");
 const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
 const msg=head+"."+body;
 const pem=Buffer.from(process.env.GOOGLE_WALLET_PRIVATE_KEY_B64!,"base64").toString("utf8");
 const signature=sign("RSA-SHA256",Buffer.from(msg),createPrivateKey(pem)).toString("base64url");
 return "https://pay.google.com/gp/v/save/"+msg+"."+signature;
}
function crc32(buffer:Buffer){
 let crc=0xffffffff;
 for(const b of buffer){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function zip(files:Record<string,Buffer>){
 let offset=0;const locals:Buffer[]=[],centers:Buffer[]=[];let count=0;
 for(const [name,data] of Object.entries(files)){
  const filename=Buffer.from(name,"utf8"),compressed=deflateRawSync(data);
  const local=Buffer.alloc(30),central=Buffer.alloc(46);
  const checksum=crc32(data);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);
  local.writeUInt16LE(8,8);local.writeUInt32LE(checksum,14);
  local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);
  local.writeUInt16LE(filename.length,26);
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
  central.writeUInt16LE(8,10);central.writeUInt32LE(checksum,16);
  central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(data.length,24);
  central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
  locals.push(local,filename,compressed);centers.push(central,filename);
  offset+=local.length+filename.length+compressed.length;count++;
 }
 const central=Buffer.concat(centers),footer=Buffer.alloc(22);
 footer.writeUInt32LE(0x06054b50,0);footer.writeUInt16LE(count,8);footer.writeUInt16LE(count,10);
 footer.writeUInt32LE(central.length,12);footer.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,central,footer]);
}
function decoded(name:string){return Buffer.from(process.env[name]||"","base64");}
export async function appleWalletPass(card:WalletCard):Promise<Buffer>{
 if(!walletAvailable("apple"))throw new ApiError("Apple Wallet aún no está disponible.",503);
 const type=process.env.APPLE_WALLET_PASS_TYPE_ID!,team=process.env.APPLE_WALLET_TEAM_ID!;
 if(!/^pass\.[a-z0-9.-]+$/i.test(type)||!/^[A-Z0-9]{10}$/.test(team))throw new ApiError("Configuración Apple Wallet inválida.",503);
 const site=baseUrl()!;
 const fields={
  formatVersion:1,passTypeIdentifier:type,teamIdentifier:team,
  serialNumber:card.id,organizationName:"Loyally",
  description:"Tarjeta de fidelización de "+card.name,
  logoText:card.name,foregroundColor:"rgb(255,255,255)",
  backgroundColor:"rgb("+[1,3,5].map(i=>parseInt(safeColor(card.accent_color).slice(i,i+2),16)).join(",")+")",
  labelColor:"rgb(249,221,232)",
  storeCard:{
   primaryFields:[{key:"program",label:"TU ESTABLECIMIENTO",value:card.name}],
   secondaryFields:[{key:"balance",label:"TU PROGRESO",value:String(card.balance)+(card.type==="stamps"?" / "+card.reward_cost+" sellos":"")}],
   auxiliaryFields:[{key:"reward",label:"TU RECOMPENSA",value:card.reward_label}]
  },
  barcodes:[{format:"PKBarcodeFormatQR",message:site+"/t/"+card.card_token,messageEncoding:"iso-8859-1"}]
 };
 const icon=await readFile(join(process.cwd(),"public/icon-192.png"));
 const icon2=await readFile(join(process.cwd(),"public/icon-512.png"));
 const files:Record<string,Buffer>={
  "pass.json":Buffer.from(JSON.stringify(fields)),
  "icon.png":icon,"icon@2x.png":icon2
 };
 const manifest=Object.fromEntries(Object.entries(files).map(([name,body])=>[name,createHash("sha1").update(body).digest("hex")]));
 files["manifest.json"]=Buffer.from(JSON.stringify(manifest));
 const dir=await mkdtemp(join(tmpdir(),"lp-wallet-"));
 try{
  const cert=join(dir,"pass.pem"),key=join(dir,"key.pem"),wwdr=join(dir,"wwdr.pem"),manifestPath=join(dir,"manifest.json"),signature=join(dir,"signature");
  await Promise.all([
   writeFile(cert,decoded("APPLE_WALLET_CERT_PEM_B64"),{mode:0o600}),
   writeFile(key,decoded("APPLE_WALLET_KEY_PEM_B64"),{mode:0o600}),
   writeFile(wwdr,decoded("APPLE_WALLET_WWDR_PEM_B64"),{mode:0o600}),
   writeFile(manifestPath,files["manifest.json"],{mode:0o600})
  ]);
  await exec("openssl",["smime","-binary","-sign","-signer",cert,"-inkey",key,"-certfile",wwdr,
   "-in",manifestPath,"-out",signature,"-outform","DER"],{timeout:12000});
  files.signature=await readFile(signature);
  return zip(files);
 }finally{await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}
