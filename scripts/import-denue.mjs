import {readFileSync} from "node:fs";
import pg from "pg";
import {analyzeDenue,decodeDenue} from "../lib/server/denue.ts";
// Explicit operator command, never sends mail. The archive stays on the server.
const args=process.argv.slice(2);
const edition=args.shift(), scope=args.shift();
if(!/^\d{4}-\d{2}$/.test(edition||"")||!scope||!(scope==="all"||/^\d{5}$/.test(scope))||!args.length)throw Error("Usage: import-denue.mjs YYYY-MM all|municipality CSV...");
const pool=new pg.Pool({host:process.env.PGHOST||"db",port:5432,database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,max:1});
const c=await pool.connect();
try{
 for(const path of args){
  const b=readFileSync(path);
  const data=analyzeDenue(decodeDenue(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),scope==="all"?"":scope);
  if(!data.report.total)throw Error("No matching establishments in input");
  const stateCodes=[...new Set(data.report.byCity.map(x=>x.state_code))];
  const key="DENUE "+edition+" "+scope+" "+path.split("/").at(-1);
  await c.query("BEGIN");
  try{
   await c.query("SELECT pg_advisory_xact_lock(hashtext('kreyvi-denue-import'))");
   if((await c.query("SELECT 1 FROM public.crm_import_runs WHERE filename=$1",[key])).rowCount){
    await c.query("COMMIT");console.log("Already imported: "+key);continue;
   }
   let imported=0;
   for(let i=0;i<data.prospects.length;i+=500){
    const batch=data.prospects.slice(i,i+500);
    const r=await c.query(
     "INSERT INTO public.crm_prospects(source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website) "+
     "SELECT source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,website "+
     "FROM jsonb_to_recordset($1::jsonb) AS x(source_id text,name text,country_code text,state_code text,state text,municipality_code text,municipality text,locality_code text,city text,activity_code text,activity text,category text,email text,website text) "+
     "ON CONFLICT(source,source_id) DO NOTHING",
     [JSON.stringify(batch)]);
    imported+=r.rowCount||0;
   }
   await c.query("UPDATE public.crm_prospects p SET status='do_not_contact',updated_at=now() WHERE p.status<>'do_not_contact' AND EXISTS (SELECT 1 FROM public.crm_email_exclusions e WHERE e.email=lower(p.email))");
   await c.query("INSERT INTO public.crm_import_runs(filename,report) VALUES($1,$2::jsonb)",[key,JSON.stringify({...data.report,edition,scope,stateCode:stateCodes.length===1?stateCodes[0]:null,imported})]);
   await c.query("COMMIT");
   console.log(JSON.stringify({edition,scope,imported,total:data.report.total,relevant:data.report.relevant,withEmail:data.report.withEmail,uniqueEmails:data.report.uniqueEmails}));
  }catch(e){await c.query("ROLLBACK");throw e;}
 }
 const summary=(await c.query("SELECT count(*)::int AS prospects,count(DISTINCT lower(email))::int AS unique_emails FROM public.crm_prospects")).rows[0];
 console.log(JSON.stringify({crm:summary}));
}catch(e){
 // Do not print raw database errors, which can include contact information.
 console.error("CRM import failed",e?.code||"ERROR");process.exitCode=1;
}finally{c.release();await pool.end();}
