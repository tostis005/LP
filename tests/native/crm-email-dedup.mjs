import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import pg from "pg";
assert.equal(process.env.POSTGRES_DB,"lp_test","Only run against isolated CI database");
const pool=new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,max:1});
const c=await pool.connect(),tag=randomUUID(),address=tag+"@example.test",failed=tag+"-failed@example.test",delivered=tag+"-external@example.test";
try{
 await c.query("BEGIN");
 const user=(await c.query("INSERT INTO auth.users(email,password_hash,email_confirmed_at) VALUES($1,'test-only',now()) RETURNING id",[tag+"-admin@example.test"])).rows[0].id;
 await c.query("INSERT INTO public.platform_admins(user_id) VALUES($1)",[user]);
 await c.query("SET LOCAL ROLE authenticated");
 await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);
 const add=async(n,email,status="pending_review",city="Puebla",publicEmail=null)=>{
  const r=await c.query("INSERT INTO public.crm_prospects(source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,public_email,public_email_source,public_email_checked_at,status,contact_review) VALUES($1,$2,'MX','21','Puebla','114','Puebla','0001',$3,'722515','Cafetería','Restaurantes y cafeterías',$4,$5,CASE WHEN $5::text IS NULL THEN NULL ELSE 'https://example.test/contact' END,CASE WHEN $5::text IS NULL THEN NULL ELSE now() END,$6,CASE WHEN $5::text IS NULL THEN 'pending' ELSE 'source_found' END) RETURNING status",[tag+n,n,city,email,publicEmail,status]);
  return r.rows[0].status;
 };
 // Exercise the actual campaign SELECT, not a hand-written approximation.
 const route=readFileSync(new URL("../../app/api/local/admin/crm/campaigns/puebla/route.ts",import.meta.url),"utf8");
 const sqlSource=route.match(/const sql=([\s\S]*?);\n return \(await c.query<Candidate>/)?.[1];
 assert.ok(sqlSource);
 const query=sqlSource.match(/"(?:\\.|[^"\\])*"/g).map(value=>JSON.parse(value)).join("");
 const shared=tag+"-shared@example.test";
 for(let i=0;i<30;i++)await add("shared"+i,null,"pending_review","Puebla",i%2?shared.toUpperCase():shared);
 const selected=(await c.query(query,[null,30])).rows.filter(row=>row.email===shared);
 assert.equal(selected.length,1);
 await c.query("INSERT INTO public.crm_mail_attempts(id,recipient) VALUES($1,$2)",[randomUUID(),shared]);
 assert.equal((await c.query(query,[null,30])).rows.filter(row=>row.email===shared).length,0);
 await c.query("SELECT public.crm_record_contacted_email($1)",[shared]);
 assert.equal((await c.query("SELECT count(*)::int AS n FROM public.crm_prospects WHERE source_id LIKE $1 AND status='contacted'",[tag+"shared%"])).rows[0].n,30);
 const get=async(n)=>(await c.query("SELECT status FROM public.crm_prospects WHERE source_id=$1",[tag+n])).rows[0].status;
 const blocked=async(email)=>(await c.query("SELECT public.crm_email_blocked_for_first_contact($1) AS blocked",[email])).rows[0].blocked;
 for(let i=0;i<30;i++)await add("duplicate"+i,i%2?address.toUpperCase():address,"pending_review",i%2?"Puebla":"León");
 await add("public",null,"qualified","Puebla",address);
 await add("advanced",address,"interested");
 await add("excluded",address,"do_not_contact");
 // A separate set tests a first contact that has no previous contact state.
 const fresh=tag+"-fresh@example.test";
 await add("fresh1",fresh);await add("fresh2",null,"qualified","León",fresh.toUpperCase());
 assert.equal(await blocked(fresh),false);
 assert.equal(await blocked(address),true); // another record has advanced/blocked status
 await c.query("INSERT INTO public.crm_mail_attempts(id,recipient) VALUES($1,$2)",[randomUUID(),fresh]);
 assert.equal(await blocked(fresh.toUpperCase()),true);
 assert.equal(await get("fresh1"),"pending_review"); // attempt alone is not contact
 await c.query("SELECT public.crm_record_contacted_email($1)",[" "+fresh.toUpperCase()+" "]);
 assert.equal(await get("fresh1"),"contacted");assert.equal(await get("fresh2"),"contacted");
 await c.query("SELECT public.crm_record_contacted_email($1)",[address]);
 for(let i=0;i<30;i++)assert.equal(await get("duplicate"+i),"contacted");
 assert.equal(await get("public"),"contacted");
 assert.equal(await get("advanced"),"interested");assert.equal(await get("excluded"),"do_not_contact");
 assert.equal(await add("late",address,"pending_review","Otra ciudad"),"contacted");
 await c.query("UPDATE public.crm_prospects SET status='qualified' WHERE source_id=$1",[tag+"late"]);
 assert.equal(await get("late"),"contacted");
 await add("failed",failed);
 await c.query("INSERT INTO public.crm_mail_attempts(id,recipient) VALUES($1,$2)",[randomUUID(),failed]);
 assert.equal(await blocked(failed),true);assert.equal(await get("failed"),"pending_review");
 await add("external",delivered);
 await c.query("INSERT INTO public.crm_mail_history(mailbox,source,external_id,correspondent,direction,occurred_at,delivery_status) VALUES($1,'logs',$2,$3,'outbound',now(),'delivered')",[tag+"@example.test",tag,delivered.toUpperCase()]);
 assert.equal(await get("external"),"contacted");assert.equal(await blocked(delivered),true);
 assert.equal(await add("external-late",delivered),"contacted");
 // Direct anonymous execution is denied.
 await c.query("RESET ROLE");await c.query("SET LOCAL ROLE anon");await c.query("SAVEPOINT anon_test");
 await assert.rejects(c.query("SELECT public.crm_record_contacted_email($1)",[address]),{code:"42501"});
 await c.query("ROLLBACK TO SAVEPOINT anon_test");
 console.log("CRM global: 30 duplicados, normalización, nuevos registros, intentos, historial y permisos OK");
}finally{await c.query("ROLLBACK");c.release();await pool.end();}
