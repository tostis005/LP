import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {callMailbox,mailboxCall,seal} from "@/lib/server/crm-mailbox";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
async function admin(request:Request){
 const actor=await actorFromRequest(request);
 if(!actor)throw new ApiError("Inicia sesión.",401);
 await asActor(actor,async c=>{if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);});
 return actor;
}
const json=(data:unknown)=>Response.json(data,{headers});
function str(v:unknown,max:number){if(typeof v!=="string"||!v.trim()||v.length>max)throw new ApiError("Datos inválidos.");return v.trim();}
export async function GET(request:Request){
 try{
  const actor=await admin(request),p=new URL(request.url).searchParams;
  const row=await asActor(actor,async c=>(await c.query("SELECT email FROM public.crm_mailbox WHERE id=true")).rows[0]);
  if(!row)return json({connected:false});
  if(p.get("status")==="1")return json({connected:true,email:row.email});
  if(p.has("thread"))return json(await callMailbox(actor,{command:"get_thread",args:{thread_id:str(p.get("thread"),300),include_body:true}}));
  const folder=p.get("folder")==="Sent"?"Sent":"INBOX",cursor=p.get("cursor");
  const args:Record<string,unknown>={folder,limit:25};
  if(cursor)args.cursor=str(cursor,4000);
  if(p.get("unread")==="1")args.is_read=false;
  const data=await callMailbox(actor,{command:"list_threads",args});
  const counters=await callMailbox(actor,{command:"get_counters"});
  return json({connected:true,email:row.email,...data,unread:counters?.folders?.INBOX?.unread??0});
 }catch(e){return responseError(e);}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);const actor=await admin(request);
  const raw=await request.text();if(raw.length>30000)throw new ApiError("Solicitud demasiado larga.",413);
  const v=JSON.parse(raw);
  if(v.action==="connect"){
   const token=str(v.token,1024),refresh=typeof v.refresh==="string"?v.refresh.trim():"";
   if(refresh.length>1024)throw new ApiError("Token inválido.");
   const identity=await mailboxCall(token,{command:"whoami"});
   const email=str(identity?.mailbox?.email,254).toLowerCase();
   if(email.endsWith("@kreyvi.com")||email.split("@")[1]?.endsWith(".kreyvi.com"))throw new ApiError("Usa exclusivamente un dominio comercial independiente.");
   const encrypted=seal({token,refresh,expiresAt:identity?.token?.expires_at||undefined});
   await asActor(actor,async c=>{
    await c.query("SELECT pg_advisory_xact_lock(hashtext('crm-sendcorex-mailbox'))");
    await c.query("INSERT INTO public.crm_mailbox(id,email,secret) VALUES(true,$1,$2) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,secret=EXCLUDED.secret,updated_at=now()",[email,encrypted]);
   });
   return json({connected:true,email});
  }
  if(v.action==="disconnect"){
   await asActor(actor,async c=>{await c.query("SELECT pg_advisory_xact_lock(hashtext('crm-sendcorex-mailbox'))");await c.query("DELETE FROM public.crm_mailbox WHERE id=true");});
   return json({connected:false});
  }
  if(v.action==="read"){
   const id=str(v.id,300);
   const result=await callMailbox(actor,{command:"set_flags",args:{id,is_read:v.read!==false,scope:"thread"}});
   if(result?.failed_count)throw new ApiError("No se pudo cambiar el estado.",502);
   return json({ok:true});
  }
  if(v.action==="reply"){
   const id=str(v.id,300),text=str(v.text,15000);
   const thread=await callMailbox(actor,{command:"get_thread",args:{id,include_body:false}});
   const messages=Array.isArray(thread?.messages)?thread.messages:[];
   const last=messages.find((m:{message_uid?:string})=>m.message_uid===id);
   if(!last||last.direction!=="inbound")throw new ApiError("Selecciona un mensaje recibido.");
   const recipient=String(last.reply_to?.[0]?.email||last.from_email||"").toLowerCase();
   if(!recipient)throw new ApiError("No hay destinatario válido.");
   const blocked=await asActor(actor,async c=>(await c.query("SELECT 1 FROM public.crm_email_exclusions WHERE email=$1",[recipient])).rowCount);
   if(blocked)throw new ApiError("El contacto está excluido de comunicaciones.",409);
   const data=await callMailbox(actor,{command:"reply",args:{id,text,reply_all:false,track_opens:false,track_clicks:false}});
   return json({queued:data?.queued===true});
  }
  throw new ApiError("Acción inválida.");
 }catch(e){return responseError(e);}
}
