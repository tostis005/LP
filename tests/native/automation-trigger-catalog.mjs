import assert from "node:assert/strict";
import pg from "pg";
import {randomUUID} from "node:crypto";
// This suite tests the six real trigger types in a disposable CI database
// without exposing customer data or generating real notifications.
const pool=new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,max:1});
const db=await pool.connect();
const q=(sql,args=[])=>db.query(sql,args);
const ids={owner:randomUUID(),customer:randomUUID(),business:randomUUID()};
let membership;
try{
 await q("BEGIN");
 for(const person of ["owner","customer"]){
  await q("INSERT INTO auth.users(id,email,password_hash,raw_user_meta_data,email_confirmed_at) VALUES($1,$2,'test','{}'::jsonb,now())",
   [ids[person],person+"-"+randomUUID()+"@example.test"]);
 }
 await q("INSERT INTO public.businesses(id,name,slug,active) VALUES($1,'Automation QA',$2,true)",
  [ids.business,"flow-"+ids.business.slice(0,8)]);
 await q("INSERT INTO public.loyalty_programs(business_id,type,reward_cost,max_stamps_per_action,min_seconds_between_awards) VALUES($1,'stamps',3,10,0)",[ids.business]);
 await q("INSERT INTO public.business_members(business_id,user_id,role) VALUES($1,$2,'owner')",[ids.business,ids.owner]);
 await q("SELECT set_config('request.jwt.claim.sub',$1,true)",[ids.owner]);
 await q("INSERT INTO public.marketing_consents(business_id,customer_id,opted_in) VALUES($1,$2,true)",[ids.business,ids.customer]);
 const makeRule=async(kind,fields={})=>{
  const offer=(await q("INSERT INTO public.business_offers(business_id,created_by,title,preview,details) VALUES($1,$2,$3,'Resumen automático','Detalle del flujo') RETURNING id",
   [ids.business,ids.owner,kind+" automátic"+(kind==="signup"?"a":"o")])).rows[0].id;
  const r=await q("INSERT INTO public.automation_rules(business_id,created_by,offer_id,name,trigger_kind,delay_days,target_stamps,window_days,target_visits,inactivity_days,staff_instruction) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'') RETURNING id",
   [ids.business,ids.owner,offer,"Regla "+kind,kind,fields.delay||0,
    fields.stamps??null,fields.window??null,fields.visits??null,fields.inactivity??null]);
  return r.rows[0].id;
 };
 const signup=await makeRule("signup",{delay:0});
 const noVisit=await makeRule("no_visit",{inactivity:3});
 const visits=await makeRule("visits",{visits:2});
 const inactive=await makeRule("inactivity",{inactivity:14});
 const redeem=await makeRule("first_redeem",{delay:0});
 const stamp=await makeRule("stamps",{stamps:3,window:30});
 membership=(await q("INSERT INTO public.loyalty_memberships(business_id,customer_id) VALUES($1,$2) RETURNING id",
  [ids.business,ids.customer])).rows[0].id;
 const list=async()=>((await q("SELECT rule_id,status,due_at FROM public.automation_queue WHERE membership_id=$1",[membership])).rows);
 let jobs=await list();
 assert.deepEqual(new Set(jobs.map(x=>x.rule_id)),new Set([signup,noVisit]),"Only enrollment events fire on signup");
 // First purchase: no visit-threshold yet; inactivity is scheduled.
 await q("INSERT INTO public.loyalty_transactions(business_id,membership_id,kind,amount_delta,employee_id) VALUES($1,$2,'earn',1,$3)",
  [ids.business,membership,ids.owner]);
 jobs=await list();
 assert.ok(jobs.some(x=>x.rule_id===inactive),"Inactivity counts down from last verified purchase");
 assert.ok(!jobs.some(x=>x.rule_id===visits),"Two-visit rule does not fire on one purchase");
 // The no-first-visit reminder should be suppressed after the first purchase.
 await q("UPDATE public.automation_queue SET due_at=now()-interval '1 minute' WHERE rule_id=$1",[noVisit]);
 await q("SELECT * FROM public.dispatch_due_automations(100)");
 jobs=await list();
 assert.equal(jobs.find(x=>x.rule_id===noVisit).status,"skipped","No first-visit reminder for an active customer");
 assert.equal(jobs.find(x=>x.rule_id===signup).status,"delivered");
 // Second purchase triggers repeat-visit rule, and resets inactivity timer.
 await q("INSERT INTO public.loyalty_transactions(business_id,membership_id,kind,amount_delta,employee_id) VALUES($1,$2,'earn',1,$3)",
  [ids.business,membership,ids.owner]);
 jobs=await list();
 assert.ok(jobs.some(x=>x.rule_id===visits),"Two visits trigger a loyalty milestone");
 assert.equal(jobs.filter(x=>x.rule_id===inactive).length,1,"Inactivity queue remains idempotent");
 // A third purchase alone is not automatically three stamps awarded in this test.
 await q("UPDATE public.loyalty_memberships SET total_earned=3,balance=3 WHERE id=$1",[membership]);
 jobs=await list();
 assert.ok(jobs.some(x=>x.rule_id===stamp),"Stamp milestone is based on actual earned stamps");
 await q("INSERT INTO public.loyalty_transactions(business_id,membership_id,kind,amount_delta) VALUES($1,$2,'redeem',-3)",
  [ids.business,membership]);
 jobs=await list();
 assert.ok(jobs.some(x=>x.rule_id===redeem),"First reward redemption triggers one congratulatory flow");
 // Inactivity cannot be sent with a fresh, verified purchase.
 await q("UPDATE public.automation_queue SET due_at=now()-interval '1 minute' WHERE rule_id=$1",[inactive]);
 await q("SELECT * FROM public.dispatch_due_automations(100)");
 jobs=await list();
 assert.equal(jobs.find(x=>x.rule_id===inactive).status,"skipped","Do not reactivate a customer who already returned");
 const inbox=(await q("SELECT count(*)::integer n FROM public.offer_receipts WHERE customer_id=$1",[ids.customer])).rows[0].n;
 assert.equal(inbox,4,"Only signup, visits, stamp and redemption notifications are delivered");
 // Returning after a skipped inactivity reminder restarts the clock, not an immediate message.
 await q("INSERT INTO public.loyalty_transactions(business_id,membership_id,kind,amount_delta,employee_id) VALUES($1,$2,'earn',1,$3)",
  [ids.business,membership,ids.owner]);
 jobs=await list();
 assert.equal(jobs.find(x=>x.rule_id===inactive).status,"pending");
 assert.ok(new Date(jobs.find(x=>x.rule_id===inactive).due_at).getTime()>Date.now());
 console.log("OK: signup, no-first-visit, verified visits, stamps, inactivity and first redemption are real idempotent triggers.");
}finally{await q("ROLLBACK").catch(()=>{});db.release();await pool.end()}
