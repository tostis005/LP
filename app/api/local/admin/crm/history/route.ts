import {randomUUID} from "node:crypto";
import {actorFromRequest,asActor,checkOrigin,responseError,ApiError,type Actor} from "@/lib/server/db";
import {callMailbox,mailboxCall,seal,unseal} from "@/lib/server/crm-mailbox";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const json=(data:unknown)=>Response.json(data,{headers});
type Source="inbox"|"logs";
type Row={id:string;address:string;direction:"inbound"|"outbound";date:string;subject:string;body:string;status:string};
async function admin(request:Request){
 const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);
 await asActor(actor,async c=>{if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);});
 return actor;
}
function str(v:unknown,max:number){return typeof v==="string"?v.trim().slice(0,max):"";}
function addr(v:unknown){const a=str(v,254).toLowerCase();return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(a)?a:"";}
function plain(v:unknown){return typeof v==="string"?v.slice(0,200000).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,"").replace(/<\/?(?:p|div|br|li|tr|h[1-6])\b[^>]*>/gi,"\n").replace(/<[^>]*>/g,"").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").trim().slice(0,50000):"";}
function date(v:unknown){const n=typeof v==="string"?Date.parse(v):NaN;return Number.isFinite(n)?new Date(n).toISOString():"";}
async function logsCall(key:string,command:string,args:Record<string,unknown>){
 let r:Response;try{r=await fetch("https://g.sendcorex.com/v1/logs",{method:"POST",headers:{Authorization:key,"Content-Type":"application/json"},body:JSON.stringify({commands:[{command,args}]}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});}catch{throw new ApiError("No se pudo consultar el registro de envíos.",503);}
 const j=await r.json().catch(()=>null),result=j?.results?.[0];
 if(!r.ok||result?.type!=="SUCCESS")throw new ApiError("Sendcorex no autorizó la lectura de envíos. Comprueba la API key y el permiso logs:read.",400);
 return result.data;
}
async function sync(actor:Actor,source:Source){
 const lease=randomUUID();
 const job=await asActor(actor,async c=>{
  const m=(await c.query("SELECT email,logs_secret FROM public.crm_mailbox WHERE id=true")).rows[0];
  if(!m||(source==="logs"&&!m.logs_secret))return null;
  await c.query("INSERT INTO public.crm_mail_sync(mailbox,source) VALUES($1,$2) ON CONFLICT DO NOTHING",[m.email,source]);
  const s=(await c.query("SELECT * FROM public.crm_mail_sync WHERE mailbox=$1 AND source=$2 FOR UPDATE",[m.email,source])).rows[0];
  if(s.lease&&s.started_at&&Date.now()-new Date(s.started_at).getTime()<120000)return null;
  if(s.started_at&&Date.now()-new Date(s.started_at).getTime()<15000)return null;
  if(!s.window_end&&s.last_finished&&Date.now()-new Date(s.last_finished).getTime()<300000)return null;
  const end=s.window_end?new Date(s.window_end).toISOString():new Date().toISOString();
  const start=s.window_start?new Date(s.window_start).toISOString():s.last_finished?new Date(new Date(s.last_finished).getTime()-(source==="logs"?7:2)*86400000).toISOString():source==="logs"?new Date(Date.now()-59*86400000).toISOString():null;
  await c.query("UPDATE public.crm_mail_sync SET lease=$3,started_at=now(),window_start=$4,window_end=$5 WHERE mailbox=$1 AND source=$2",[m.email,source,lease,start,end]);
  return {email:String(m.email),key:m.logs_secret as string|null,cursor:s.cursor as string|null,start,end};
 });
 if(!job)return {skipped:true};
 try{
  const args={limit:source==="logs"?10:25,before:job.end,...(job.start?{after:job.start}:{}),...(job.cursor?{cursor:job.cursor}:{})};
  let page:any,rows:Row[]=[];
  if(source==="inbox"){
   page=await callMailbox(actor,{command:"list_messages",args:{...args,folder:"INBOX"}});
   if(!Array.isArray(page?.messages))throw new ApiError("Respuesta de entrada no válida.",503);
   const ids=page.messages.map((m:any)=>str(m.message_uid,300)).filter(Boolean);
   const saved=ids.length?await asActor(actor,async c=>(await c.query("SELECT DISTINCT external_id FROM public.crm_mail_history WHERE mailbox=$1 AND source='inbox' AND external_id=ANY($2::text[])",[job.email,ids])).rows.map(r=>r.external_id)):[]; 
   const fresh=ids.filter((id:string)=>!saved.includes(id));
   const details=fresh.length?await callMailbox(actor,{command:"get_messages",args:{ids:fresh,include:["body"]}}):{messages:[]};
   if(!Array.isArray(details?.messages))throw new ApiError("Respuesta de mensajes no válida.",503);
   const listed=new Map<string,any>(page.messages.map((m:any)=>[m.message_uid,m]));
   for(const m of details.messages){
    const id=str(m.message_uid,300),address=addr(m.from_email),when=date(m.received_at);
    if(!id||!address||!when||address===job.email)continue;
    rows.push({id,address,direction:"inbound",date:when,subject:str(m.subject,1000),body:str(m.body?.text,50000)||plain(m.body?.html)||str(listed.get(id)?.preview,50000),status:"received"});
   }
   if(fresh.some((id:string)=>!details.messages.some((m:any)=>m.message_uid===id)&&!(details.not_found||[]).includes(id)))throw new ApiError("Importación incompleta de mensajes.",503);
  }else{
   const key=unseal(job.key!).token;
   page=await logsCall(key,"list_logs",{...args,from:job.email});
   if(!Array.isArray(page?.logs))throw new ApiError("Respuesta de envíos no válida.",503);
   const ids=page.logs.map((m:any)=>str(m.id,300)).filter(Boolean);
   const saved=ids.length?await asActor(actor,async c=>(await c.query("SELECT DISTINCT external_id FROM public.crm_mail_history WHERE mailbox=$1 AND source='logs' AND external_id=ANY($2::text[])",[job.email,ids])).rows.map(r=>r.external_id)):[]; 
   const fresh=ids.filter((id:string)=>!saved.includes(id));
   const detail=fresh.length?await logsCall(key,"get_logs",{ids:fresh,include_content:true}):{logs:[]};
   if(!Array.isArray(detail?.logs))throw new ApiError("Respuesta de detalle no válida.",503);
   const content=new Map<string,any>(detail.logs.map((m:any)=>[m.id,m.content]));
   for(const m of page.logs){
    const id=str(m.id,300),address=addr(m.to),when=date(m.sent_at);
    if(!id||!address||!when||addr(m.from)!==job.email)continue;
    rows.push({id,address,direction:"outbound",date:when,subject:str(m.subject,1000),body:plain(content.get(id)?.html),status:str(m.status,40)||"unknown"});
   }
  }
  const next=page.has_more?str(page.next_cursor,8000):null;
  if(page.has_more&&(!next||next===job.cursor))throw new ApiError("Cursor de sincronización inválido.",503);
  return await asActor(actor,async c=>{
   const state=(await c.query("SELECT lease FROM public.crm_mail_sync WHERE mailbox=$1 AND source=$2 FOR UPDATE",[job.email,source])).rows[0];
   if(state?.lease!==lease)return {skipped:true};
   const current=(await c.query("SELECT email FROM public.crm_mailbox WHERE id=true")).rows[0];
   if(current?.email!==job.email){await c.query("UPDATE public.crm_mail_sync SET lease=NULL WHERE mailbox=$1 AND source=$2",[job.email,source]);return {skipped:true};}
   if(rows.length){
    await c.query("INSERT INTO public.crm_mail_history(mailbox,source,external_id,correspondent,direction,occurred_at,subject,body_text,delivery_status) SELECT $1,$2,id,address,direction,date::timestamptz,subject,body,status FROM jsonb_to_recordset($3::jsonb) AS x(id text,address text,direction text,date text,subject text,body text,status text) ON CONFLICT(mailbox,source,external_id,correspondent) DO UPDATE SET subject=EXCLUDED.subject,body_text=COALESCE(NULLIF(EXCLUDED.body_text,''),crm_mail_history.body_text),delivery_status=EXCLUDED.delivery_status,occurred_at=EXCLUDED.occurred_at",[job.email,source,JSON.stringify(rows)]);
    if(source==="logs"){const delivered=rows.filter(r=>r.status==="delivered").map(r=>r.address);if(delivered.length)await c.query("UPDATE public.crm_prospects SET status='contacted',updated_at=now() WHERE status IN ('pending_review','qualified') AND (lower(email)=ANY($1::text[]) OR lower(public_email)=ANY($1::text[]))",[delivered]);}
   }
   await c.query("UPDATE public.crm_mail_sync SET cursor=$3,window_start=CASE WHEN $3::text IS NULL THEN NULL ELSE window_start END,window_end=CASE WHEN $3::text IS NULL THEN NULL ELSE window_end END,last_finished=CASE WHEN $3::text IS NULL THEN window_end ELSE last_finished END,lease=NULL,last_error=NULL WHERE mailbox=$1 AND source=$2 AND lease=$4",[job.email,source,next,lease]);
   return {synced:rows.length,more:!!next};
  });
 }catch(e){
  const message=e instanceof ApiError?e.message:"No se pudo sincronizar. Los datos guardados siguen disponibles.";
  await asActor(actor,async c=>{await c.query("UPDATE public.crm_mail_sync SET lease=NULL,last_error=$3 WHERE mailbox=$1 AND source=$2 AND lease=$4",[job.email,source,message,lease]);});
  return {error:message};
 }
}
export async function GET(request:Request){
 try{
  const actor=await admin(request),p=new URL(request.url).searchParams,id=p.get("contact");
  return json(await asActor(actor,async c=>{
   if(id){
    if(!/^[0-9a-f-]{36}$/i.test(id))throw new ApiError("Contacto inválido.");
    const offset=Math.max(0,Math.min(100000,Math.floor(Number(p.get("offset"))||0)));
    const messages=(await c.query("SELECT h.source,h.external_id,h.correspondent,h.direction,h.occurred_at,h.subject,h.body_text,h.delivery_status FROM public.crm_prospects p JOIN public.crm_mail_history h ON (h.correspondent=lower(p.email) OR h.correspondent=lower(p.public_email)) WHERE p.id=$1::uuid ORDER BY h.occurred_at DESC,h.external_id DESC,h.correspondent LIMIT 26 OFFSET $2",[id,offset])).rows;
    return {messages:messages.slice(0,25),more:messages.length>25};
   }
   const m=(await c.query("SELECT email,logs_secret IS NOT NULL AS logs_connected FROM public.crm_mailbox WHERE id=true")).rows[0];
   const states=m?(await c.query("SELECT source,last_finished,window_end,last_error FROM public.crm_mail_sync WHERE mailbox=$1",[m.email])).rows:[];
   return {connected:!!m,email:m?.email,logsConnected:m?.logs_connected,states};
  }));
 }catch(e){return responseError(e);}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);const actor=await admin(request),raw=await request.text();if(raw.length>10000)throw new ApiError("Solicitud demasiado larga.",413);const v=JSON.parse(raw);
  if(v.action==="sync"){
   if(v.source!=="inbox"&&v.source!=="logs")throw new ApiError("Origen inválido.");
   return json(await sync(actor,v.source));
  }
  if(v.action==="configure"){
   const token=str(v.token,2048),refresh=str(v.refresh,2048),key=str(v.key,2048);
   if(!token&&!key)throw new ApiError("Introduce una credencial.");
   if(token&&!refresh)throw new ApiError("Introduce también el refresh token del buzón.");
   const identity=token?await mailboxCall(token,{command:"whoami"}):null;
   const email=identity?addr(identity.mailbox?.email):await asActor(actor,async c=>(await c.query("SELECT email FROM public.crm_mailbox WHERE id=true")).rows[0]?.email);
   if(!email||email.endsWith("@kreyvi.com")||email.split("@")[1]?.endsWith(".kreyvi.com"))throw new ApiError("Conecta un buzón comercial independiente.");
   if(key)await logsCall(key,"list_logs",{from:email,limit:1});
   await asActor(actor,async c=>{
    await c.query("SELECT pg_advisory_xact_lock(hashtext('crm-sendcorex-mailbox'))");
    if(token){await c.query("INSERT INTO public.crm_mailbox(id,email,secret,logs_secret) VALUES(true,$1,$2,$3) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,secret=EXCLUDED.secret,logs_secret=CASE WHEN crm_mailbox.email=EXCLUDED.email THEN COALESCE(EXCLUDED.logs_secret,crm_mailbox.logs_secret) ELSE EXCLUDED.logs_secret END,updated_at=now()",[email,seal({token,refresh,expiresAt:identity?.token?.expires_at}),key?seal({token:key,refresh:""}):null]);}
    else{const result=await c.query("UPDATE public.crm_mailbox SET logs_secret=$1 WHERE id=true AND email=$2",[seal({token:key,refresh:""}),email]);if(!result.rowCount)throw new ApiError("El buzón cambió. Vuelve a conectar.");}
    await c.query("UPDATE public.crm_mail_sync SET last_error=NULL,started_at=NULL WHERE mailbox=$1 AND lease IS NULL",[email]);
   });
   return json({ok:true});
  }
  throw new ApiError("Acción inválida.");
 }catch(e){return responseError(e);}
}
