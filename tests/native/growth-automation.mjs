import assert from "node:assert/strict";
import pg from "pg";
const connect=(user,password)=>new pg.Pool({
 host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,user,password,max:2
});
const root=connect(process.env.POSTGRES_USER,process.env.POSTGRES_PASSWORD);
const auth=connect("lp_auth",process.env.AUTH_DB_PASSWORD);
const api=connect("lp_api",process.env.APP_DB_PASSWORD);
try{
 for(const table of ["automation_rules","automation_queue","automation_bonus_claims"]){
  const result=await root.query("SELECT relrowsecurity AS enabled FROM pg_class WHERE oid=$1::regclass",["public."+table]);
  assert.equal(result.rows[0].enabled,true,table+" should require row level security");
 }
 for(const func of [
  "public.business_growth_series(uuid,integer)",
  "public.business_growth_summary(uuid,integer)",
  "public.staff_card_context(uuid)",
  "public.staff_claim_automation_bonus(uuid,uuid)",
  "public.dispatch_due_automations(integer)"
 ]){
  const result=await root.query("SELECT to_regprocedure($1) IS NOT NULL AS present",[func]);
  assert.ok(result.rows[0]?.present,"Missing "+func);
 }
 const pending=await auth.query("SELECT * FROM public.dispatch_due_automations(100)");
 assert.deepEqual(pending.rows,[{delivered:0,skipped:0}],"Empty queue should dispatch no messages");
 const staff=await api.connect();
 try{
  await staff.query("BEGIN");
  await staff.query("SET LOCAL ROLE authenticated");
  for(const sql of ["SELECT public.dispatch_due_automations(1)","SELECT * FROM public.automation_queue LIMIT 1"]){
   await staff.query("SAVEPOINT denied");
   try{await staff.query(sql);assert.fail("Authenticated users cannot process the private automation queue");}
   catch(e){assert.equal(e.code,"42501","Operation must be denied by SQL grants");}
   await staff.query("ROLLBACK TO SAVEPOINT denied");
  }
  await staff.query("ROLLBACK");
 }finally{staff.release();}
 console.log("OK: owner growth RPCs, automation triggers, private queue and worker authority.");
}finally{await Promise.all([root.end(),auth.end(),api.end()])}
