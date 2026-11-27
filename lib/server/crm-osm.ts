import {rows} from "./denue";
import {ApiError} from "./db";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
export const osmFilename=(name:string)=>/^osm-venezuela-\d{8}\.csv$/.test(name);
const slug=(v:string)=>v.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const geoCode=(...parts:string[])=>{const code=parts.map(slug).join("-");return code.length<=110?code:code.slice(0,90)+"-"+createHash("sha256").update(code).digest("hex").slice(0,16);};
const stateNames=new Set(["Amazonas","Anzoátegui","Apure","Aragua","Barinas","Bolívar","Carabobo","Cojedes","Delta Amacuro","Distrito Capital","Falcón","Guárico","La Guaira","Lara","Mérida","Miranda","Monagas","Nueva Esparta","Portuguesa","Sucre","Táchira","Trujillo","Yaracuy","Zulia"]);
const groups:Record<string,string>={Restaurante:"Restaurantes y cafeterías","Comida rápida":"Restaurantes y cafeterías","Cafetería":"Restaurantes y cafeterías","Zona de comida":"Restaurantes y cafeterías","Tienda de café":"Restaurantes y cafeterías","Tienda de té":"Restaurantes y cafeterías",Bar:"Bares",Pub:"Bares","Panadería":"Panaderías","Pastelería":"Panaderías","Heladería":"Heladerías","Peluquería / barbería":"Belleza y barberías","Estética":"Belleza y barberías",Masajes:"Belleza y barberías",Manicura:"Belleza y barberías","Lavado de autos":"Autolavados",Mascotas:"Mascotas",Veterinaria:"Mascotas","Lavandería":"Lavanderías","Tintorería":"Lavanderías","Tienda de conveniencia":"Abarrotes","Cosmética":"Cosmética","Perfumería":"Cosmética","Floristería":"Floristerías"};
const cols=["nombre","categoria","pais","estado","municipio","ciudad","direccion","barrio","telefono","whatsapp","email","web","instagram","facebook","latitud","longitud","osm_tipo","osm_id","url_osm","etiqueta_osm"];
export function parseOsmCsv(data:Uint8Array){
 let header:string[]|undefined;const seen=new Set<string>();let skipped=0;
 const prospects:Array<Record<string,string|null|Record<string,string>>>=[];
 rows(new TextDecoder("utf-8",{fatal:true}).decode(data).replace(/^\uFEFF/,""),cells=>{
  if(!header){header=cells.map(v=>v.trim());if(new Set(header).size!==header.length||cols.some(k=>!header!.includes(k)))throw new ApiError("CSV OSM: faltan columnas requeridas.");return;}
  if(cells.length!==header.length)throw new ApiError("CSV OSM: número de columnas incorrecto.");
  const raw=Object.fromEntries(header.map((k,i)=>[k,cells[i].trim()]));
  const g=(k:string)=>raw[k]||"";
  const name=g("nombre"),state=g("estado"),municipality=g("municipio"),city=g("ciudad"),category=g("categoria"),kind=g("osm_tipo"),oid=g("osm_id"),id=kind+"/"+oid;
  const lat=g("latitud"),lng=g("longitud"),url="https://www.openstreetmap.org/"+id;
  if(g("pais")!=="Venezuela"||!stateNames.has(state)||!municipality||!name||!category||!["node","way","relation"].includes(kind)||!/^\d{1,20}$/.test(oid)||g("url_osm")!==url||!/^[-]?\d+(?:\.\d+)?$/.test(lat)||!/^[-]?\d+(?:\.\d+)?$/.test(lng)||Number(lat)<0||Number(lat)>16||Number(lng)<-74||Number(lng)>-58){skipped++;return;}
  if(seen.has(id)){skipped++;return;}seen.add(id);
  const email=g("email").toLowerCase();
  prospects.push({source_id:id,name,country_code:"VE",state_code:geoCode("ve",state),state,municipality_code:geoCode("ve",state,municipality),municipality,locality_code:geoCode("ve",state,municipality,city||"sin-localidad"),city:city||"Sin localidad registrada",activity_code:g("etiqueta_osm"),activity:category,category:groups[category]||category,email:email.length<=254&&/^[^\s@,;<>]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)?email:null,website:g("web"),phone:g("telefono"),address:g("direccion"),latitude:lat,longitude:lng,neighborhood:g("barrio"),postal_code:g("codigo_postal"),instagram:g("instagram"),facebook:g("facebook"),whatsapp:g("whatsapp"),source_url:url,source_data:raw});
 });
 if(!prospects.length)throw new ApiError("El archivo no contiene establecimientos de Venezuela compatibles.");
 return {prospects,skipped};
}
export async function importOsm(c:PoolClient,file:{filename:string;sha256:string;data:Uint8Array},mode:"preview"|"apply",expectedPlan?:string){
 const {prospects,skipped}=parseOsmCsv(file.data);
 if(mode==="apply"){
  await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-crm-web-business'))");
  await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-crm-osm-import'))");
  if((await c.query("SELECT 1 FROM public.crm_import_runs WHERE filename=$1 AND report->>'sha256'=$2",[file.filename,file.sha256])).rowCount)throw new ApiError("Esta versión ya se ha importado.",409);
 }
 const ids=prospects.map(p=>p.source_id);
 const current=(await c.query("SELECT source_id FROM public.crm_prospects WHERE source='OSM' AND source_id=ANY($1::text[]) ORDER BY source_id",[ids])).rows.map(r=>String(r.source_id));
 const existing=new Set(current),plan=createHash("sha256").update(file.sha256+":"+JSON.stringify(current)).digest("hex");
 const counts={create:ids.length-current.length,update:current.length,skip:skipped};
 const decisions=prospects.slice(0,50).map((p,i)=>({row:i+2,name:p.name,city:p.city,email:p.email||"",source:p.source_url,address:p.address,action:existing.has(String(p.source_id))?"update":"create",reason:"Fuente OpenStreetMap; contacto sin verificación externa"}));
 const report={plan,total:ids.length+skipped,counts,reasons:skipped?{"Sin identificación geográfica válida o duplicado":skipped}:{},decisions};
 if(mode==="preview")return report;
 if(expectedPlan!==plan)throw new ApiError("La base cambió. Vuelve a analizar el archivo.",409);
 const fields=["source_id","name","country_code","state_code","state","municipality_code","municipality","locality_code","city","activity_code","activity","category","email","website","phone","address","latitude","longitude","neighborhood","postal_code","instagram","facebook","whatsapp","source_url","source_data"];
 const fill=["website","phone","address","neighborhood","postal_code","instagram","facebook","whatsapp"];
 const update=fields.filter(k=>!["source_id","email",...fill].includes(k)).map(k=>k+"=EXCLUDED."+k).concat(fill.map(k=>k+"=COALESCE(NULLIF(EXCLUDED."+k+",''),crm_prospects."+k+")"),"email=COALESCE(crm_prospects.email,EXCLUDED.email)","updated_at=now()").join(",");
 const sql="INSERT INTO public.crm_prospects(source,origin,"+fields.join(",")+") SELECT 'OSM','OpenStreetMap',"+fields.join(",")+" FROM jsonb_to_recordset($1::jsonb) AS x("+fields.map(k=>k+(k==="source_data"?" jsonb":" text")).join(",")+") ON CONFLICT(source,source_id) DO UPDATE SET "+update;
 for(let i=0;i<prospects.length;i+=500)await c.query(sql,[JSON.stringify(prospects.slice(i,i+500))]);
 await c.query("UPDATE public.crm_prospects p SET status='do_not_contact',updated_at=now() WHERE p.source='OSM' AND p.status<>'do_not_contact' AND EXISTS(SELECT 1 FROM public.crm_email_exclusions e WHERE e.email IN(lower(p.email),lower(p.public_email)))");
 await c.query("INSERT INTO public.crm_import_runs(filename,source,report) VALUES($1,'OSM',$2::jsonb)",[file.filename,JSON.stringify({sha256:file.sha256,total:report.total,created:counts.create,updated:counts.update,skipped:counts.skip})]);
 return {...report,created:counts.create,updated:counts.update,skipped:counts.skip};
}
