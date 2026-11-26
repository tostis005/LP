import {ApiError} from "./db";
import type {PoolClient} from "pg";
const pilot="source='DENUE' AND country_code='MX' AND state_code='02' AND municipality_code='003' AND (activity_code LIKE '7225%' OR activity_code IN ('461170','311520'))";
const reviewStates=["source_found","no_contact_found","ambiguous","not_relevant"] as const;
type Review=typeof reviewStates[number];
type Evidence={source_id:string;review:Review;source_url:string;public_email:string|null};


export function parseEvidence(raw:unknown):Evidence[]{
 if(!Array.isArray(raw)||raw.length<1||raw.length>25)throw new ApiError("Indica entre 1 y 25 revisiones.");
 const seen=new Set<string>();
 return raw.map(item=>{
  if(!item||typeof item!=="object")throw new ApiError("Revisión inválida.");
  const v=item as Record<string,unknown>;
  if(typeof v.source_id!=="string"||!/^\d{1,20}$/.test(v.source_id)||seen.has(v.source_id))throw new ApiError("ID DENUE inválido o repetido.");
  seen.add(v.source_id);
  if(typeof v.review!=="string"||!reviewStates.includes(v.review as Review))throw new ApiError("Resultado de revisión inválido.");
  if(typeof v.source_url!=="string"||v.source_url.length>2048)throw new ApiError("Fuente inválida.");
  let url:URL;try{url=new URL(v.source_url);}catch{throw new ApiError("Fuente inválida.");}
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password)throw new ApiError("Fuente inválida.");
  const email=v.public_email;
  if(email!==null&&(typeof email!=="string"||email.length>254||!/^[^\s@,;<>]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)))throw new ApiError("Correo inválido.");
  if((v.review==="source_found")!==(email!==null))throw new ApiError("El resultado debe corresponder a la evidencia del correo.");
  return {source_id:v.source_id,review:v.review as Review,source_url:url.href,public_email:email===null?null:email.toLowerCase()};
 });
}


export async function researchQueue(c:PoolClient,after:string){
   if(after&&!/^\d{1,20}$/.test(after))throw new ApiError("Cursor inválido.");
   const stats=(await c.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE email IS NOT NULL OR public_email IS NOT NULL)::int AS with_email,count(*) FILTER(WHERE contact_review<>'pending')::int AS reviewed FROM public.crm_prospects WHERE "+pilot)).rows[0];
   const rows=(await c.query("SELECT source_id,name,city,municipality,state,activity_code,activity,website FROM public.crm_prospects WHERE "+pilot+" AND status NOT IN ('do_not_contact','discarded','converted') AND contact_review='pending' AND email IS NULL AND public_email IS NULL AND source_id>$1 ORDER BY source_id LIMIT 25",[after])).rows;
   return {scope:"02003",stats,rows,next:rows.length===25?rows.at(-1).source_id:null};
}
export async function recordResearch(c:PoolClient,reviews:Evidence[]){
   await c.query("SELECT pg_advisory_xact_lock(hashtext('crm-sendcorex-send'))");
   const out:Array<{source_id:string;result:string}>=[];
   for(const v of reviews){
    const r=await c.query("SELECT id,status,email,public_email FROM public.crm_prospects WHERE "+pilot+" AND source_id=$1 FOR UPDATE",[v.source_id]);
    const p=r.rows[0];
    if(!p){out.push({source_id:v.source_id,result:"not_found"});continue;}
    if(["do_not_contact","discarded","converted"].includes(p.status)){out.push({source_id:v.source_id,result:"excluded"});continue;}
    if(p.email||p.public_email&&p.public_email!==v.public_email){out.push({source_id:v.source_id,result:"existing_contact"});continue;}
    if(v.public_email){
     const blocked=await c.query("SELECT 1 FROM public.crm_email_exclusions WHERE email=$1",[v.public_email]);
     if(blocked.rowCount){out.push({source_id:v.source_id,result:"excluded"});continue;}
     await c.query("UPDATE public.crm_prospects SET public_email=$2,public_email_source=$3,public_email_checked_at=CASE WHEN public_email IS DISTINCT FROM $2 OR public_email_source IS DISTINCT FROM $3 THEN now() ELSE public_email_checked_at END,contact_review='source_found',contact_review_url=$3,contact_reviewed_at=now(),updated_at=now() WHERE id=$1",[p.id,v.public_email,v.source_url]);
    }else{
     await c.query("UPDATE public.crm_prospects SET contact_review=$2,contact_review_url=$3,contact_reviewed_at=now(),updated_at=now() WHERE id=$1",[p.id,v.review,v.source_url]);
    }
    out.push({source_id:v.source_id,result:"recorded"});
   }
   return out;
}
