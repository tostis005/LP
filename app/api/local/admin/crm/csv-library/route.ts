import {actorFromRequest,asActor,checkOrigin,ApiError,responseError} from "@/lib/server/db";
import {listCityCsvs,readCityCsv} from "@/lib/server/crm-csv-library";
import {parseContactCsv,contactBatch} from "@/lib/server/crm-contact-batch";
import {compatibleDenueImport,decodeDenue} from "@/lib/server/denue";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
async function admin<T>(request:Request,fn:(c:PoolClient)=>Promise<T>){
 const actor=await actorFromRequest(request);
 if(!actor)throw new ApiError("Inicia sesión.",401);
 return asActor(actor,async c=>{
  if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);
  return fn(c);
 });
}
export async function GET(request:Request){
 try{
  return Response.json(await admin(request,async c=>{
   const files=await listCityCsvs();
   const history=(await c.query("SELECT filename,created_at,report FROM public.crm_import_runs WHERE source IN ('WEB','DENUE') AND report ? 'sha256' ORDER BY created_at DESC")).rows;
   return {files:files.map(f=>{
    const latest=history.find(h=>h.filename===f.filename);
    const exact=history.find(h=>h.filename===f.filename&&h.report.sha256===f.sha256);
    return {...f,status:exact?"imported":latest?"updated":"pending",lastImport:exact||latest||null};
   })};
  }),{headers});
 }catch(e){return responseError(e);}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  return await admin(request,async c=>{
   const raw=await request.text();if(raw.length>8192)throw new ApiError("Solicitud demasiado larga.",413);
   const v=JSON.parse(raw);
   if(!v||typeof v.filename!=="string"||typeof v.sha256!=="string"||!/^[a-f0-9]{64}$/.test(v.sha256)||!["preview","apply"].includes(v.mode))throw new ApiError("Solicitud inválida.");
   if(v.mode==="apply"&&(v.confirm!==true||typeof v.plan!=="string"||!/^[a-f0-9]{64}$/.test(v.plan)))throw new ApiError("Confirma la vista previa de esta versión.");
   const file=await readCityCsv(v.filename);
   if(file.sha256!==v.sha256)throw new ApiError("El archivo ha cambiado. Actualiza la biblioteca.",409);
   const officialName=/^denue-(\d{5})\.csv$/i.exec(file.filename);
   if(officialName){
    const scope=officialName[1];
    const parsed=compatibleDenueImport(decodeDenue(Uint8Array.from(file.data).buffer),scope);
    if(!parsed.prospects.length||parsed.report.total===0)throw new ApiError("El CSV no contiene negocios compatibles del municipio indicado.");
    if(v.mode==="apply"){
     await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-crm-web-business'))");
     await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-denue-import'))");
     if((await c.query("SELECT 1 FROM public.crm_import_runs WHERE filename=$1 AND report->>'sha256'=$2",[file.filename,file.sha256])).rowCount)throw new ApiError("Esta versión ya se ha importado.",409);
    }
    const ids=parsed.prospects.map(p=>p.source_id);
    const current=(await c.query("SELECT source_id FROM public.crm_prospects WHERE source='DENUE' AND source_id=ANY($1::text[]) ORDER BY source_id",[ids])).rows.map(r=>String(r.source_id));
    const plan=createHash("sha256").update(file.sha256+":"+JSON.stringify(current)).digest("hex");
    const counts={update:current.length,create:ids.length-current.length,skip:0};
    const base={plan,total:ids.length,counts,reasons:{},decisions:[]};
    if(v.mode==="preview")return Response.json(base,{headers});
    if(v.plan!==plan)throw new ApiError("La base cambió. Vuelve a analizar el archivo.",409);
    for(let i=0;i<parsed.prospects.length;i+=500){
     await c.query("INSERT INTO public.crm_prospects(source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website) SELECT source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website FROM jsonb_to_recordset($1::jsonb) AS x(source_id text,name text,country_code text,state_code text,state text,municipality_code text,municipality text,locality_code text,city text,activity_code text,activity text,category text,email text,website text) ON CONFLICT(source,source_id) DO UPDATE SET name=EXCLUDED.name,state_code=EXCLUDED.state_code,state=EXCLUDED.state,municipality_code=EXCLUDED.municipality_code,municipality=EXCLUDED.municipality,locality_code=EXCLUDED.locality_code,city=EXCLUDED.city,activity_code=EXCLUDED.activity_code,activity=EXCLUDED.activity,category=EXCLUDED.category,email=COALESCE(EXCLUDED.email,crm_prospects.email),website=COALESCE(NULLIF(EXCLUDED.website,''),crm_prospects.website),updated_at=now()",[JSON.stringify(parsed.prospects.slice(i,i+500))]);
    }
    await c.query("UPDATE public.crm_prospects p SET status='do_not_contact',updated_at=now() WHERE p.status<>'do_not_contact' AND EXISTS (SELECT 1 FROM public.crm_email_exclusions e WHERE e.email IN (lower(p.email),lower(p.public_email)))");
    await c.query("INSERT INTO public.crm_import_runs(filename,report) VALUES($1,$2::jsonb)",[file.filename,JSON.stringify({...parsed.report,scope,sha256:file.sha256,total:ids.length,updated:counts.update,created:counts.create,skipped:0})]);
    return Response.json({...base,updated:counts.update,created:counts.create,skipped:0},{headers});
   }
   const candidates=parseContactCsv(new TextDecoder("utf-8",{fatal:true}).decode(file.data));
   const data=await contactBatch(c,candidates,v.mode==="apply"?"all":undefined,{filename:file.filename,sha256:file.sha256,plan:v.mode==="apply"?v.plan:undefined});
   const counts={update:0,create:0,skip:0},reasons:Record<string,number>={};
   for(const d of data.decisions){counts[d.action]++;if(d.action==="skip")reasons[d.reason]=(reasons[d.reason]||0)+1;}
   return Response.json({...data,decisions:data.decisions.slice(0,50),total:data.decisions.length,counts,reasons},{headers});
  });
 }catch(e){return responseError(e);}
}
