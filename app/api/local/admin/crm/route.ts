import {actorFromRequest,asActor,checkOrigin,responseError,ApiError,type Actor} from "@/lib/server/db";
import {foodPilotImport,compatibleDenueImport,decodeDenue} from "@/lib/server/denue";
import {downloadOfficialCsv,officialCities} from "@/lib/server/denue-download";
import type {PoolClient} from "pg";
import {crmDirectoryCount,type CrmDirectoryCount} from "@/lib/server/crm-directory-metrics";
export const runtime="nodejs";
export const dynamic="force-dynamic";
let officialImportRunning=false;
const headers={"Cache-Control":"no-store"};
const statuses=["pending_review","qualified","contacted","interested","trial","converted","discarded","do_not_contact"];
const reviewStates=["pending","source_found","no_contact_found","ambiguous","not_relevant"];
// Public sort keys are mapped to fixed SQL expressions; no request text is interpolated.
const sortColumns:Record<string,string>={
 origin:"lower(origin)",name:"lower(name)",state:"lower(state)",municipality:"lower(municipality)",city:"lower(city)",neighborhood:"lower(neighborhood)",
 category:"lower(category)",activity:"lower(activity)",email:"lower(COALESCE(NULLIF(public_email,''),NULLIF(email,'')))",
 phone:"NULLIF(phone,'')",address:"lower(NULLIF(address,''))",website:"lower(NULLIF(website,''))",
 status:"CASE status WHEN 'pending_review' THEN 'Sin contactar' WHEN 'qualified' THEN 'Sin contactar revisado' WHEN 'contacted' THEN 'Contactado' WHEN 'interested' THEN 'Interesado' WHEN 'trial' THEN 'En prueba' WHEN 'converted' THEN 'Cliente' WHEN 'discarded' THEN 'No interesado' WHEN 'do_not_contact' THEN 'No contactar' ELSE status END",
 review:"contact_review"
};
const pageSizes=[25,50,100,200];
// Only authorized platform administrators can read this shared directory.
// Cache compact aggregate data, not prospect rows. Expire quickly to pick up external imports.
type Aggregate=CrmDirectoryCount;
const countCache=new Map<string,{expires:number;data:Aggregate}>();
let optionsCache:{expires:number;data:{regions:Record<string,unknown>[];categories:Record<string,unknown>[];officialImports:unknown[];closedCount:number}}|undefined;
function clearCounts(){countCache.clear();optionsCache=undefined;}

async function admin<T>(request:Request,fn:(c:PoolClient,actor:Actor)=>Promise<T>){
 const actor=await actorFromRequest(request);
 if(!actor)throw new ApiError("Inicia sesión.",401);
 return asActor(actor,async c=>{
  if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);
  return fn(c,actor);
 });
}
async function crmReader<T>(request:Request,fn:(c:PoolClient,restricted:boolean)=>Promise<T>){const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);return asActor(actor,async c=>{const r=(await c.query("SELECT public.is_platform_admin() AS admin,public.crm_marketing_active() AS marketing")).rows[0];if(!r.admin&&!r.marketing)throw new ApiError("Sin acceso al CRM.",403);return fn(c,!r.admin);});}
export async function GET(request:Request){
 try{
  const result=await crmReader(request,async (c,restricted)=>{
   const p=new URL(request.url).searchParams;
   // Fetch only the clicked marker's contact data, using the same scoped RLS reader.
   if(p.get("view")==="contact"){
    const id=p.get("id")||"";
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new ApiError("Negocio no válido.",400);
    const contact=(await c.query("SELECT id,name,category,activity,address,neighborhood,city,municipality,state,postal_code,phone,email,public_email,website,instagram,status,notes,origin,closed_at,facebook,whatsapp,source_url,source_data FROM public.crm_prospects WHERE id=$1::uuid",[id])).rows[0];
    if(!contact)throw new ApiError("Negocio no disponible en tu zona.",404);
    return {contact};
   }
   if(p.get("view")==="options"){
    if(!restricted&&optionsCache&&optionsCache.expires>Date.now()&&p.get("refresh")!=="1")return optionsCache.data;
    const regions=(await c.query("SELECT country_code,state_code,state,municipality_code,municipality,locality_code,city,count(*)::int AS total FROM public.crm_prospects GROUP BY 1,2,3,4,5,6,7 ORDER BY state,municipality,city")).rows;
    const categories=(await c.query("SELECT category,count(*)::int AS total FROM public.crm_prospects GROUP BY 1 ORDER BY 1")).rows;
    const officialImports=restricted?[]:(await c.query("SELECT DISTINCT report->>\x27scope\x27 AS scope FROM public.crm_import_runs WHERE filename IN (\x27DENUE León 2025-05\x27)")).rows.map(r=>r.scope);
    const closedCount=Number((await c.query("SELECT count(*)::int AS n FROM public.crm_prospects WHERE closed_at IS NOT NULL")).rows[0].n);
    const leon={country_code:"MX",state_code:"11",state:"Guanajuato",municipality_code:"020",municipality:"León",locality_code:"0001",city:"León de los Aldama",total:0};
    if(!regions.some(r=>r.country_code==="MX"&&r.state_code==="11"&&r.municipality_code==="020"&&r.locality_code==="0001")&&(!restricted||(await c.query("SELECT public.crm_marketing_can_choose_region('MX','11','020','0001') AS allowed")).rows[0].allowed))regions.push(leon);
    const options={regions,categories,officialImports,closedCount};if(!restricted)optionsCache={expires:Date.now()+60000,data:options};return options;
   }
   const where:string[]=[],args:unknown[]=[];
   if(p.get("show_closed")!=="1")where.push("closed_at IS NULL");
   const add=(column:string,value:string)=>{args.push(value);where.push(column+"=$"+args.length);};
   for(const col of ["country_code","state_code","municipality_code","locality_code","category","status"]){
    const v=p.get(col);if(col==="category"&&v==="pilot_food"){where.push("(activity_code LIKE '7225%' OR activity_code IN ('461170','311520') OR ((source='WEB' OR source='OSM') AND category IN ('Restaurantes y cafeterías','Heladerías')))");}else if(v)add(col,v.slice(0,120));
   }
   const neighborhood=p.get("neighborhood")?.trim();if(neighborhood){args.push("%"+neighborhood.slice(0,200)+"%");where.push("neighborhood ILIKE $"+args.length);}
   const coverage=p.get("coverage");if(coverage==="missing")where.push("email IS NULL AND public_email IS NULL");if(coverage==="available")where.push("(email IS NOT NULL OR public_email IS NOT NULL)");if(coverage==="web")where.push("public_email IS NOT NULL");
   const review=p.get("review");if(review&&reviewStates.includes(review))add("contact_review",review);
   const search=p.get("q")?.trim().slice(0,120);if(search){args.push("%"+search+"%");where.push("("+["name","email","public_email","phone","address","website","neighborhood","postal_code","instagram","facebook","whatsapp","city","municipality","state","category","activity","origin"].map(col=>col+" ILIKE $"+args.length).join(" OR ")+")");}
   const textFilters:Record<string,string>={origin:"origin",name:"name",email:"COALESCE(NULLIF(public_email,''),email)",phone:"phone",address:"address",website:"website",activity:"activity"};
   for(const [key,expression] of Object.entries(textFilters)){
    const value=p.get("filter_"+key)?.trim().slice(0,120);
    if(value){args.push("%"+value+"%");where.push(expression+" ILIKE $"+args.length);}
   }
   const presence:Record<string,string>={phone:"phone",website:"website",instagram:"instagram",facebook:"facebook",whatsapp:"whatsapp"};
   for(const [key,column] of Object.entries(presence)){
    const value=p.get("has_"+key);
    if(value==="yes")where.push("NULLIF(trim("+column+"),'') IS NOT NULL");
    if(value==="no")where.push("NULLIF(trim("+column+"),'') IS NULL");
   }
   const filter=where.length?" WHERE "+where.join(" AND "):"";
   if(p.get("view")==="map"){
    // Availability is measured over all matching geocoded rows, before the marker cap.
    // Fixed SQL predicates only; selected channels are allowlisted and combined with OR.
    const channels=["email","phone","website","instagram","facebook","whatsapp"] as const;
    const requested=(p.get("map_channels")||"").split(",");
    const chosen=channels.filter(key=>requested.includes(key)||requested.includes("any"));
    const contactFilter=chosen.length?" WHERE "+chosen.map(key=>"has_"+key).join(" OR "):"";
    const sql="WITH raw AS MATERIALIZED (SELECT id,name,address,category,latitude,longitude,status,email,public_email,phone,website,instagram,facebook,whatsapp,closed_at FROM public.crm_prospects"+filter+"), coords AS MATERIALIZED (SELECT id,name,address,category,CASE WHEN latitude::text ~ '^-?[0-9]+([.][0-9]+)?$' THEN latitude::double precision END AS lat,CASE WHEN longitude::text ~ '^-?[0-9]+([.][0-9]+)?$' THEN longitude::double precision END AS lng, closed_at IS NULL AND status IS DISTINCT FROM 'do_not_contact' AND (NULLIF(btrim(public_email),'') IS NOT NULL OR NULLIF(btrim(email),'') IS NOT NULL) AS has_email, closed_at IS NULL AND status IS DISTINCT FROM 'do_not_contact' AND NULLIF(btrim(phone),'') IS NOT NULL AS has_phone, closed_at IS NULL AND status IS DISTINCT FROM 'do_not_contact' AND NULLIF(btrim(website),'') IS NOT NULL AS has_website, closed_at IS NULL AND status IS DISTINCT FROM 'do_not_contact' AND NULLIF(btrim(instagram),'') IS NOT NULL AS has_instagram, closed_at IS NULL AND status IS DISTINCT FROM 'do_not_contact' AND NULLIF(btrim(facebook),'') IS NOT NULL AS has_facebook, closed_at IS NULL AND status IS DISTINCT FROM 'do_not_contact' AND NULLIF(btrim(whatsapp),'') IS NOT NULL AS has_whatsapp FROM raw), available AS MATERIALIZED (SELECT * FROM coords WHERE lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180 AND NOT(lat=0 AND lng=0)), selected AS MATERIALIZED (SELECT id,name,address,category,lat,lng FROM available"+contactFilter+"), visible AS (SELECT * FROM selected ORDER BY name,id LIMIT 5000) SELECT (SELECT count(*)::int FROM selected) AS total, (SELECT jsonb_build_object('email',count(*) FILTER (WHERE has_email),'phone',count(*) FILTER (WHERE has_phone),'website',count(*) FILTER (WHERE has_website),'instagram',count(*) FILTER (WHERE has_instagram),'facebook',count(*) FILTER (WHERE has_facebook),'whatsapp',count(*) FILTER (WHERE has_whatsapp),'any',count(*) FILTER (WHERE has_email OR has_phone OR has_website OR has_instagram OR has_facebook OR has_whatsapp)) FROM available) AS channels, COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.name,v.id) FROM visible v),'[]'::jsonb) AS points";
    const row=(await c.query(sql,args)).rows[0];
    return {points:row?.points||[],total:row?.total||0,channels:row?.channels||{email:0,phone:0,website:0,instagram:0,facebook:0,whatsapp:0,any:0}};
   }
   const requestedPage=Math.max(0,Math.min(100000,Math.floor(Number(p.get("page"))||0)));
   const requestedSize=Number(p.get("page_size")),pageSize=pageSizes.includes(requestedSize)?requestedSize:50;
   const requestedSort=p.get("sort")||"name";
   const sort=Object.prototype.hasOwnProperty.call(sortColumns,requestedSort)?sortColumns[requestedSort]:sortColumns.name;
   const direction=p.get("direction")==="desc"?"DESC":"ASC";
   const cacheKey=JSON.stringify([filter,args]),cached=restricted?undefined:countCache.get(cacheKey);
   let count:Aggregate;
   if(cached&&cached.expires>Date.now()&&p.get("refresh")!=="1")count=cached.data;
   else{
     count=await crmDirectoryCount(c,filter,args);
    if(countCache.size>=128)countCache.clear();
    if(!restricted)countCache.set(cacheKey,{expires:Date.now()+15000,data:count});
   }
   const totalPages=Math.max(1,Math.ceil(count.total/pageSize));
   const page=Math.min(requestedPage,totalPages-1);
   const prospects=(await c.query("SELECT * FROM public.crm_prospects"+filter+" ORDER BY "+sort+" "+direction+" NULLS LAST,id ASC LIMIT $"+(args.length+1)+" OFFSET $"+(args.length+2),[...args,pageSize,page*pageSize])).rows;
   // Look up only the addresses on the visible page, using the correspondence index.
   if(prospects.length){
    const addresses=[...new Set(prospects.flatMap(p=>[p.email,p.public_email].filter((v):v is string=>typeof v==="string"&&!!v).map(v=>v.toLowerCase())))];
    const activity=addresses.length?(await c.query("SELECT correspondent,max(occurred_at) FILTER (WHERE direction='outbound' AND delivery_status='delivered') AS last_sent_at,max(occurred_at) FILTER (WHERE direction='outbound') AS last_attempt_at,max(occurred_at) FILTER (WHERE direction='inbound') AS last_received_at,count(*) FILTER (WHERE direction='outbound' AND delivery_status='delivered')::int AS sent_count FROM public.crm_mail_history WHERE correspondent=ANY($1::text[]) GROUP BY correspondent",[addresses])).rows:[];
    const byAddress=new Map(activity.map(r=>[r.correspondent,r]));
    for(const p of prospects){
     const matched=[...new Set([p.email,p.public_email].filter((v):v is string=>typeof v==="string"&&!!v).map(v=>v.toLowerCase()))].map(a=>byAddress.get(a)).filter(Boolean);
     const latest=(key:string)=>matched.reduce<string|null>((max,r)=>{const value=r?.[key];if(!value)return max;const iso=new Date(value).toISOString();return !max||iso>max?iso:max;},null);
     p.last_sent_at=latest("last_sent_at");p.last_attempt_at=latest("last_attempt_at");p.last_received_at=latest("last_received_at");p.sent_count=matched.reduce((sum,r)=>sum+Number(r?.sent_count||0),0);
    }
   }
   // Legacy callers still receive options; the CRM requests them independently.
   if(restricted||p.get("compact")==="1")return {prospects,count,page,pageSize,totalPages};
   const regions=(await c.query("SELECT country_code,state_code,state,municipality_code,municipality,locality_code,city,count(*)::int AS total FROM public.crm_prospects GROUP BY 1,2,3,4,5,6,7 ORDER BY state,municipality,city")).rows;
   const categories=(await c.query("SELECT category,count(*)::int AS total FROM public.crm_prospects GROUP BY 1 ORDER BY 1")).rows;
   const imports=(await c.query("SELECT filename,created_at,report FROM public.crm_import_runs WHERE source='DENUE' ORDER BY created_at DESC LIMIT 5")).rows;
   return {prospects,count,regions,categories,imports,page,pageSize,totalPages};
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
  const official=mode==="official";
  const municipality=official?String(form.get("municipality")||"02003"):String(form.get("municipality")||"");
  const officialCity=official?officialCities[municipality]:undefined;
  if(official&&!officialCity)throw new ApiError("Municipio no disponible para carga directa.");
  const edition=official?officialCity!.edition:String(form.get("edition")||"");
  if(edition&&!/^20\d{2}-(05|11)$/.test(edition))throw new ApiError("Edición DENUE inválida.");
  if(municipality&&!/^\d{5}$/.test(municipality))throw new ApiError("Clave municipal inválida.");
  if(mode!=="preview"&&mode!=="import"&&!official)throw new ApiError("Modo inválido.");
  const parse=municipality==="02003"?foodPilotImport:compatibleDenueImport;
  let data:ReturnType<typeof foodPilotImport>,filename:string;
  if(official){
   const existing=await admin(request,async c=>(await c.query("SELECT report FROM public.crm_import_runs WHERE filename=$1 ORDER BY created_at DESC LIMIT 1",[officialCity!.filename])).rows[0]);
   if(existing)return Response.json({report:existing.report,imported:0,alreadyImported:true},{headers});
   if(officialImportRunning)throw new ApiError("La importación oficial ya está en curso.",409);
   officialImportRunning=true;
   try{data=parse(await downloadOfficialCsv(municipality),municipality);}finally{officialImportRunning=false;}
   filename=officialCity!.filename;
   if(data.prospects.length===0)throw new ApiError("El archivo oficial no contiene prospectos del municipio.",502);
  }else{
   if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".csv"))throw new ApiError("Selecciona el CSV oficial descomprimido del DENUE.");
   if(file.size>40*1024*1024)throw new ApiError("Divide el CSV en archivos de hasta 40 MB, conservando la cabecera.",413);
   filename=file.name.slice(0,240);
   try{data=parse(decodeDenue(await file.arrayBuffer()),municipality);}catch(e){throw new ApiError(e instanceof Error?e.message:"CSV inválido.");}
  }
  if(mode==="preview")return Response.json({report:data.report},{headers});
  if(data.report.total===0)throw new ApiError("El archivo no contiene establecimientos válidos para el filtro.");
  const imported=await admin(request,async c=>{
   await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-denue-import'))");
   if(official&&(await c.query("SELECT 1 FROM public.crm_import_runs WHERE filename=$1",[filename])).rowCount)return 0;
   let changed=0;
   for(let i=0;i<data.prospects.length;i+=500){
    const batch=data.prospects.slice(i,i+500);
    const result=await c.query(
     "INSERT INTO public.crm_prospects(source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website,phone,address,latitude,longitude,neighborhood,postal_code,instagram) "+
     "SELECT source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website,phone,address,latitude,longitude,neighborhood,postal_code,instagram "+
     "FROM jsonb_to_recordset($1::jsonb) AS x(source_id text,name text,country_code text,state_code text,state text,municipality_code text,municipality text,locality_code text,city text,activity_code text,activity text,category text,email text,website text,phone text,address text,latitude text,longitude text,neighborhood text,postal_code text,instagram text) "+
     "ON CONFLICT(source,source_id) DO UPDATE SET name=EXCLUDED.name,country_code=EXCLUDED.country_code,state_code=EXCLUDED.state_code,state=EXCLUDED.state,municipality_code=EXCLUDED.municipality_code,municipality=EXCLUDED.municipality,locality_code=EXCLUDED.locality_code,city=EXCLUDED.city,activity_code=EXCLUDED.activity_code,activity=EXCLUDED.activity,category=EXCLUDED.category,phone=COALESCE(NULLIF(EXCLUDED.phone,''),crm_prospects.phone),address=COALESCE(NULLIF(EXCLUDED.address,''),crm_prospects.address),latitude=COALESCE(NULLIF(EXCLUDED.latitude,''),crm_prospects.latitude),longitude=COALESCE(NULLIF(EXCLUDED.longitude,''),crm_prospects.longitude),email=COALESCE(crm_prospects.email,EXCLUDED.email),website=COALESCE(NULLIF(EXCLUDED.website,''),crm_prospects.website),neighborhood=COALESCE(NULLIF(EXCLUDED.neighborhood,''),crm_prospects.neighborhood),postal_code=COALESCE(NULLIF(EXCLUDED.postal_code,''),crm_prospects.postal_code),instagram=COALESCE(NULLIF(EXCLUDED.instagram,''),crm_prospects.instagram),updated_at=now(),status=crm_prospects.status",
     [JSON.stringify(batch)]);
    changed+=result.rowCount||0;
   }
   await c.query("UPDATE public.crm_prospects p SET status='do_not_contact',updated_at=now() WHERE p.status<>'do_not_contact' AND EXISTS (SELECT 1 FROM public.crm_email_exclusions e WHERE e.email IN (lower(p.email),lower(p.public_email)))");
   await c.query("INSERT INTO public.crm_import_runs(filename,report) VALUES($1,$2::jsonb)",[filename,JSON.stringify({...data.report,edition:edition||null,scope:municipality,pilotFood:municipality==="02003"})]);
   return changed;
  });
  clearCounts();
  return Response.json({report:data.report,imported},{headers});
 }catch(e){return responseError(e);}
}
export async function PUT(request:Request){
 try{
  checkOrigin(request);
  const raw=await request.text();if(raw.length>12000)throw new ApiError("Solicitud demasiado larga.",413);
  const v=JSON.parse(raw) as Record<string,unknown>;
  const result=await crmReader(request,async c=>{
   if(v.action==="create")return (await c.query("SELECT public.crm_create_manual_prospect($1::jsonb) AS id",[JSON.stringify(v)])).rows[0];
   if(v.action==="close"&&typeof v.id==="string"&&/^[0-9a-f-]{36}$/i.test(v.id)){await c.query("SELECT public.crm_close_prospect($1::uuid)",[v.id]);return {ok:true};}
   throw new ApiError("Acción no válida.");
  });clearCounts();return Response.json(result,{headers,status:v.action==="create"?201:200});
 }catch(e){return responseError(e);}
}
export async function PATCH(request:Request){
 try{
  checkOrigin(request);
  const raw=await request.text();if(raw.length>5000)throw new ApiError("Solicitud demasiado larga.",413);
  const v=JSON.parse(raw) as {id?:string;status?:string;notes?:string;public_email?:string;public_email_source?:string;contact_review?:string;contact_review_url?:string};
  if(typeof v.id!=="string"||!/^[0-9a-f-]{36}$/i.test(v.id)||typeof v.status!=="string"||!statuses.includes(v.status)||typeof v.notes!=="string"||v.notes.length>2000)throw new ApiError("Datos no válidos.");
  await crmReader(request,async (c,restricted)=>{
   if(restricted){await c.query("SELECT public.crm_marketing_save_contact($1::uuid,$2,$3)",[v.id,v.status,v.notes]);return;}
   const hasEvidence=v.public_email!==undefined||v.public_email_source!==undefined;
   let email:string|null=null,source:string|null=null;
   if(hasEvidence){
    if(typeof v.public_email!=="string"||typeof v.public_email_source!=="string")throw new ApiError("Datos de contacto incompletos.");
    email=v.public_email.trim().toLowerCase()||null;source=v.public_email_source.trim()||null;
    if((email===null)!==(source===null))throw new ApiError("Indica el correo publicado y su fuente.");
    if(email&&(!/^[^\s@,;<>]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)||email.length>254))throw new ApiError("Correo inválido.");
    if(source){let u:URL;try{u=new URL(source);}catch{throw new ApiError("URL de fuente inválida.");}if(!["https:","http:"].includes(u.protocol)||u.username||u.password||source.length>2048)throw new ApiError("URL de fuente inválida.");}
   }
   const hasReview=v.contact_review!==undefined||v.contact_review_url!==undefined;
   let review:string|null=null,reviewUrl:string|null=null;
   if(hasReview){
    if(typeof v.contact_review!=="string"||!reviewStates.includes(v.contact_review)||typeof v.contact_review_url!=="string")throw new ApiError("Estado de revisión inválido.");
    review=v.contact_review;reviewUrl=v.contact_review_url.trim()||null;
    if(reviewUrl){let u:URL;try{u=new URL(reviewUrl);}catch{throw new ApiError("URL de revisión inválida.");}if(!["https:","http:"].includes(u.protocol)||u.username||u.password||reviewUrl.length>2048)throw new ApiError("URL de revisión inválida.");}
    if(review==="source_found"&&!reviewUrl&&!source)throw new ApiError("Indica la fuente consultada.");
   }
   const r=await c.query("UPDATE public.crm_prospects SET status=$2,notes=$3,updated_at=now()"+(hasEvidence?",public_email=$4,public_email_source=$5,public_email_checked_at=CASE WHEN $4::text IS NULL THEN NULL WHEN public_email IS DISTINCT FROM $4 OR public_email_source IS DISTINCT FROM $5 THEN now() ELSE public_email_checked_at END":"")+" WHERE id=$1::uuid AND (status<>'do_not_contact' OR $2='do_not_contact') RETURNING id",hasEvidence?[v.id,v.status,v.notes,email,source]:[v.id,v.status,v.notes]);
   if(!r.rowCount)throw new ApiError("Contacto no encontrado o excluido de comunicaciones.",404);
   if(hasReview)await c.query("UPDATE public.crm_prospects SET contact_review=$2,contact_review_url=$3,contact_reviewed_at=CASE WHEN $2='pending' THEN NULL ELSE now() END WHERE id=$1::uuid",[v.id,review,reviewUrl||source]);
   if(["contacted","interested","trial","converted"].includes(v.status!)){
    // Explicit commercial status is historical evidence even if the address is edited later.
    const addresses=(await c.query("SELECT DISTINCT lower(btrim(a)) AS email FROM public.crm_prospects p CROSS JOIN LATERAL unnest(ARRAY[p.email,p.public_email]) AS t(a) WHERE p.id=$1::uuid AND nullif(btrim(a),'') IS NOT NULL",[v.id])).rows;
    for(const row of addresses)await c.query("SELECT public.crm_record_contacted_email($1)",[row.email]);
   }
   if(v.status==="do_not_contact"){
    await c.query("INSERT INTO public.crm_email_exclusions(email) SELECT lower(a) FROM public.crm_prospects p CROSS JOIN LATERAL unnest(ARRAY[p.email,p.public_email]) AS t(a) WHERE p.id=$1::uuid AND a IS NOT NULL ON CONFLICT DO NOTHING",[v.id]);
    // Global exclusion is applied by the shared update below.
   }
   await c.query("UPDATE public.crm_prospects p SET status='do_not_contact',updated_at=now() WHERE p.status<>'do_not_contact' AND EXISTS (SELECT 1 FROM public.crm_email_exclusions e WHERE e.email IN (lower(p.email),lower(p.public_email)))");
  });
  clearCounts();
  return Response.json({ok:true},{headers});
 }catch(e){return responseError(e);}
}
