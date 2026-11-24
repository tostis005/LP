import {actorFromRequest,asActor,checkOrigin,responseError,ApiError,type Actor} from "@/lib/server/db";
import {foodPilotImport,decodeDenue} from "@/lib/server/denue";
import type {PoolClient} from "pg";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const statuses=["pending_review","qualified","contacted","interested","trial","converted","discarded","do_not_contact"];
async function admin<T>(request:Request,fn:(c:PoolClient,actor:Actor)=>Promise<T>){
 const actor=await actorFromRequest(request);
 if(!actor)throw new ApiError("Inicia sesión.",401);
 return asActor(actor,async c=>{
  if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);
  return fn(c,actor);
 });
}
export async function GET(request:Request){
 try{
  const result=await admin(request,async c=>{
   const p=new URL(request.url).searchParams;
   const where:string[]=[],args:unknown[]=[];
   const add=(column:string,value:string)=>{args.push(value);where.push(column+"=$"+args.length);};
   for(const col of ["country_code","state_code","municipality_code","locality_code","category","status"]){
    const v=p.get(col);if(col==="category"&&v==="pilot_food"){where.push("(activity_code LIKE '7225%' OR activity_code IN ('461170','311520'))");}else if(v)add(col,v.slice(0,120));
   }
   const coverage=p.get("coverage");if(coverage==="missing")where.push("email IS NULL AND public_email IS NULL");if(coverage==="available")where.push("(email IS NOT NULL OR public_email IS NOT NULL)");if(coverage==="web")where.push("public_email IS NOT NULL");
   const search=p.get("q")?.trim().slice(0,120);if(search){args.push("%"+search+"%");where.push("(name ILIKE $"+args.length+" OR email ILIKE $"+args.length+" OR public_email ILIKE $"+args.length+")");}
   const filter=where.length?" WHERE "+where.join(" AND "):"";
   const page=Math.max(0,Math.min(100000,Math.floor(Number(p.get("page"))||0)));
   const count=(await c.query("SELECT count(*)::int AS total,count(DISTINCT lower(COALESCE(email,public_email)))::int AS unique_emails,count(*) FILTER (WHERE email IS NOT NULL OR public_email IS NOT NULL)::int AS with_email,count(*) FILTER (WHERE email IS NULL AND public_email IS NULL)::int AS missing_email FROM public.crm_prospects"+filter,args)).rows[0];
   const prospects=(await c.query("SELECT * FROM public.crm_prospects"+filter+" ORDER BY name,id LIMIT 50 OFFSET $"+(args.length+1),[...args,page*50])).rows;
   const regions=(await c.query("SELECT country_code,state_code,state,municipality_code,municipality,locality_code,city,count(*)::int AS total FROM public.crm_prospects GROUP BY 1,2,3,4,5,6,7 ORDER BY state,municipality,city")).rows;
   const categories=(await c.query("SELECT category,count(*)::int AS total FROM public.crm_prospects GROUP BY 1 ORDER BY 1")).rows;
   const imports=(await c.query("SELECT filename,created_at,report FROM public.crm_import_runs ORDER BY created_at DESC LIMIT 5")).rows;
   return {prospects,count,regions,categories,imports,page};
  });
  return Response.json(result,{headers});
 }catch(e){return responseError(e);}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  // Check authorization before reading any uploaded data.
  await admin(request,async()=>true);
  if(Number(request.headers.get("content-length")||0)>42*1024*1024)throw new ApiError("El archivo supera 40 MB.",413);
  const form=await request.formData(),file=form.get("file"),mode=form.get("mode");
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".csv"))throw new ApiError("Selecciona el CSV oficial descomprimido del DENUE.");
  if(file.size>40*1024*1024)throw new ApiError("Divide el CSV en archivos de hasta 40 MB, conservando la cabecera.",413);
  const municipality=String(form.get("municipality")||"");
  if(municipality&&!/^\d{5}$/.test(municipality))throw new ApiError("Clave municipal inválida.");
  if(mode!=="preview"&&mode!=="import")throw new ApiError("Modo inválido.");
  let data:ReturnType<typeof foodPilotImport>;
  try{data=foodPilotImport(decodeDenue(await file.arrayBuffer()),municipality);}catch(e){throw new ApiError(e instanceof Error?e.message:"CSV inválido.");}
  if(mode==="preview")return Response.json({report:data.report},{headers});
  if(data.report.total===0)throw new ApiError("El archivo no contiene establecimientos válidos para el filtro.");
  const imported=await admin(request,async c=>{
   let changed=0;
   for(let i=0;i<data.prospects.length;i+=500){
    const batch=data.prospects.slice(i,i+500);
    const result=await c.query(
     "INSERT INTO public.crm_prospects(source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website) "+
     "SELECT source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website "+
     "FROM jsonb_to_recordset($1::jsonb) AS x(source_id text,name text,country_code text,state_code text,state text,municipality_code text,municipality text,locality_code text,city text,activity_code text,activity text,category text,email text,website text) "+
     "ON CONFLICT(source,source_id) DO UPDATE SET name=EXCLUDED.name,country_code=EXCLUDED.country_code,state_code=EXCLUDED.state_code,state=EXCLUDED.state,municipality_code=EXCLUDED.municipality_code,municipality=EXCLUDED.municipality,locality_code=EXCLUDED.locality_code,city=EXCLUDED.city,activity_code=EXCLUDED.activity_code,activity=EXCLUDED.activity,category=EXCLUDED.category,email=COALESCE(EXCLUDED.email,crm_prospects.email),website=EXCLUDED.website,updated_at=now(),status=CASE WHEN EXCLUDED.email IS NOT NULL AND crm_prospects.email IS DISTINCT FROM EXCLUDED.email AND crm_prospects.status NOT IN ('do_not_contact','converted','discarded') THEN 'pending_review' ELSE crm_prospects.status END",
     [JSON.stringify(batch)]);
    changed+=result.rowCount||0;
   }
   await c.query("UPDATE public.crm_prospects p SET status='do_not_contact',updated_at=now() WHERE p.status<>'do_not_contact' AND EXISTS (SELECT 1 FROM public.crm_email_exclusions e WHERE e.email IN (lower(p.email),lower(p.public_email)))");
   await c.query("INSERT INTO public.crm_import_runs(filename,report) VALUES($1,$2::jsonb)",[file.name.slice(0,240),JSON.stringify(data.report)]);
   return changed;
  });
  return Response.json({report:data.report,imported},{headers});
 }catch(e){return responseError(e);}
}
export async function PATCH(request:Request){
 try{
  checkOrigin(request);
  const raw=await request.text();if(raw.length>5000)throw new ApiError("Solicitud demasiado larga.",413);
  const v=JSON.parse(raw) as {id?:string;status?:string;notes?:string;public_email?:string;public_email_source?:string};
  if(typeof v.id!=="string"||!/^[0-9a-f-]{36}$/i.test(v.id)||typeof v.status!=="string"||!statuses.includes(v.status)||typeof v.notes!=="string"||v.notes.length>2000)throw new ApiError("Datos no válidos.");
  await admin(request,async c=>{
   const hasEvidence=v.public_email!==undefined||v.public_email_source!==undefined;
   let email:string|null=null,source:string|null=null;
   if(hasEvidence){
    if(typeof v.public_email!=="string"||typeof v.public_email_source!=="string")throw new ApiError("Datos de contacto incompletos.");
    email=v.public_email.trim().toLowerCase()||null;source=v.public_email_source.trim()||null;
    if((email===null)!==(source===null))throw new ApiError("Indica el correo publicado y su fuente.");
    if(email&&(!/^[^\s@,;<>]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)||email.length>254))throw new ApiError("Correo inválido.");
    if(source){let u:URL;try{u=new URL(source);}catch{throw new ApiError("URL de fuente inválida.");}if(!["https:","http:"].includes(u.protocol)||u.username||u.password||source.length>2048)throw new ApiError("URL de fuente inválida.");}
   }
   const r=await c.query("UPDATE public.crm_prospects SET status=$2,notes=$3,updated_at=now()"+(hasEvidence?",public_email=$4,public_email_source=$5,public_email_checked_at=CASE WHEN $4::text IS NULL THEN NULL ELSE now() END":"")+" WHERE id=$1::uuid AND (status<>'do_not_contact' OR $2='do_not_contact') RETURNING id",hasEvidence?[v.id,v.status,v.notes,email,source]:[v.id,v.status,v.notes]);
   if(!r.rowCount)throw new ApiError("Contacto no encontrado o excluido de comunicaciones.",404);
   if(v.status==="do_not_contact"){
    await c.query("INSERT INTO public.crm_email_exclusions(email) SELECT lower(a) FROM public.crm_prospects p CROSS JOIN LATERAL unnest(ARRAY[p.email,p.public_email]) AS t(a) WHERE p.id=$1::uuid AND a IS NOT NULL ON CONFLICT DO NOTHING",[v.id]);
    await c.query("UPDATE public.crm_prospects SET status='do_not_contact',updated_at=now() WHERE EXISTS (SELECT 1 FROM public.crm_email_exclusions e WHERE e.email IN (lower(crm_prospects.email),lower(crm_prospects.public_email)))",[v.id]);
   }
   await c.query("UPDATE public.crm_prospects p SET status='do_not_contact',updated_at=now() WHERE p.status<>'do_not_contact' AND EXISTS (SELECT 1 FROM public.crm_email_exclusions e WHERE e.email IN (lower(p.email),lower(p.public_email)))");
  });
  return Response.json({ok:true},{headers});
 }catch(e){return responseError(e);}
}
