// Parser for official DENUE CSV files; no network calls or email delivery.
export type Prospect = {
 source_id:string; name:string; country_code:string; state_code:string; state:string;
 municipality_code:string; municipality:string; locality_code:string; city:string;
 activity_code:string; activity:string; category:string; email:string; website:string;
};
export const categories: ReadonlyArray<[string,string]> = [
 ["7225","Restaurantes y cafeterías"],["7224","Bares"],["812110","Belleza y barberías"],
 ["811192","Autolavados"],["8111","Talleres de automóviles"],
 ["311812","Panaderías"],["311520","Heladerías"],["461170","Heladerías"],
 ["713943","Gimnasios"],["465911","Mascotas"],["812210","Lavanderías"],
 ["461110","Abarrotes"],["465111","Cosmética"],["466312","Floristerías"]
];
export function categoryFor(code:string){return categories.find(([prefix])=>code.startsWith(prefix))?.[1]||"";}
function rows(text:string,consume:(row:string[])=>void){
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
export function analyzeDenue(text:string, municipalityFilter="", observe?:(row:Omit<Prospect,"email">&{hasEmail:boolean;hasWebsite:boolean})=>void){
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
  if(!category)return;
  const s=bySector.get(category)||blank();bySector.set(category,s);
  total.relevant++;g.relevant++;s.total++;s.relevant++;
  if(observe)observe({source_id:id,name,country_code:"MX",state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,website:get("www"),hasEmail:validEmail(email),hasWebsite:!!get("www")});
  if(!validEmail(email)){total.missingOrInvalidEmail++;g.missingOrInvalidEmail++;s.missingOrInvalidEmail++;return;}
  total.withEmail++;g.withEmail++;s.withEmail++;
  unique.add(email);
  const ce=cityEmails.get(key)||new Set<string>();ce.add(email);cityEmails.set(key,ce);g.uniqueEmails=ce.size;
  const se=sectorEmails.get(category)||new Set<string>();se.add(email);sectorEmails.set(category,se);s.uniqueEmails=se.size;
  prospects.push({source_id:id,name,country_code:"MX",state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website:get("www")});
 });
 if(!header)throw new Error("El CSV está vacío.");
 total.uniqueEmails=unique.size;
 return {prospects,report:{...total,duplicates,skipped,municipalityFilter,byCity:[...byCity.values()].sort((a,b)=>b.withEmail-a.withEmail),bySector:[...bySector].map(([category,c])=>({category,...c})).sort((a,b)=>b.withEmail-a.withEmail)}};
}
export function decodeDenue(buffer:ArrayBuffer){
 try{return new TextDecoder("utf-8",{fatal:true}).decode(buffer);}catch{return new TextDecoder("windows-1252").decode(buffer);}
}
