import {readFileSync} from "node:fs";
import {analyzeDenue,decodeDenue} from "../lib/server/denue.ts";
const paths=process.argv.slice(2);
if(!paths.length)throw Error("No DENUE CSV files found");
for(const path of paths){
 const b=readFileSync(path);
 const csv=decodeDenue(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 const {report}=analyzeDenue(csv,"02003");
 if(report.total)console.log(JSON.stringify({pilot:{...report,byCity:report.byCity.filter(x=>x.relevant>0)}},null,2));
 const {report:all}=analyzeDenue(csv);
 const mun=new Map();
 for(const city of all.byCity){
  const key=city.state_code+city.municipality_code;
  const row=mun.get(key)||{state:city.state,municipality:city.municipality,key,total:0,relevant:0,withEmail:0};
  row.total+=city.total;row.relevant+=city.relevant;row.withEmail+=city.withEmail;mun.set(key,row);
 }
 console.log(JSON.stringify({state:{total:all.total,relevant:all.relevant,withEmail:all.withEmail,uniqueEmails:all.uniqueEmails,municipalities:[...mun.values()].sort((a,b)=>b.withEmail-a.withEmail),bySector:all.bySector}},null,2));
}
