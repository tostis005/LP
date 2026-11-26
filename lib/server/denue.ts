// Parser for official DENUE CSV files; no network calls or email delivery.
export type Prospect = {
 source_id:string; name:string; country_code:string; state_code:string; state:string;
 municipality_code:string; municipality:string; locality_code:string; city:string;
 activity_code:string; activity:string; category:string; email:string; website:string;
 phone:string; address:string; latitude:string; longitude:string; neighborhood:string; postal_code:string; instagram:string;
};
export const categories: ReadonlyArray<[string,string]> = [
 ["7225","Restaurantes y cafeterías"],["7224","Bares"],["812110","Belleza y barberías"],
 ["811192","Autolavados"],["8111","Talleres de automóviles"],
 ["311812","Panaderías"],["311520","Heladerías"],["461170","Heladerías"],
 ["713943","Gimnasios"],["465911","Mascotas"],["812210","Lavanderías"],
 ["461110","Abarrotes"],["465111","Cosmética"],["466312","Floristerías"]
];
export function categoryFor(code:string){return categories.find(([prefix])=>code.startsWith(prefix))?.[1]||"";}
export function rows(text:string,consume:(row:string[])=>void){
 let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=c;continue;}
  if(c==='"'&&cell===""){quoted=true;continue;}
  if(c===","){row.push(cell);cell="";continue;}
  if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(Boolean))consume(row);row=[];cell="";continue;}
  cell+=c;
 }
 if(quoted)throw new Error("CSV incompleto: comillas sin cerrar.");
 if(row.length||cell){row.push(cell);if(row.some(Boolean))consume(row);}
}
const validEmail=(v:string)=>v.length<=254&&/^[^\s@,;<>]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(v);
type Counts={total:number;relevant:number;withEmail:number;missingOrInvalidEmail:number;uniqueEmails:number};
type Geo=Counts & {state:string;municipality:string;city:string;state_code:string;municipality_code:string;locality_code:string};
const blank=():Counts=>({total:0,relevant:0,withEmail:0,missingOrInvalidEmail:0,uniqueEmails:0});
export function analyzeDenue(text:string, municipalityFilter="", observe?:(row:Omit<Prospect,"email">&{hasEmail:boolean;hasWebsite:boolean})=>void,includeActivity?:(code:string)=>boolean){
 const prospects:Prospect[]=[], seen=new Set<string>(), unique=new Set<string>();
 const total=blank(), byCity=new Map<string,Geo>(), bySector=new Map<string,Counts>(), cityEmails=new Map<string,Set<string>>(), sectorEmails=new Map<string,Set<string>>();
 let header:string[]|null=null,duplicates=0,skipped=0;
 const required=["id","nom_estab","codigo_act","nombre_act","cve_ent","entidad","cve_mun","municipio","cve_loc","localidad","correoelec"];
 rows(text.replace(/^\uFEFF/,""),row=>{
  if(!header){header=row.map(x=>x.trim().toLowerCase());if(required.some(k=>!header!.includes(k)))throw new Error("CSV DENUE no reconocido. Faltan columnas: "+required.filter(k=>!header!.includes(k)).join(", "));return;}
  const get=(k:string)=>(row[header!.indexOf(k)]||"").trim();
  const id=get("id"),state_code=get("cve_ent").padStart(2,"0"),municipality_code=get("cve_mun").padStart(3,"0"),locality_code=get("cve_loc").padStart(4,"0");
  if(municipalityFilter&&state_code+municipality_code!==municipalityFilter)return;
  const name=get("nom_estab"),state=get("entidad"),municipality=get("municipio"),city=get("localidad"),activity_code=get("codigo_act"),activity=get("nombre_act");
  if(!/^\d+$/.test(id)||!name||!state||!municipality||!city||!get("cve_ent")||!get("cve_mun")||!get("cve_loc")||!/^\d{6}$/.test(activity_code)){skipped++;return;}
  if(seen.has(id)){duplicates++;return;}seen.add(id);
  const key=state_code+municipality_code+locality_code,category=categoryFor(activity_code),email=get("correoelec").toLowerCase();
  const g=byCity.get(key)||{...blank(),state,municipality,city,state_code,municipality_code,locality_code};byCity.set(key,g);
  total.total++;g.total++;
  if(!category||(includeActivity&&!includeActivity(activity_code)))return;
  const web=get("www");
  const contact={neighborhood:get("nomb_asent").slice(0,200),postal_code:get("cod_post").slice(0,12),instagram:/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/[a-z0-9._]+\/?(?:\?.*)?$/i.test(web)?(web.startsWith("http")?web:"https://"+web):"",phone:get("telefono").slice(0,80),address:[[get("tipo_vial"),get("nom_vial"),get("numero_ext"),get("letra_ext")].filter(Boolean).join(" "),get("numero_int")?"Int. "+get("numero_int")+get("letra_int"):"",get("nomb_asent"),get("cod_post")].filter(Boolean).join(", ").slice(0,500),latitude:get("latitud").slice(0,32),longitude:get("longitud").slice(0,32)};
  const s=bySector.get(category)||blank();bySector.set(category,s);
  total.relevant++;g.relevant++;s.total++;s.relevant++;
  if(observe)observe({source_id:id,name,country_code:"MX",state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,website:get("www"),...contact,hasEmail:validEmail(email),hasWebsite:!!get("www")});
  if(!validEmail(email)){total.missingOrInvalidEmail++;g.missingOrInvalidEmail++;s.missingOrInvalidEmail++;return;}
  total.withEmail++;g.withEmail++;s.withEmail++;
  unique.add(email);
  const ce=cityEmails.get(key)||new Set<string>();ce.add(email);cityEmails.set(key,ce);g.uniqueEmails=ce.size;
  const se=sectorEmails.get(category)||new Set<string>();se.add(email);sectorEmails.set(category,se);s.uniqueEmails=se.size;
  prospects.push({source_id:id,name,country_code:"MX",state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website:get("www"),...contact});
 });
 if(!header)throw new Error("El CSV está vacío.");
 total.uniqueEmails=unique.size;
 return {prospects,report:{...total,duplicates,skipped,municipalityFilter,byCity:[...byCity.values()].sort((a,b)=>b.withEmail-a.withEmail),bySector:[...bySector].map(([category,c])=>({category,...c})).sort((a,b)=>b.withEmail-a.withEmail)}};
}
export function decodeDenue(buffer:ArrayBuffer){
 try{return new TextDecoder("utf-8",{fatal:true}).decode(buffer);}catch{return new TextDecoder("windows-1252").decode(buffer);}
}

export function isFoodPilot(code:string){return code.startsWith("7225")||code==="461170"||code==="311520";}
export function foodPilotImport(text:string,municipalityFilter=""){
 const missing:Array<Omit<Prospect,"email">&{email:null}>=[];
 const result=analyzeDenue(text,municipalityFilter,row=>{
  if(!isFoodPilot(row.activity_code)||row.hasEmail)return;
  const {hasEmail,hasWebsite,...business}=row;
  missing.push({...business,email:null});
 },isFoodPilot);
 return {...result,prospects:[...result.prospects.filter(p=>isFoodPilot(p.activity_code)),...missing]};
}

/** All compatible sectors, including establishments without a published email. */
export function compatibleDenueImport(text:string,municipalityFilter=""){
 const missing:Array<Omit<Prospect,"email">&{email:null}>=[];
 const result=analyzeDenue(text,municipalityFilter,row=>{
  if(row.hasEmail)return;
  const {hasEmail,hasWebsite,...business}=row;
  missing.push({...business,email:null});
 });
 return {...result,prospects:[...result.prospects,...missing]};
}
