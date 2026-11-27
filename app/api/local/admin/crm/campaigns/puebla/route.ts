import {randomUUID,createHmac,timingSafeEqual} from "node:crypto";
import {actorFromRequest,asActor,authPool,checkOrigin,responseError,ApiError,type Actor} from "@/lib/server/db";
import {callMailbox,mailboxFailureCode} from "@/lib/server/crm-mailbox";
import {pueblaHtml,pueblaSubject} from "@/lib/server/crm-puebla-template";
import type {PoolClient} from "pg";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const json=(data:unknown)=>Response.json(data,{headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// kreyviapp.com is a distinct commercial domain; only the main kreyvi.com
// domain and its subdomains are prohibited for first-contact outreach.
function commercialSenderAllowed(email:unknown){
 const domain=String(email||"").trim().toLowerCase().split("@")[1];
 return !!domain&&domain!=="kreyvi.com"&&!domain.endsWith(".kreyvi.com");
}
type Candidate={id:string;name:string;email:string;category:string;activity:string;source_url:string;status:string};
async function admin(request:Request){
 const actor=await actorFromRequest(request);
 if(!actor)throw new ApiError("Inicia sesión.",401);
 await asActor(actor,async c=>{if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);});
 return actor;
}
// Prefer verified public business addresses and relevant sectors. Never use the CSV as live state.
async function candidates(c:PoolClient,id:string|null=null,limit:number|null=30):Promise<Candidate[]>{
 const sql="WITH eligible AS (SELECT p.id,p.name,lower(btrim(p.public_email)) AS email,p.category,p.activity,p.public_email_source AS source_url,p.status, "+
 "CASE WHEN p.activity ~* 'caf[eé]|cafeter|panader|pasteler|helad|never[ií]' OR p.category ~* 'helad|panader|pasteler' THEN 0 ELSE 1 END AS priority, CASE WHEN p.status='qualified' THEN 0 ELSE 1 END AS stage_priority "+
 "FROM public.crm_prospects p WHERE p.country_code='MX' AND lower(trim(p.state))='puebla' AND lower(trim(p.municipality))='puebla' "+
 "AND lower(trim(p.city)) IN ('puebla','heroica puebla de zaragoza','puebla de zaragoza') "+
 "AND p.closed_at IS NULL AND p.status IN ('qualified','pending_review') AND p.contact_review='source_found' "+
 "AND p.public_email_checked_at IS NOT NULL AND p.public_email_source ~ '^https?://' "+
 "AND p.public_email IS NOT NULL AND lower(trim(p.public_email)) ~ '^[^[:space:]@,;<>]+@[a-z0-9.-]+[.][a-z]{2,}$' "+
 "AND (p.activity_code LIKE '7225%' OR p.activity_code IN ('461170','311520') OR p.category IN ('Restaurantes y cafeterías','Heladerías') OR p.category ~* 'panader|pasteler') "+
 "AND ($1::uuid IS NULL OR p.id=$1::uuid) "+
 "AND NOT public.crm_email_blocked_for_first_contact(p.public_email) "+
 "AND (nullif(btrim(p.email),'') IS NULL OR NOT public.crm_email_blocked_for_first_contact(p.email))"+
 "), unique_email AS (SELECT DISTINCT ON (email) * FROM eligible ORDER BY email,priority,stage_priority,lower(name),id) "+
 "SELECT id,name,email,category,activity,source_url,status FROM unique_email ORDER BY priority,stage_priority,lower(name),id LIMIT $2::integer";
 return (await c.query<Candidate>(sql,[id,limit])).rows;
}
async function remaining(c:PoolClient){
 const n=Number((await c.query("SELECT count(*)::int AS n FROM public.crm_mail_attempts WHERE created_at>now()-interval '24 hours'")).rows[0].n);
 const config=(await c.query("SELECT daily_limit FROM public.crm_github_channel WHERE id=true")).rows[0];
 return config?.daily_limit===null?null:Math.max(0,Number(config?.daily_limit??30)-n);
}
export async function GET(request:Request){
 try{
  const actor=await admin(request);
  return json(await asActor(actor,async c=>{
   const mailbox=(await c.query("SELECT email FROM public.crm_mailbox WHERE id=true")).rows[0];
   const github=(await c.query("SELECT enabled,fiscal_address,daily_limit FROM public.crm_github_channel WHERE id=true")).rows[0];
   return {sender:mailbox?.email??null,remaining:await remaining(c),subject:pueblaSubject,candidates:await candidates(c),github:{enabled:github?.enabled===true,fiscalAddress:github?.fiscal_address??"",dailyLimit:github?github.daily_limit:30}};
  }));
 }catch(e){return responseError(e);}
}

function fiscal(value:unknown){
 const address=typeof value==="string"?value.trim():"";
 if(address.length<10||address.length>500||/[{}]/.test(address)||/https?:\/\//i.test(address))throw new ApiError("Introduce la dirección fiscal real.");
 return address;
}
async function sendOne(actor:Actor,id:string,email:string,address:string,viaGithub=false){
 const reserved=await asActor(actor,async c=>{
  await c.query("SELECT pg_advisory_xact_lock(hashtext('crm-sendcorex-send'))");
  if(viaGithub){
   const config=(await c.query("SELECT enabled,authorized_by,fiscal_address FROM public.crm_github_channel WHERE id=true")).rows[0];
   if(!config?.enabled||config.authorized_by!==actor.id||config.fiscal_address!==address)throw new ApiError("Canal desactivado o modificado.",403);
  }
  const row=(await candidates(c,id))[0];
  if(!row||row.email!==email.trim().toLowerCase())throw new ApiError("El contacto ya no es elegible; actualiza la selección.",409);
  const mailbox=(await c.query("SELECT email FROM public.crm_mailbox WHERE id=true")).rows[0];
  if(!commercialSenderAllowed(mailbox?.email))throw new ApiError("Configura el buzón comercial independiente.");
  if((await remaining(c))===0)throw new ApiError("Límite diario configurado del CRM alcanzado.",429);
  const attempt=randomUUID();
  await c.query("INSERT INTO public.crm_mail_attempts(id,recipient) VALUES($1::uuid,$2)",[attempt,row.email]);
  return {row,attempt};
 });
 const data=await callMailbox(actor,{command:"send_email",args:{to:reserved.row.email,to_name:reserved.row.name,subject:pueblaSubject,html:pueblaHtml(reserved.row.name,address),unsubscribe:true,track_opens:false,track_clicks:false}});
 if(data?.queued===true)await asActor(actor,async c=>{await c.query("SELECT public.crm_record_contacted_email($1)",[reserved.row.email]);});
 return {attempt:reserved.attempt,id:reserved.row.id,queued:data?.queued===true,message_uid:data?.message_uid??null};
}
// Separate HMAC domain from the existing read-only mail synchronization. The
// worker signs locally using the private Docker credential; no token leaves Contabo.
async function githubCommand(request:Request,raw:string){
 const time=request.headers.get("x-crm-github-time")||"",sig=request.headers.get("x-crm-github-signature")||"",secret=process.env.AUTH_PGPASSWORD;
 if(!secret||!/^\d{13}$/.test(time)||Math.abs(Date.now()-Number(time))>60000||!/^[a-f0-9]{64}$/.test(sig))return json({state:"unauthorized",queued:0});
 const expected=createHmac("sha256",secret).update("crm-github-command-v1:"+time+":"+raw).digest();
 if(!timingSafeEqual(expected,Buffer.from(sig,"hex")))return json({state:"unauthorized",queued:0});
 const v=JSON.parse(raw);
 if(!v||!["preview","send"].includes(v.command)||typeof v.orderId!=="string"||!/^[0-9]{1,20}$/.test(v.orderId)||Object.keys(v).length!==(v.command==="send"?3:2)||v.command==="send"&&(!Number.isInteger(v.count)||v.count<1||v.count>2147483647))return json({state:"invalid",queued:0});
 const user=(await authPool.query("SELECT id,email,raw_user_meta_data FROM auth.users WHERE id=COALESCE(public.crm_github_actor(),public.crm_mail_sync_actor()) AND email_confirmed_at IS NOT NULL")).rows[0];
 if(!user)return json({state:"not_ready",queued:0});
 const actor:Actor={id:user.id,email:user.email,user_metadata:user.raw_user_meta_data||{}};
 const plan=await asActor(actor,async c=>{
  if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)return null;
  const config=(await c.query("SELECT enabled,authorized_by,fiscal_address FROM public.crm_github_channel WHERE id=true")).rows[0];
  const mailbox=(await c.query("SELECT email FROM public.crm_mailbox WHERE id=true")).rows[0];
  const connected=!!mailbox;
  const capacity=await remaining(c),requested=v.command==="send"?v.count:null;
  const limit=capacity===null?requested:requested===null?capacity:Math.min(capacity,requested);
  const rows=await candidates(c,null,limit);
  return {enabled:config?.enabled===true&&config.authorized_by===actor.id,address:String(config?.fiscal_address||""),connected,senderAllowed:commercialSenderAllowed(mailbox?.email),senderEmail:String(mailbox?.email||"").toLowerCase(),rows};
 });
 if(!plan||!plan.connected)return json({state:"not_ready",queued:0});
 if(!plan.senderAllowed)return json({state:"not_ready",queued:0,reason:"CRM_REJECTED_400"});
 if(v.command==="preview"){
  let reason="NONE";
  if(plan.enabled){
   try{const identity=await callMailbox(actor,{command:"whoami"});if(String(identity?.mailbox?.email||"").toLowerCase()!==plan.senderEmail)reason="CRM_REJECTED_409";}
   catch(e){reason=mailboxFailureCode(e);}
  }
  return json({state:plan.enabled?(reason==="NONE"?"enabled":"not_ready"):"disabled",eligible:plan.rows.length,queued:0,reason});
 }
 if(!plan.enabled)return json({state:"disabled",queued:0});
 const address=fiscal(plan.address);
 try{const identity=await callMailbox(actor,{command:"whoami"});if(String(identity?.mailbox?.email||"").toLowerCase()!==plan.senderEmail)return json({state:"not_ready",queued:0,reason:"CRM_REJECTED_409"});}catch(e){return json({state:"not_ready",queued:0,reason:mailboxFailureCode(e)});}
 // The comment ID is durable and stable even when an Actions run is retried.
 const inserted=await asActor(actor,async c=>(await c.query("INSERT INTO public.crm_github_orders(order_id,requested_count) VALUES($1,$2) ON CONFLICT DO NOTHING",[v.orderId,v.count])).rowCount);
 if(!inserted)return json({state:"already_processed",queued:0});
 let queued=0,state="completed",reason="NONE";const deadline=Date.now()+45*60*1000;
 for(const row of plan.rows){
  if(Date.now()>=deadline){state="stopped";reason="DEADLINE";break;}
  try{
   const result=await sendOne(actor,row.id,row.email,address,true);
   if(!result.queued){state="stopped";reason="QUEUE_UNCONFIRMED";break;}
   queued++;
   await asActor(actor,async c=>{await c.query("UPDATE public.crm_github_orders SET queued=$2 WHERE order_id=$1",[v.orderId,queued]);});
  }catch(e){state="stopped";reason=mailboxFailureCode(e);break;}
 }
 await asActor(actor,async c=>{await c.query("UPDATE public.crm_github_orders SET state=$2,queued=$3 WHERE order_id=$1",[v.orderId,state,queued]);});
 return json({state,queued,eligible:plan.rows.length,reason});
}
export async function POST(request:Request){
 try{
  const raw=await request.text();
  if(raw.length>4000)throw new ApiError("Solicitud demasiado larga.",413);
  if(request.headers.has("x-crm-github-signature"))return await githubCommand(request,raw);
  checkOrigin(request);
  const actor=await admin(request);
  const v=JSON.parse(raw);
  if(v?.action==="configure_github"){
   if(v.enabled===false){
    await asActor(actor,async c=>{await c.query("SELECT pg_advisory_xact_lock(hashtext('crm-sendcorex-send'))");await c.query("UPDATE public.crm_github_channel SET enabled=false,updated_at=now() WHERE id=true");});
    return json({enabled:false});
   }
   if(v.enabled!==true||v.permitted!==true)throw new ApiError("Confirma autorización para los futuros envíos elegibles.");
   const address=fiscal(v.fiscalAddress);
   const dailyLimit=v.dailyLimit===undefined?30:v.dailyLimit;
   if(dailyLimit!==null&&(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>2147483647))throw new ApiError("Límite diario inválido.");
   await asActor(actor,async c=>{
    await c.query("SELECT pg_advisory_xact_lock(hashtext('crm-sendcorex-send'))");
    await c.query("INSERT INTO public.crm_github_channel(id,authorized_by,fiscal_address,enabled,daily_limit) VALUES(true,$1::uuid,$2,true,$3) ON CONFLICT(id) DO UPDATE SET authorized_by=EXCLUDED.authorized_by,fiscal_address=EXCLUDED.fiscal_address,enabled=true,daily_limit=EXCLUDED.daily_limit,updated_at=now()",[actor.id,address,dailyLimit]);
   });
   return json({enabled:true});
  }
  if(!v||typeof v.id!=="string"||!uuid.test(v.id)||typeof v.email!=="string"||v.email.length>254||v.permitted!==true)throw new ApiError("Selecciona un contacto y confirma que el contacto comercial está permitido.");
  return json(await sendOne(actor,v.id,v.email,fiscal(v.fiscalAddress)));
 }catch(e){
  // Never expose internal provider/recipient errors in the public Actions log.
  if(request.headers.has("x-crm-github-signature"))return json({state:"error",queued:0,reason:mailboxFailureCode(e)});
  return responseError(e);
 }
}
