import {readFileSync} from "node:fs";
import {analyzeDenue,decodeDenue} from "../lib/server/denue.ts";
const paths=process.argv.slice(2);
if(!paths.length)throw Error("No DENUE CSV files found");
const reports=[];
for(const path of paths){
 const b=readFileSync(path);
 const {report}=analyzeDenue(decodeDenue(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),"02003");
 reports.push(report);
}
// Only aggregate statistics, never contact details.
console.log(JSON.stringify(reports,null,2));
if(!reports.some(r=>r.total>0))throw Error("No establishments found for Tecate");
