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
function load(src,deps={}){
 const exports={};
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(js,{exports,URL,require:(id)=>id in deps?deps[id]:requireModule(id)});
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
