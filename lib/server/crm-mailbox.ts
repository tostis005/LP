import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import {ApiError,asActor,type Actor} from "@/lib/server/db";
type Credentials={token:string;refresh:string;expiresAt?:string};
type Command={command:string;args?:Record<string,unknown>};
const providerCodes=new Set(["TOKEN_EXPIRED","INVALID_TOKEN","MISSING_AUTH_HEADER","READ_ONLY_ACCESS","RECIPIENT_UNSUBSCRIBED","NO_CREDITS","RATE_LIMITED","INVALID_ARGS","INVALID_TOADDRESS","SENDER_NOT_FOUND","SENDER_NO_DOMAIN","AUTH_UNAVAILABLE","INTERNAL","MARKETING_LIMIT_REACHED","DAILY_LIMIT","ACCOUNT_RESTRICTED","SPAM_DETECTED","UNSUBSCRIBE_UNAVAILABLE","FORBIDDEN_HTML_CONTENT","PAID_PLAN_REQUIRED"]);
export class MailboxError extends ApiError{
 constructor(message:string,status:number,public reason:string){super(message,status);}
}
export function mailboxFailureCode(error:unknown){
 if(error instanceof MailboxError)return error.reason;
 const code=(error as {code?:string}|null)?.code;
 if(code==="42501")return "DB_PERMISSION";
 if(code==="23514"||code==="23503"||code==="23505")return "DB_CONSTRAINT";
 if(error instanceof ApiError)return "CRM_REJECTED_"+error.status;
 return "UNKNOWN";
}
function key(){
 const secret=process.env.SENDCOREX_ENCRYPTION_KEY||process.env.AUTH_PGPASSWORD;
 if(!secret||secret.length<32)throw new ApiError("Falta la clave de cifrado del servidor.",503);
 return createHash("sha256").update("kreyvi-crm-mailbox-v1:"+secret).digest();
}
export function seal(value:Credentials){
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv);
 const data=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
 return [iv,cipher.getAuthTag(),data].map(b=>b.toString("base64url")).join(".");
}
export function unseal(value:string):Credentials{
 const [iv,tag,data]=value.split(".").map(x=>Buffer.from(x,"base64url"));
 const cipher=createDecipheriv("aes-256-gcm",key(),iv);
 cipher.setAuthTag(tag);
 return JSON.parse(Buffer.concat([cipher.update(data),cipher.final()]).toString("utf8"));
}
export async function mailboxCall(token:string,command:Command){
 let response:Response;
 try{response=await fetch("https://g.sendcorex.com/v1",{method:"POST",headers:{"Authorization":token,"Content-Type":"application/json"},body:JSON.stringify({commands:[command]}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});}
 catch{throw new MailboxError("No se pudo comunicar con Sendcorex. Si estabas enviando, comprueba Enviados antes de repetir.",502,"PROVIDER_NETWORK");}
 const j=await response.json().catch(()=>null);
 const r=j?.results?.[0],code=String(r?.code||j?.code||"");
 if(code==="TOKEN_EXPIRED")throw new ApiError("TOKEN_EXPIRED",401);
 if(!response.ok||r?.type!=="SUCCESS"){
  const reason=providerCodes.has(code)?code:response.status===429?"RATE_LIMITED":"PROVIDER_REJECTED";
  const fail=(message:string,status:number)=>new MailboxError(message,status,reason);
  if(response.status===429)throw fail("Límite temporal de Sendcorex. Intenta más tarde.",429);
  if(code==="INVALID_TOKEN"||code==="MISSING_AUTH_HEADER")throw fail("Credencial de buzón inválida. Reconecta el buzón.",400);
  if(code==="READ_ONLY_ACCESS")throw fail("El token es de solo lectura.",403);
  if(code==="RECIPIENT_UNSUBSCRIBED")throw fail("El destinatario se dio de baja.",409);
  if(code==="NO_CREDITS")throw fail("No quedan créditos de envío.",429);
  throw fail("Sendcorex rechazó la operación ("+reason+").",502);
 }
 return r.data;
}
async function renew(c:Credentials):Promise<Credentials>{
 if(!c.refresh)throw new ApiError("El token caducó. Reconecta el buzón.",400);
 let response:Response;
 try{response=await fetch("https://g.sendcorex.com/v1/token/refresh",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refresh_token:c.refresh}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});}
 catch{throw new ApiError("No se pudo renovar la conexión con Sendcorex.",502);}
 const j=await response.json().catch(()=>null);
 if(!response.ok||typeof j?.data?.token!=="string"||typeof j?.data?.refresh_token!=="string")throw new MailboxError("No se pudo renovar el token. Reconecta el buzón.",400,"REFRESH_FAILED");
 return {token:j.data.token,refresh:j.data.refresh_token,expiresAt:j.data.expires_at};
}
async function credentials(actor:Actor,expiredToken?:string){
 return asActor(actor,async c=>{
  await c.query("SELECT pg_advisory_xact_lock(hashtext('crm-sendcorex-mailbox'))");
  const row=(await c.query("SELECT secret FROM public.crm_mailbox WHERE id=true")).rows[0];
  if(!row)throw new ApiError("Conecta primero el buzón de Sendcorex.",400);
  let value=unseal(row.secret);
  if(expiredToken===value.token||(value.refresh&&value.expiresAt&&Date.parse(value.expiresAt)<Date.now()+60000)){
   value=await renew(value);
   await c.query("UPDATE public.crm_mailbox SET secret=$1,updated_at=now() WHERE id=true",[seal(value)]);
  }
  return value;
 });
}
export async function callMailbox(actor:Actor,command:Command){
 const value=await credentials(actor);
 try{return await mailboxCall(value.token,command);}
 catch(e){if(!(e instanceof ApiError)||e.message!=="TOKEN_EXPIRED")throw e;}
 // The rotated credential is committed before the next external call.
 const next=await credentials(actor,value.token);
 return mailboxCall(next.token,command);
}
