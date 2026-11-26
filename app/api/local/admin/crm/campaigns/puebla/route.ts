import {randomUUID} from "node:crypto";
import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {callMailbox} from "@/lib/server/crm-mailbox";
import {pueblaHtml,pueblaSubject} from "@/lib/server/crm-puebla-template";
import type {PoolClient} from "pg";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const json=(data:unknown)=>Response.json(data,{headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Candidate={id:string;name:string;email:string;category:string;activity:string;source_url:string;status:string};
async function admin(request:Request){
 const actor=await actorFromRequest(request);
 if(!actor)throw new ApiError("Inicia sesión.",401);
 await asActor(actor,async c=>{if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);});
 return actor;
}
// Prefer verified public business addresses and relevant sectors. Never use the CSV as live state.
async function candidates(c:PoolClient,id:string|null=null):Promise<Candidate[]>{
 const sql="SELECT p.id,p.name,lower(trim(p.public_email)) AS email,p.category,p.activity,p.public_email_source AS source_url,p.status FROM public.crm_prospects p "+
 "WHERE p.country_code='MX' AND lower(trim(p.state))='puebla' AND lower(trim(p.municipality))='puebla' "+
 "AND lower(trim(p.city)) IN ('puebla','heroica puebla de zaragoza','puebla de zaragoza') "+
 "AND p.status IN ('qualified','pending_review') AND p.contact_review='source_found' "+
 "AND p.public_email_checked_at IS NOT NULL AND p.public_email_source ~ '^https?://' "+
 "AND p.public_email IS NOT NULL AND lower(trim(p.public_email)) ~ '^[^[:space:]@,;<>]+@[a-z0-9.-]+[.][a-z]{2,}$' "+
 "AND (p.activity_code LIKE '7225%' OR p.activity_code IN ('461170','311520') OR p.category IN ('Restaurantes y cafeterías','Heladerías') OR p.category ~* 'panader|pasteler') "+
 "AND ($1::uuid IS NULL OR p.id=$1::uuid) "+
 "AND NOT EXISTS (SELECT 1 FROM public.crm_email_exclusions x WHERE x.email IN (lower(trim(p.email)),lower(trim(p.public_email)))) "+
 "AND NOT EXISTS (SELECT 1 FROM public.crm_mail_attempts a WHERE a.recipient IN (lower(trim(p.email)),lower(trim(p.public_email)))) "+
 "AND NOT EXISTS (SELECT 1 FROM public.crm_mail_history h WHERE h.direction='outbound' AND h.correspondent IN (lower(trim(p.email)),lower(trim(p.public_email)))) "+
 "AND NOT EXISTS (SELECT 1 FROM public.crm_prospects q WHERE q.id<>p.id AND lower(trim(p.public_email)) IN (lower(trim(q.email)),lower(trim(q.public_email)))) "+
 "ORDER BY CASE WHEN p.activity ~* 'caf[eé]|cafeter|panader|pasteler|helad|never[ií]' OR p.category ~* 'helad|panader|pasteler' THEN 0 ELSE 1 END, CASE WHEN p.status='qualified' THEN 0 ELSE 1 END, lower(p.name),p.id LIMIT 30";
 return (await c.query<Candidate>(sql,[id])).rows;
}
async function remaining(c:PoolClient){
 const n=Number((await c.query("SELECT count(*)::int AS n FROM public.crm_mail_attempts WHERE created_at>now()-interval '24 hours'")).rows[0].n);
 return Math.max(0,30-n);
}
export async function GET(request:Request){
 try{
  const actor=await admin(request);
  return json(await asActor(actor,async c=>{
   const mailbox=(await c.query("SELECT email FROM public.crm_mailbox WHERE id=true")).rows[0];
   return {sender:mailbox?.email??null,remaining:await remaining(c),subject:pueblaSubject,candidates:await candidates(c)};
  }));
 }catch(e){return responseError(e);}
}
// One prospect per request. Client must explicitly approve the address, lawful outreach and fiscal address.
// Reserve attempt BEFORE the external call; a timeout is ambiguous and never retried automatically.
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await admin(request);
  const raw=await request.text();
  if(raw.length>4000)throw new ApiError("Solicitud demasiado larga.",413);
  const v=JSON.parse(raw);
  if(!v||typeof v.id!=="string"||!uuid.test(v.id)||typeof v.email!=="string"||v.email.length>254||v.permitted!==true)throw new ApiError("Selecciona un contacto y confirma que el contacto comercial está permitido.");
  const address=typeof v.fiscalAddress==="string"?v.fiscalAddress.trim():"";
  if(address.length<10||address.length>500||/[{}]/.test(address)||/https?:\/\//i.test(address))throw new ApiError("Introduce la dirección fiscal real.");
  const reserved=await asActor(actor,async c=>{
   await c.query("SELECT pg_advisory_xact_lock(hashtext('crm-sendcorex-send'))");
   const row=(await candidates(c,v.id))[0];
   if(!row||row.email!==v.email.trim().toLowerCase())throw new ApiError("El contacto ya no es elegible; actualiza la selección.",409);
   const mailbox=(await c.query("SELECT email FROM public.crm_mailbox WHERE id=true")).rows[0];
   const domain=String(mailbox?.email||"").toLowerCase().split("@")[1];
   if(!domain||domain==="kreyvi.com"||domain.endsWith(".kreyvi.com")||domain==="kreyviapp.com"||domain.endsWith(".kreyviapp.com"))throw new ApiError("Configura el buzón comercial independiente.");
   if(!(await remaining(c)))throw new ApiError("Límite del CRM: 30 intentos en 24 horas.",429);
   const attempt=randomUUID();
   await c.query("INSERT INTO public.crm_mail_attempts(id,recipient) VALUES($1::uuid,$2)",[attempt,row.email]);
   return {row,attempt};
  });
  const data=await callMailbox(actor,{command:"send_email",args:{to:reserved.row.email,to_name:reserved.row.name,subject:pueblaSubject,html:pueblaHtml(reserved.row.name,address),unsubscribe:true,track_opens:false,track_clicks:false}});
  // The existing history sync records delivery and updates status, not this provisional acknowledgement.
  return json({attempt:reserved.attempt,id:reserved.row.id,queued:data?.queued===true,message_uid:data?.message_uid??null});
 }catch(e){return responseError(e);}
}
