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
assert.match(libraryUi,/Preparar fichero de Venezuela/); // The upload control remains visible when the pending list is empty.
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
 if(sql.includes("is_platform_admin"))return {rows:[{allowed:true,admin:true,marketing:false}]};
 if(sql.startsWith("WITH filtered AS"))return {rows:[{total:521,with_email:100,unique_emails:95,missing_email:421,reviewed:0}]};
 return {rows:[]};
}};
const crm=load(crmRoute,{
 "@/lib/server/db":{actorFromRequest:async()=>({id:"admin"}),asActor:async(_actor,fn)=>fn(fakeClient),responseError:e=>{throw e;},ApiError:class extends Error{}},
 "@/lib/server/denue":denue,
 "@/lib/server/crm-directory-metrics":load(read("lib/server/crm-directory-metrics.ts")),
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
assert.ok(select.sql.includes("NULLIF(trim(phone),'') IS NOT NULL"));
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

assert.match(crmUi,/\[category,setCategory\]=useState\("pilot_food"\)/);
assert.match(crmUi,/\["neighborhood","Colonia o barrio"\]/);
assert.match(crmUi,/crm-table-top-scroll/);
assert.match(crmUi,/with_phone/);assert.match(crmUi,/with_website/);
assert.match(crmRoute,/neighborhood ILIKE/);


// The open directory is stable until an explicit action changes the query.
assert.doesNotMatch(crmUi,/setInterval|activityRevision|addEventListener\("focus"/);
assert.match(crmUi,/useCrmMailSync\(\(\)=>\{\},!marketingOnly&&tab==="mail"\)/);
assert.doesNotMatch(read("components/CrmContactHistory.tsx"),/setInterval/);
assert.match(crmUi,/crm-map-toggle/);
assert.match(crmUi,/Ver mapa de negocios/);
const mapUi=read("components/CrmMap.tsx");
assert.match(mapUi,/radius=\{4\}/);
assert.match(mapUi,/color:"#ffffff",weight:1\.5/);
assert.match(mapUi,/fillColor:"#a9213d"/);
assert.match(crmUi,/Datos de contacto/);
assert.match(crmUi,/Seguimiento comercial/);
assert.match(crmUi,/Llamar/);
assert.match(crmUi,/Enviar correo/);
assert.match(crmUi,/Guardar cambios/);
assert.match(crmUi,/JSON\.stringify\(\{id:focus\.id,status:focus\.status,notes:focus\.notes\|\|""\}\)/);
assert.doesNotMatch(crmUi,/URL de la fuente pública|Fuente revisada \(URL\)|Coordenadas:/);
assert.match(crmUi,/historyOpen&&<CrmContactHistory/);


// Branded initial load waits for both directory and filter options; refreshes stay inline.
assert.match(crmUi,/data&&!loading&&!optionsLoading&&!optionsError/);
assert.match(crmUi,/if\(tab==="directory"&&!initialReady\)/);
assert.match(crmUi,/CrmLoading title="Preparando tu CRM"/);
assert.match(crmUi,/CrmLoadError title="No se pudo preparar el CRM"/);
assert.match(crmUi,/crm-results-status/);
assert.match(crmUi,/loading:\(\)=> <CrmMapLoading\/>/);
assert.match(mapUi,/view=contact&id=/);
for(const label of ["Teléfono","Correo","Web","Instagram","Dirección","Llamar","Enviar correo"])assert.ok(mapUi.includes(label),label);
assert.match(mapUi,/contact\?\.status==="do_not_contact"/);
assert.match(crmRoute,/WHERE id=\$1::uuid",\[id\]/);
assert.match(crmRoute,/p\.get\("view"\)==="contact"/);
const contactId="12345678-1234-1234-1234-123456789abc";
queries.length=0;
await assert.rejects(()=>crm.GET({url:"https://example.com/api/local/admin/crm?view=contact&id="+contactId}),/Negocio no disponible/);
const contactQuery=queries.find(q=>q.sql.includes("WHERE id=$1::uuid"));
assert.deepEqual(contactQuery.params,[contactId]);
assert.match(contactQuery.sql,/phone,email,public_email,website,instagram,status,notes/);
await assert.rejects(()=>crm.GET({url:"https://example.com/api/local/admin/crm?view=contact&id=invalid"}),/Negocio no válido/);
console.log("CRM map: scoped contact lookup, validated UUID and branded loading states.");

assert.match(mapUi,/navigator\.clipboard\.writeText\(value\)/);
assert.match(mapUi,/<CopyContact value=\{f.value\} label=\{f.label\}/);
assert.match(mapUi,/channels\.instagram>0/);
assert.match(mapUi,/map_channels=/);
assert.match(crmRoute,/const chosen=channels\.filter/);
assert.match(crmRoute,/chosen\.map\(key=>"has_"\+key\)\.join\(" OR "\)/);
queries.length=0;
await crm.GET({url:"https://example.com/api/local/admin/crm?view=map&country_code=MX&map_channels=email,phone,malicious"});
const mapQuery=queries.find(q=>q.sql.startsWith("WITH raw AS MATERIALIZED"));
assert.match(mapQuery.sql,/FROM available WHERE has_email OR has_phone\)/);
assert.doesNotMatch(mapQuery.sql,/malicious/);
assert.deepEqual(mapQuery.params,["MX"]);
assert.match(mapQuery.sql,/FROM selected ORDER BY name,id LIMIT 5000/);
assert.match(mapQuery.sql,/count\(\*\) FILTER \(WHERE has_instagram\)/);

const osm=load(read("lib/server/crm-osm.ts"),{"./denue":denue,"./db":{ApiError:class extends Error{}}},{TextDecoder});
const osmHeader="nombre,categoria,pais,estado,municipio,ciudad,direccion,barrio,telefono,whatsapp,email,web,instagram,facebook,latitud,longitud,osm_tipo,osm_id,url_osm,etiqueta_osm,codigo_postal,horario,fuente\n";
const osmRow=(id,state="Miranda",kind="node")=>["Café ficticio","Cafetería","Venezuela",state,"Chacao","","","", "+58 412 1234567","+58 412 1234567","","https://example.com","@example","example","10.5","-66.85",kind,String(id),"https://www.openstreetmap.org/"+kind+"/"+id,"amenity=cafe","1060","Mo-Su 08:00-18:00","OpenStreetMap"].join(",")+"\n";
const bytes=Buffer.from("\uFEFF"+osmHeader+osmRow(1)+osmRow(1)+osmRow(1,"Miranda","way")+osmRow(2,""));
const parsedOsm=osm.parseOsmCsv(bytes);
assert.equal(parsedOsm.prospects.length,2);assert.equal(parsedOsm.skipped,2);
const op=parsedOsm.prospects[0];assert.equal(op.email,null);assert.equal(op.country_code,"VE");assert.equal(op.category,"Restaurantes y cafeterías");assert.equal(op.latitude,"10.5");assert.equal(op.instagram,"@example");assert.equal(op.facebook,"example");assert.equal(op.whatsapp,"+58 412 1234567");assert.equal(op.postal_code,"1060");assert.equal(op.source_data.horario,"Mo-Su 08:00-18:00");
assert.notEqual(parsedOsm.prospects[0].source_id,parsedOsm.prospects[1].source_id);
const qOsm=[];const clientOsm={query:async(sql,args=[])=>{qOsm.push({sql,args});return {rows:[],rowCount:0};}};
const fOsm={filename:"osm-venezuela-20261126.csv",sha256:"a".repeat(64),data:bytes};
const prevOsm=await osm.importOsm(clientOsm,fOsm,"preview");assert.equal(prevOsm.counts.create,2);assert.ok(qOsm.every(q=>q.sql.startsWith("SELECT")));
qOsm.length=0;await assert.rejects(()=>osm.importOsm(clientOsm,fOsm,"apply","bad"),/Vuelve a analizar/);
assert.ok(qOsm.every(q=>q.sql.startsWith("SELECT")));
qOsm.length=0;const resultOsm=await osm.importOsm(clientOsm,fOsm,"apply",prevOsm.plan);assert.equal(resultOsm.created,2);assert.ok(qOsm.some(q=>q.sql.includes("ON CONFLICT(source,source_id)")));assert.ok(qOsm.some(q=>q.sql.includes("crm_email_exclusions")));
assert.match(library,/crm_staged_csv/);assert.match(library,/parseOsmCsv/);
assert.match(mapUi,/Con Facebook/);assert.match(mapUi,/Con WhatsApp/);
console.log("CRM Venezuela: source identity, no email required, social data, missing geography, preview and non-destructive apply.");
