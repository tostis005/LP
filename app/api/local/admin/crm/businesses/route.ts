import {actorFromRequest,asActor,checkOrigin,ApiError,responseError} from "@/lib/server/db";
import {createHash} from "node:crypto";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const categories=["Restaurantes y cafeterías","Heladerías"];
const normalized=(s:string)=>s.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();

export async function POST(request:Request){
 try{
  // Use the existing administrator session; no external credentials or automation.
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Inicia sesión.",401);
  return await asActor(actor,async c=>{
   if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);
   const raw=await request.text();if(raw.length>12000)throw new ApiError("Solicitud demasiado larga.",413);
   const v=JSON.parse(raw) as Record<string,unknown>;
   const field=(key:string,max:number)=>{const value=v[key];if(typeof value!=="string"||value.trim().length>max)throw new ApiError("Campo inválido: "+key);return value.trim();};
   const name=field("name",240),locality=field("locality_code",4),category=field("category",80),email=field("public_email",254).toLowerCase(),source=field("source_url",2048),address=field("address",500),notes=field("notes",1000);
   if(!name||!normalized(name)||!/^\d{4}$/.test(locality)||!categories.includes(category)||!source||!address)throw new ApiError("Indica nombre, localidad, sector, dirección y fuente.");
   if(email&&!/^[^\s@,;<>]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))throw new ApiError("Correo inválido.");
   let url:URL;try{url=new URL(source);}catch{throw new ApiError("URL inválida.");}
   if(!["http:","https:"].includes(url.protocol)||url.username||url.password)throw new ApiError("URL inválida.");
   await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-crm-web-business'))");
   const region=(await c.query("SELECT state,municipality,city FROM public.crm_prospects WHERE country_code='MX' AND state_code='02' AND municipality_code='003' AND locality_code=$1 LIMIT 1",[locality])).rows[0];
   if(!region)throw new ApiError("Localidad no reconocida en el directorio de Tecate.");
   const existing=(await c.query("SELECT id,name,status,email,public_email FROM public.crm_prospects WHERE country_code='MX' AND state_code='02' AND municipality_code='003' AND locality_code=$1",[locality])).rows;
   const matches=existing.filter(r=>normalized(r.name)===normalized(name));
   if(matches.length)return Response.json({error:"Ya existe un negocio con ese nombre en la localidad. Abre su ficha y confirma la identidad antes de actualizar el correo.",matches:matches.map(r=>({id:r.id,name:r.name}))},{status:409,headers});
   if(email){
    if((await c.query("SELECT 1 FROM public.crm_email_exclusions WHERE email=$1",[email])).rowCount)throw new ApiError("Este correo está excluido.",409);
    if((await c.query("SELECT 1 FROM public.crm_prospects WHERE lower(email)=$1 OR lower(public_email)=$1 LIMIT 1",[email])).rowCount)throw new ApiError("Este correo ya está asociado a otra ficha. Comprueba si se trata de una sucursal o del mismo negocio.",409);
   }
   if(v.confirm_new!==true)throw new ApiError("Confirma que comprobaste que el negocio no existe.");
   const sourceId=createHash("sha256").update("02003:"+locality+":"+normalized(name)).digest("hex");
   const result=await c.query("INSERT INTO public.crm_prospects(source,source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website,notes,public_email,public_email_source,public_email_checked_at,contact_review,contact_review_url,contact_reviewed_at) VALUES('WEB',$1,$2,'MX','02',$3,'003',$4,$5,$6,'',$7,$7,NULL,'',$8,$9,$10,CASE WHEN $9::text IS NULL THEN NULL ELSE now() END,CASE WHEN $9::text IS NULL THEN 'pending' ELSE 'source_found' END,$11,CASE WHEN $9::text IS NULL THEN NULL ELSE now() END) RETURNING id",[sourceId,name,region.state,region.municipality,locality,region.city,category,"Dirección publicada: "+address+(notes?"\n"+notes:""),email||null,email?url.href:null,url.href]);
   return Response.json({id:result.rows[0].id,created:true},{status:201,headers});
  });
 }catch(e){return responseError(e);}
}
