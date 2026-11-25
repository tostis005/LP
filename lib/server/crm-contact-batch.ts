import {rows} from "./denue";
import {ApiError} from "./db";
import type {PoolClient} from "pg";
import {createHash} from "node:crypto";
export const normalize=(v:string)=>v.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
type Candidate={row:number;name:string;city:string;category:string;email:string;source:string;address:string;sourceId:string};
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
  if(out.length>=2000)throw new ApiError("Máximo 2.000 contactos por archivo.");
  const get=(k:string)=>(cells[header!.indexOf(k)]||"").trim();
  const name=get("negocio"),city=get("localidad"),email=get("correo_publicado").toLowerCase(),source=get("url_fuente"),address=get("direccion"),sourceId=get("id_denue"),sector=normalize(get("sector"));
  const category=/helad|neveria/.test(sector)?"Heladerías":/restaurant|cafe|cafeter|comida|gastronom|churreria|postres/.test(sector)?"Restaurantes y cafeterías":"";
  if(normalize(get("municipio"))!=="tecate"||normalize(get("estado"))!=="baja california"||!category||!normalize(name)||name.length>240||!normalize(city)||city.length>120||address.length>500||source.length>2048||email.length>254||!/^[^\s@,;<>]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)||sourceId&&!/^\d{1,20}$/.test(sourceId))throw new ApiError("Datos inválidos o fuera del piloto en fila "+(out.length+2)+".");
  let url:URL;try{url=new URL(source);}catch{throw new ApiError("Fuente inválida en fila "+(out.length+2)+".");}
  if(!["https:","http:"].includes(url.protocol)||url.username||url.password)throw new ApiError("Fuente inválida.");
  out.push({row:out.length+2,name,city,category,email,source:url.href,address,sourceId});
 });
 if(!header||!out.length)throw new ApiError("El CSV no contiene contactos.");
 return out;
}
export function decideContacts(candidates:Candidate[],existing:Existing[],emailOwners:Map<string,string[]>,excluded:Set<string>):Decision[]{
 const seenNames=new Set<string>(),seenEmails=new Set<string>();
 return candidates.map(v=>{
  const base={row:v.row,name:v.name,city:v.city,email:v.email,source:v.source,address:v.address};
  const skip=(reason:string):Decision=>({...base,action:"skip",id:"",reason});
  const key=normalize(v.city)+":"+normalize(v.name);
  if(seenNames.has(key)||seenEmails.has(v.email))return skip("Duplicado dentro del archivo");
  seenNames.add(key);seenEmails.add(v.email);
  if(excluded.has(v.email))return skip("Correo excluido");
  const matches=existing.filter(p=>normalize(p.city)===normalize(v.city)&&normalize(p.name)===normalize(v.name));
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
  if(existing.some(p=>normalize(p.name)===normalize(v.name)))return skip("Nombre encontrado en otra localidad");
  if(!v.address)return skip("Alta nueva: falta dirección publicada");
  const localities=[...new Set(existing.filter(p=>normalize(p.city)===normalize(v.city)).map(p=>p.locality_code))];
  if(localities.length!==1)return skip("Localidad no identificada de forma unívoca");
  return {...base,action:"create",id:localities[0],reason:"Sin coincidencia exacta; confirma identidad y dirección"};
 });
}
export async function contactBatch(c:PoolClient,candidates:Candidate[],selected:unknown){
 const apply=selected!==undefined;
 const approvals=new Map<number,{action:string;id:string}>();
 if(apply){
  if(!Array.isArray(selected)||!selected.length||selected.length>2000)throw new ApiError("Selecciona fichas de la vista previa.");
  for(const s of selected){if(!s||!Number.isInteger(s.row)||!["create","update"].includes(s.action)||typeof s.id!=="string"||approvals.has(s.row))throw new ApiError("Selección inválida.");approvals.set(s.row,{action:s.action,id:s.id});}
  await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-crm-web-business'))");
  await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-denue-import'))");
 }
 const existing=(await c.query("SELECT id,source,source_id,name,city,locality_code,state,municipality,status,email,public_email FROM public.crm_prospects WHERE country_code='MX' AND state_code='02' AND municipality_code='003'"+(apply?" FOR UPDATE":""))).rows as Existing[];
 const emails=candidates.map(v=>v.email);
 const excluded=new Set<string>((await c.query("SELECT email FROM public.crm_email_exclusions WHERE email=ANY($1::text[])",[emails])).rows.map(r=>r.email));
 const owners=new Map<string,string[]>();
 for(const p of (await c.query("SELECT id,lower(email) AS email,lower(public_email) AS public_email FROM public.crm_prospects WHERE lower(email)=ANY($1::text[]) OR lower(public_email)=ANY($1::text[])",[emails])).rows){for(const e of [p.email,p.public_email])if(e&&emails.includes(e))owners.set(e,[...(owners.get(e)||[]),p.id]);}
 const decisions=decideContacts(candidates,existing,owners,excluded);
 if(!apply)return {decisions};
 for(const [row,a] of approvals){const d=decisions.find(v=>v.row===row);if(!d||d.action!==a.action||d.id!==a.id)throw new ApiError("La base cambió desde la vista previa. Vuelve a analizar el archivo.",409);}
 let updated=0,created=0;
 for(const d of decisions){
  if(!approvals.has(d.row))continue;
  const v=candidates.find(x=>x.row===d.row)!;
  if(d.action==="update"){
   const r=await c.query("UPDATE public.crm_prospects SET public_email=$2,public_email_source=$3,public_email_checked_at=now(),contact_review='source_found',contact_review_url=$3,contact_reviewed_at=now(),updated_at=now() WHERE id=$1 AND email IS NULL AND public_email IS NULL AND status NOT IN ('do_not_contact','discarded','converted') RETURNING id",[d.id,v.email,v.source]);
   if(!r.rowCount)throw new ApiError("La ficha cambió. Vuelve a analizar.",409);
   updated++;
  }else if(d.action==="create"){
   const region=existing.find(p=>p.locality_code===d.id)!;
   const id=createHash("sha256").update("02003:"+d.id+":"+normalize(v.name)).digest("hex");
   const r=await c.query("INSERT INTO public.crm_prospects(source,source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website,notes,public_email,public_email_source,public_email_checked_at,contact_review,contact_review_url,contact_reviewed_at) VALUES('WEB',$1,$2,'MX','02',$3,'003',$4,$5,$6,'',$7,$7,NULL,'',$8,$9,$10,now(),'source_found',$10,now()) ON CONFLICT(source,source_id) DO NOTHING RETURNING id",[id,v.name,region.state,region.municipality,d.id,region.city,v.category,"Dirección publicada: "+v.address,v.email,v.source]);
   if(!r.rowCount)throw new ApiError("La ficha ya existe. Vuelve a analizar.",409);
   created++;
  }
 }
 await c.query("INSERT INTO public.crm_import_runs(source,filename,report) VALUES('WEB','Contactos públicos (CSV)',$1::jsonb)",[JSON.stringify({total:candidates.length,updated,created,skipped:candidates.length-updated-created,scope:"02003"})]);
 return {decisions,updated,created,skipped:candidates.length-updated-created};
}
