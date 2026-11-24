import {test} from "node:test";
import assert from "node:assert/strict";
import {analyzeDenue,categoryFor,foodPilotImport} from "../../lib/server/denue.ts";
const header="id,nom_estab,codigo_act,nombre_act,cve_ent,entidad,cve_mun,municipio,cve_loc,localidad,correoelec,www";
const csv=[
 header,
 '1,"Café, prueba",722515,Cafetería,02,Baja California,003,Tecate,0001,Tecate,info@example.com,',
 '2,Barbería,812110,Salón,02,Baja California,003,Tecate,0002,Otra localidad,INFO@EXAMPLE.COM,',
 '3,Auto,811192,Lavado,02,Baja California,003,Tecate,0001,Tecate,,',
 '4,Fábrica,333111,Industria,02,Baja California,003,Tecate,0001,Tecate,info@example.net,',
 '5,Café,722515,Cafetería,02,Baja California,004,Tijuana,0001,Tijuana,contact@example.org,',
 '1,Café duplicado,722515,Cafetería,02,Baja California,003,Tecate,0001,Tecate,info@example.com,'
].join("\r\n");
test("municipality and locality separation, duplicate ID and shared email counts",()=>{
 const {prospects,report}=analyzeDenue(csv,"02003");
 assert.equal(report.total,4);
 assert.equal(report.relevant,3);
 assert.equal(report.withEmail,2);
 assert.equal(report.uniqueEmails,1);
 assert.equal(report.missingOrInvalidEmail,1);
 assert.equal(report.duplicates,1);
 assert.equal(report.byCity.length,2);
 assert.equal(prospects[0].name,"Café, prueba");
 assert.equal(prospects[1].email,"info@example.com");
 assert.equal(analyzeDenue(csv).report.total,5);
});
test("specific autowash rule precedes wider auto repair category",()=>assert.equal(categoryFor("811192"),"Autolavados"));
test("unknown headers are rejected",()=>assert.throws(()=>analyzeDenue("name,email\nx,y")));

test("market analysis observes missing addresses without exposing email values",()=>{
 const seen=[];
 analyzeDenue(csv,"02003",row=>seen.push(row));
 assert.equal(seen.length,3);
 assert.equal(seen.filter(r=>r.hasEmail).length,2);
 assert.equal(seen.filter(r=>!r.hasEmail).length,1);
 assert.equal(seen.some(r=>"email" in r),false);
});

test("food pilot keeps food establishments without email and excludes non-food industries",()=>{
 const input=csv+"\n6,Helados,461170,Helados,02,Baja California,003,Tecate,0001,Tecate,,";
 const {prospects}=foodPilotImport(input,"02003");
 assert.equal(prospects.length,2);
 assert.equal(prospects.filter(r=>r.email===null).length,1);
 assert.equal(prospects.some(r=>r.activity_code==="812110"||r.activity_code==="811192"),false);
});
