import {rows} from "./denue";
import {ApiError} from "./db";
import type {PoolClient} from "pg";
import {createHash} from "node:crypto";
export const normalize=(v:string)=>v.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
type Candidate={row:number;name:string;city:string;state:string;municipality:string;category:string;email:string;source:string;address:string;sourceId:string};
type Decision={row:number;name:string;city:string;email:string;source:string;address:string;action:"update"|"create"|"skip";id:string;reason:string};
type Existing={id:string;source:string;source_id:string;name:string;city:string;locality_code:string;state:string;municipality:string;status:string;email:string|null;public_email:string|null};
const blockedStates=["do_not_contact","discarded","converted"];
export function parseContactCsv(text:string):Candidate[]{
 let header:string[]|null=null;const out:Candidate[]=[];
 rows(text.replace(/^\uFEFF/,""),cells=>{
  if(!header){
   header=cells.map(v=>v.trim().toLowerCase());
   if(["negocio","localidad","sector","correo_publicado","url_fuente","municipio","estado"].some(k=>!header!.includes(k)))throw new ApiError("Faltan columnas requeridas del CSV de contactos.");
   return;
  }
  const get=(k:string)=>(cells[header!.indexOf(k)]||"").trim();
  const name=get("negocio"),city=get("localidad"),email=get("correo_publicado").toLowerCase(),source=get("url_fuente"),address=get("direccion"),sourceId=get("id_denue"),sector=normalize(get("sector"));
  const category=/helad|neveria/.test(sector)?"Heladerías":/restaurant|cafe|cafeter|comida|gastronom|churreria|postres/.test(sector)?"Restaurantes y cafeterías":"";
  const state=get("estado"),municipality=get("municipio");
  if(!normalize(state)||state.length>120||!normalize(municipality)||municipality.length>120||!category||!normalize(name)||name.length>240||!normalize(city)||city.length>120||address.length>500||source.length>2048||email.length>254||!/^[^\s@,;<>]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)||sourceId&&!/^\d{1,20}$/.test(sourceId))throw new ApiError("Datos inválidos o fuera del piloto en fila "+(out.length+2)+".");
  let url:URL;try{url=new URL(source);}catch{throw new ApiError("Fuente inválida en fila "+(out.length+2)+".");}
  if(!["https:","http:"].includes(url.protocol)||url.username||url.password)throw new ApiError("Fuente inválida.");
  out.push({row:out.length+2,name,city,state,municipality,category,email,source:url.href,address,sourceId});
 });
 if(!header||!out.length)throw new ApiError("El CSV no contiene contactos.");
 const scope=normalize(out[0].state)+":"+normalize(out[0].municipality);
 if(out.some(v=>normalize(v.state)+":"+normalize(v.municipality)!==scope))throw new ApiError("Cada CSV debe corresponder a un municipio y estado.");
 return out;
}
export function decideContacts(candidates:Candidate[],existing:Existing[],emailOwners:Map<string,string[]>,excluded:Set<string>):Decision[]{
 const seenNames=new Set<string>(),seenEmails=new Set<string>();
 const byName=new Map<string,Existing[]>(),byIdentity=new Map<string,Existing[]>(),byCity=new Map<string,Set<string>>();
 for(const p of existing){
  const name=normalize(p.name),city=normalize(p.city),key=city+":"+name;
  const n=byName.get(name)||[];n.push(p);byName.set(name,n);
  const m=byIdentity.get(key)||[];m.push(p);byIdentity.set(key,m);
  const loc=byCity.get(city)||new Set<string>();loc.add(p.locality_code);byCity.set(city,loc);
 }
 return candidates.map(v=>{
  const base={row:v.row,name:v.name,city:v.city,email:v.email,source:v.source,address:v.address};
  const skip=(reason:string):Decision=>({...base,action:"skip",id:"",reason});
  const key=normalize(v.city)+":"+normalize(v.name);
  if(seenNames.has(key)||seenEmails.has(v.email))return skip("Duplicado dentro del archivo");
  seenNames.add(key);seenEmails.add(v.email);
  if(excluded.has(v.email))return skip("Correo excluido");
  const matches=byIdentity.get(key)||[];
  if(matches.length>1)return skip("Coincidencia ambigua: revisar fichas");
  const p=matches[0];
  if(v.sourceId&&(!p||p.source!=="DENUE"||p.source_id!==v.sourceId))return skip("ID DENUE no coincide con identidad");
  if(p){
   if(blockedStates.includes(p.status))return skip("Ficha protegida por su estado");
   if(p.email||p.public_email)return skip("Ya tiene correo: se conserva");
   if((emailOwners.get(v.email)||[]).some(id=>id!==p.id))return skip("Correo asociado a otra ficha");
   return {...base,action:"update",id:p.id,reason:"Coincidencia exacta de negocio y localidad"};
  }
  if(emailOwners.has(v.email))return skip("Correo asociado a otra ficha");
  if(byName.has(normalize(v.name)))return skip("Nombre encontrado en otra localidad");
  if(!v.address)return skip("Alta nueva: falta dirección publicada");
  const localities=[...(byCity.get(normalize(v.city))||[])];
  if(localities.length!==1)return skip("Localidad no identificada de forma unívoca");
  return {...base,action:"create",id:localities[0],reason:"Sin coincidencia exacta; confirma identidad y dirección"};
 });
}
type LibraryImport={filename:string;sha256:string;plan?:string};
export async function contactBatch(c:PoolClient,candidates:Candidate[],selected:unknown,library?:LibraryImport){
 const apply=selected!==undefined;
 const all=selected==="all"&&!!library?.plan;
 const approvals=new Map<number,{action:string;id:string}>();
 if(apply){
  if(!all){
   if(!Array.isArray(selected)||!selected.length||selected.length>candidates.length)throw new ApiError("Selecciona fichas de la vista previa.");
   for(const s of selected){if(!s||!Number.isInteger(s.row)||!["create","update"].includes(s.action)||typeof s.id!=="string"||approvals.has(s.row))throw new ApiError("Selección inválida.");approvals.set(s.row,{action:s.action,id:s.id});}
  }
  await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-crm-web-business'))");
  await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-denue-import'))");
 }
 if(apply&&library&&(await c.query("SELECT 1 FROM public.crm_import_runs WHERE source='WEB' AND filename=$1 AND report->>'sha256'=$2 LIMIT 1",[library.filename,library.sha256])).rowCount)throw new ApiError("Esta versión del archivo ya se ha importado.",409);
 const geos=(await c.query("SELECT DISTINCT state_code,state,municipality_code,municipality FROM public.crm_prospects WHERE country_code='MX'")).rows;
 const geoMatches=geos.filter(p=>normalize(p.state)===normalize(candidates[0].state)&&normalize(p.municipality)===normalize(candidates[0].municipality));
 const geoKeys=new Set(geoMatches.map(p=>p.state_code+":"+p.municipality_code));
 if(geoKeys.size!==1)throw new ApiError("Municipio no identificado. Importa primero su directorio oficial DENUE.");
 const geo=geoMatches[0],scope=geo.state_code+geo.municipality_code;
 const existing=(await c.query("SELECT id,source,source_id,name,city,locality_code,state,municipality,status,email,public_email FROM public.crm_prospects WHERE country_code='MX' AND state_code=$1 AND municipality_code=$2"+(apply?" FOR UPDATE":""),[geo.state_code,geo.municipality_code])).rows as Existing[];
 const emails=[...new Set(candidates.map(v=>v.email))],emailSet=new Set(emails);
 const excluded=new Set<string>((await c.query("SELECT email FROM public.crm_email_exclusions WHERE email=ANY($1::text[])",[emails])).rows.map(r=>r.email));
 const owners=new Map<string,string[]>();
 for(const p of (await c.query("SELECT id,lower(email) AS email,lower(public_email) AS public_email FROM public.crm_prospects WHERE lower(email)=ANY($1::text[]) OR lower(public_email)=ANY($1::text[])",[emails])).rows){for(const e of [p.email,p.public_email])if(e&&emailSet.has(e))owners.set(e,[...(owners.get(e)||[]),p.id]);}
 const decisions=decideContacts(candidates,existing,owners,excluded);
 const plan=createHash("sha256").update(JSON.stringify(decisions)).digest("hex");
 if(!apply)return {decisions,plan};
 if(all){
  if(plan!==library!.plan)throw new ApiError("La base cambió desde la vista previa. Vuelve a analizar el archivo.",409);
  for(const d of decisions)if(d.action!=="skip")approvals.set(d.row,{action:d.action,id:d.id});
 }
 const byRow=new Map(decisions.map(d=>[d.row,d])),candidateByRow=new Map(candidates.map(v=>[v.row,v]));
 for(const [row,a] of approvals){const d=byRow.get(row);if(!d||d.action!==a.action||d.id!==a.id)throw new ApiError("La base cambió desde la vista previa. Vuelve a analizar el archivo.",409);}
 let updated=0,created=0;
 for(const d of decisions){
  if(!approvals.has(d.row))continue;
  const v=candidateByRow.get(d.row)!;
  if(d.action==="update"){
   const r=await c.query("UPDATE public.crm_prospects SET public_email=$2,public_email_source=$3,public_email_checked_at=now(),contact_review='source_found',contact_review_url=$3,contact_reviewed_at=now(),updated_at=now() WHERE id=$1 AND email IS NULL AND public_email IS NULL AND status NOT IN ('do_not_contact','discarded','converted') RETURNING id",[d.id,v.email,v.source]);
   if(!r.rowCount)throw new ApiError("La ficha cambió. Vuelve a analizar.",409);
   updated++;
  }else if(d.action==="create"){
   const region=existing.find(p=>p.locality_code===d.id)!;
   const id=createHash("sha256").update(scope+":"+d.id+":"+normalize(v.name)).digest("hex");
   const r=await c.query("INSERT INTO public.crm_prospects(source,source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website,notes,public_email,public_email_source,public_email_checked_at,contact_review,contact_review_url,contact_reviewed_at) VALUES('WEB',$1,$2,'MX',$11,$3,$12,$4,$5,$6,'',$7,$7,NULL,'',$8,$9,$10,now(),'source_found',$10,now()) ON CONFLICT(source,source_id) DO NOTHING RETURNING id",[id,v.name,region.state,region.municipality,d.id,region.city,v.category,"Dirección publicada: "+v.address,v.email,v.source,geo.state_code,geo.municipality_code]);
   if(!r.rowCount)throw new ApiError("La ficha ya existe. Vuelve a analizar.",409);
   created++;
  }
 }
 await c.query("INSERT INTO public.crm_import_runs(source,filename,report) VALUES('WEB',$1,$2::jsonb)",[library?.filename||"Contactos públicos (CSV)",JSON.stringify({total:candidates.length,updated,created,skipped:candidates.length-updated-created,scope,...(library?{sha256:library.sha256}: {})})]);
 return {decisions,updated,created,skipped:candidates.length-updated-created};
}
