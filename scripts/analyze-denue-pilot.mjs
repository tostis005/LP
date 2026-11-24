import {readFileSync} from "node:fs";
import {analyzeDenue,decodeDenue} from "../lib/server/denue.ts";
const paths=process.argv.slice(2);
if(!paths.length)throw Error("No DENUE CSV files found");
const counters=()=>({total:0,withEmail:0,missingEmail:0,missingWithWebsite:0});
function add(x,row){x.total++;if(row.hasEmail)x.withEmail++;else{x.missingEmail++;if(row.hasWebsite)x.missingWithWebsite++;}}
for(const path of paths){
 const b=readFileSync(path);
 const csv=decodeDenue(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 const all={...counters()},pilot={...counters()},byActivity=new Map(),byMunicipality=new Map(),pilotActivity=new Map(),samples=new Map();
 analyzeDenue(csv,"",row=>{
  const code=row.activity_code;
  if(!code.startsWith("7225")&&code!=="461170"&&code!=="311520")return;
  add(all,row);
  const a=byActivity.get(code)||{code,activity:row.activity,...counters()};add(a,row);byActivity.set(code,a);
  const key=row.state_code+row.municipality_code;
  const m=byMunicipality.get(key)||{key,municipality:row.municipality,...counters()};add(m,row);byMunicipality.set(key,m);
  if(key!=="02003")return;
  add(pilot,row);
  const pa=pilotActivity.get(code)||{code,activity:row.activity,...counters()};add(pa,row);pilotActivity.set(code,pa);
  if(row.city!=="Tecate"||row.hasEmail||!row.hasWebsite)return;
  const group=code==="722515"?"cafeterias_neverias":code==="461170"?"heladerias":code==="311520"?"fabricacion":"restaurantes";
  const name=row.name.trim();
  if(!name||/sin nombre|sin denominaci[oó]n/i.test(name))return;
  const list=samples.get(group)||[];
  if(list.length<3&&!list.some(x=>x.name===name))list.push({name,city:row.city,activity_code:code});
  samples.set(group,list);
 });
 console.log(JSON.stringify({focus:{all,pilot,byActivity:[...byActivity.values()].sort((a,b)=>a.code.localeCompare(b.code)),pilotActivity:[...pilotActivity.values()].sort((a,b)=>a.code.localeCompare(b.code)),byMunicipality:[...byMunicipality.values()].sort((a,b)=>b.total-a.total)},publicNameSample:Object.fromEntries(samples)},null,2));
}
