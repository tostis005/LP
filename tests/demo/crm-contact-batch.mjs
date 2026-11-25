import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const route=read("app/api/local/admin/crm/contact-batch/route.ts"),logic=read("lib/server/crm-contact-batch.ts"),ui=read("components/AdminCrmContactBatch.tsx");
assert.match(route,/checkOrigin\(request\)/);
assert.match(route,/actorFromRequest\(request\)/);
assert.match(route,/is_platform_admin\(\)/);
assert.match(route,/v\.mode==="apply"\?v\.selected:undefined/);
assert.match(logic,/if\(!apply\)return \{decisions,plan\}/);
assert.match(logic,/pg_advisory_xact_lock/);
assert.match(logic,/email IS NULL AND public_email IS NULL/);
assert.match(logic,/excluded\.has\(v\.email\)/);
assert.match(logic,/matches\.length>1/);
assert.match(logic,/d\.action!==a\.action\|\|d\.id!==a\.id/);
assert.match(logic,/if\(!v\.address\)return skip/);
assert.match(ui,/Confirmar importación/);
assert.match(ui,/d\.action==="update"/);
assert.doesNotMatch(read("components/AdminCrm.tsx"),/<AdminCrmContactBatch/); // advanced batch UI removed from main screen
console.log("CRM batch import source-level regression checks passed.");

assert.doesNotMatch(logic,/out\.length>=2000/);
assert.doesNotMatch(logic,/selected\.length>2000/);
assert.match(ui,/sin límite fijo de filas/);
assert.match(route,/Buffer\.byteLength\(v\.csv,"utf8"\)>4\*1024\*1024/);

const library=read("app/api/local/admin/crm/csv-library/route.ts"),libraryUi=read("components/AdminCrmCsvLibrary.tsx"),files=read("lib/server/crm-csv-library.ts");
assert.match(library,/checkOrigin\(request\)/);
assert.match(library,/is_platform_admin\(\)/);
assert.match(library,/v\.confirm!==true/);
assert.match(library,/file\.sha256!==v\.sha256/);
assert.match(logic,/plan!==library!\.plan/);
assert.match(logic,/report->>'sha256'=\$2/);
assert.match(logic,/geoKeys\.size!==1/);
assert.match(files,/isSymbolicLink\(\)/);
assert.match(files,/20\*1024\*1024/);
assert.match(libraryUi,/Confirmar importación/);
assert.match(read("Dockerfile"),/\/app\/crm-imports \.\/crm-imports/);
assert.match(read("components/AdminCrm.tsx"),/<AdminCrmCsvLibrary/);

const ts=(await import("typescript")).default;
const requireModule=(await import("node:module")).createRequire(import.meta.url);
const {runInNewContext}=await import("node:vm");
function load(src,deps={},globals={}){
 const exports={};
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(js,{exports,URL,...globals,require:(id)=>id in deps?deps[id]:requireModule(id)});
 return exports;
}
const denue=load(read("lib/server/denue.ts"));
const {parseContactCsv,decideContacts}=load(logic,{"./denue":denue,"./db":{ApiError:class extends Error{}}});
const head="negocio,sector,estado,municipio,localidad,correo_publicado,url_fuente,direccion,id_denue\n";
const row=(i,city="León",municipality="León")=>"Café ficticio "+i+",Cafetería,Guanajuato,"+municipality+","+city+",contacto"+i+"@example.com,https://example.com/"+i+",Calle de prueba "+i+",\n";
const candidates=parseContactCsv(head+Array.from({length:2501},(_,i)=>row(i)).join(""));
assert.equal(candidates.length,2501);
assert.throws(()=>parseContactCsv(head+row(1)+row(2,"Irapuato","Irapuato")),/un municipio/);
const existing=[{id:"test-0",source:"DENUE",source_id:"1",name:"Café ficticio 0",city:"León",locality_code:"0001",state:"Guanajuato",municipality:"León",status:"pending_review",email:null,public_email:null}];
const decisions=decideContacts(candidates,existing,new Map(),new Set(["contacto2@example.com"]));
assert.equal(decisions[0].action,"update");
assert.equal(decisions[1].action,"create");
assert.equal(decisions[2].action,"skip");
assert.equal(decisions.filter(x=>x.action==="create").length,2499);
console.log("CSV library: parsed and classified 2,501 synthetic contacts; mixed municipalities rejected.");

const census=denue.compatibleDenueImport("id,nom_estab,codigo_act,nombre_act,cve_ent,entidad,cve_mun,municipio,cve_loc,localidad,correoelec,www,telefono,nom_vial,numero_ext,latitud,longitud\n1,Café prueba,722515,Café,22,Querétaro,014,Querétaro,0001,Santiago de Querétaro,,example.com,4421234567,Reforma,12,20.5,-100.4\n2,Barbería prueba,812110,Barbería,22,Querétaro,014,Querétaro,0001,Santiago de Querétaro,,,,,,,\n3,Fábrica,333111,Industria,22,Querétaro,014,Querétaro,0001,Santiago de Querétaro,,,,,,,\n4,Otro café,722515,Café,21,Puebla,114,Puebla,0001,Heroica Puebla de Zaragoza,,,,,,,","22014");
assert.equal(census.prospects.length,2);
assert.equal(census.prospects[0].email,null);
assert.equal(census.prospects[0].phone,"4421234567");
assert.equal(census.prospects[0].address,"Reforma 12");
assert.equal(census.prospects[0].latitude,"20.5");
assert.match(library,/compatibleDenueImport/);
assert.match(library,/ON CONFLICT\(source,source_id\)/);
assert.match(library,/email=COALESCE\(EXCLUDED.email,crm_prospects.email\)/);
assert.match(libraryUi,/f.status!=="imported"/);
console.log("CRM census: geographic isolation, all compatible sectors, contact fields and hidden imported CSVs.");

const crmUi=read("components/AdminCrm.tsx"),crmRoute=read("app/api/local/admin/crm/route.ts");
assert.doesNotMatch(crmUi,/Importar y analizar DENUE/);
assert.match(libraryUi,/!archivedCity\(f\.filename\)/);
assert.match(libraryUi,/if\(!files\.length&&!error&&!focus\)return null/);
assert.match(crmUi,/aria-busy=\{loading\}/);
assert.match(crmUi,/controller\.abort\(\)/);
assert.match(crmUi,/aria-sort=/);
assert.match(crmUi,/Resultados por página/);
assert.match(crmUi,/Última página/);
assert.match(crmUi,/Filtrar municipio/);
assert.match(crmRoute,/Object\.prototype\.hasOwnProperty\.call\(sortColumns,requestedSort\)/);

const queries=[];
const fakeClient={query:async(sql,params=[])=>{
 queries.push({sql,params:Array.from(params)});
 if(sql.includes("is_platform_admin"))return {rows:[{allowed:true}]};
 if(sql.startsWith("SELECT count(*)::int AS total"))return {rows:[{total:521,with_email:100,unique_emails:95,missing_email:421,reviewed:0}]};
 return {rows:[]};
}};
const crm=load(crmRoute,{
 "@/lib/server/db":{actorFromRequest:async()=>({id:"admin"}),asActor:async(_actor,fn)=>fn(fakeClient),responseError:e=>{throw e;},ApiError:class extends Error{}},
 "@/lib/server/denue":denue,
 "@/lib/server/denue-download":{downloadOfficialCsv:async()=>"",officialCities:{}}
},{Response});
const result=await crm.GET({url:"https://example.com/api/local/admin/crm?country_code=MX&filter_name=cafe&filter_email=example.com&has_phone=yes&sort=email&direction=desc&page=999&page_size=100"});
const body=await result.json();
assert.equal(body.page,5);
assert.equal(body.pageSize,100);
assert.equal(body.totalPages,6);
const select=queries.find(q=>q.sql.startsWith("SELECT * FROM public.crm_prospects"));
assert.ok(select.sql.includes("name ILIKE $2"));
assert.ok(select.sql.includes("COALESCE(NULLIF(public_email,''),email) ILIKE $3"));
assert.ok(select.sql.includes("NULLIF(phone,'') IS NOT NULL"));
assert.ok(select.sql.includes("ORDER BY lower(COALESCE(NULLIF(public_email,''),NULLIF(email,''))) DESC NULLS LAST,id ASC LIMIT $4 OFFSET $5"));
assert.deepEqual(select.params,["MX","%cafe%","%example.com%",100,500]);
queries.length=0;
const invalid=await (await crm.GET({url:"https://example.com/api/local/admin/crm?sort=__proto__&direction=DROP&page_size=9999&page=-2"})).json();
assert.equal(invalid.page,0);
assert.equal(invalid.pageSize,50);
const safeSelect=queries.find(q=>q.sql.startsWith("SELECT * FROM public.crm_prospects"));
assert.ok(safeSelect.sql.includes("ORDER BY lower(name) ASC NULLS LAST,id ASC LIMIT $1 OFFSET $2"));
assert.deepEqual(safeSelect.params,[50,0]);
console.log("CRM list: server-side filters, pagination clamping, safe sorting and pending-file UI regression checks.");
