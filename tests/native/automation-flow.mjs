// End-to-end SQL test: real events, consent, alias, thresholds, delayed receipts
// and one-time gifts. Everything runs inside one rolled-back transaction.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import pg from "pg";
const pool=new pg.Pool({
 host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,max:1
});
const client=await pool.connect();
const id={owner:randomUUID(),staff:randomUUID(),customer:randomUUID(),business:randomUUID()};
const q=(sql,args=[])=>client.query(sql,args);
async function setRole(role,user){
 await q("RESET ROLE");
 await q("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);
 await q("SET LOCAL ROLE "+role);
}
try{
 await q("BEGIN");
 for(const key of ["owner","staff","customer"]){
  await q("INSERT INTO auth.users(id,email,password_hash,raw_user_meta_data,email_confirmed_at) VALUES($1,$2,'test',jsonb_build_object('full_name',$3::text),now())",
   [id[key],key+"-"+id[key]+"@example.test",key==="customer"?"José Antonio Fraga":key]);
 }
 await q("INSERT INTO public.businesses(id,name,slug,active,public_listing) VALUES($1,'Cafetería QA',$2,true,true)",
  [id.business,"automation-"+id.business.slice(0,8)]);
 await q("INSERT INTO public.loyalty_programs(business_id,type,reward_cost,max_stamps_per_action,min_seconds_between_awards) VALUES($1,'stamps',8,10,0)",[id.business]);
 for(const key of ["owner","staff"])await q(
  "INSERT INTO public.business_members(business_id,user_id,role) VALUES($1,$2,$3)",
  [id.business,id[key],key==="owner"?"owner":"employee"]);
 const offer=async(title)=>{
  const r=await q("INSERT INTO public.business_offers(business_id,created_by,title,preview,details,kind) VALUES($1,$2,$3,'Revisa tu tarjeta','Mensaje de prueba','notice') RETURNING id",
   [id.business,id.owner,title]);
  return r.rows[0].id;
 };
 const welcome=await offer("Bienvenida de prueba");
 const milestone=await offer("Regalo especial");
 const addRule=async(offerId,name,kind,target)=>{
  const x=await q("INSERT INTO public.automation_rules(business_id,created_by,offer_id,name,trigger_kind,delay_days,target_stamps,window_days,staff_instruction) VALUES($1,$2,$3,$4,$5,0,$6,$7,$8) RETURNING id",
   [id.business,id.owner,offerId,name,kind,target,kind==="stamps"?30:null,
    kind==="stamps"?"Regalar croissant":"" ]);
  return x.rows[0].id;
 };
 const welcomeId=await addRule(welcome,"Alta reciente","signup",null);
 const targetId=await addRule(milestone,"Meta cinco sellos","stamps",5);
 const membership=(await q(
  "INSERT INTO public.loyalty_memberships(business_id,customer_id) VALUES($1,$2) RETURNING id,card_token",
  [id.business,id.customer])).rows[0];
 let jobs=await q("SELECT rule_id,status FROM public.automation_queue WHERE membership_id=$1",[membership.id]);
 assert.equal(jobs.rowCount,1,"Signup queues once");
 assert.equal(jobs.rows[0].rule_id,welcomeId);
 await q("INSERT INTO public.marketing_consents(business_id,customer_id,opted_in) VALUES($1,$2,true)",[id.business,id.customer]);
 await setRole("lp_auth",id.owner);
 const dispatch=await q("SELECT * FROM public.dispatch_due_automations(10)");
 assert.deepEqual(dispatch.rows,[{delivered:1,skipped:0}],"Consent allows one in-app receipt");
 await setRole("authenticated",id.staff);
 const before=(await q("SELECT * FROM public.staff_card_context($1::uuid)",[membership.id])).rows[0];
 assert.equal(before.customer_label,"José A.","Cashier sees abbreviated name only");
 assert.equal(before.verified_visits,"0");
 assert.equal(before.staff_notes[0].target,5);
 await q("SELECT public.staff_award_card($1::uuid,0,5,NULL)",[membership.card_token]);
 const after=(await q("SELECT * FROM public.staff_card_context($1::uuid)",[membership.id])).rows[0];
 assert.equal(after.earned_total,5,"Five stamps earned");
 assert.equal(after.verified_visits,"1","One verified purchase, not five visits");
 assert.equal(after.staff_notes[0].redeemed,false);
 jobs=await q("SELECT rule_id,status FROM public.automation_queue WHERE membership_id=$1",[membership.id]);
 assert.equal(jobs.rowCount,2,"Threshold queues once");
 await q("SELECT public.staff_claim_automation_bonus($1::uuid,$2::uuid)",[targetId,membership.id]);
 await q("SAVEPOINT duplicate_claim");
 try{await q("SELECT public.staff_claim_automation_bonus($1::uuid,$2::uuid)",[targetId,membership.id]);assert.fail("Duplicate gift was accepted");}
 catch(e){assert.equal(e.code,"P0001")}
 await q("ROLLBACK TO SAVEPOINT duplicate_claim");
 const handed=(await q("SELECT * FROM public.staff_card_context($1::uuid)",[membership.id])).rows[0];
 assert.equal(handed.staff_notes[0].redeemed,true,"Already handed out");
 await setRole("lp_auth",id.owner);
 const second=await q("SELECT * FROM public.dispatch_due_automations(10)");
 assert.deepEqual(second.rows,[{delivered:1,skipped:0}],"Stamp notification delivered exactly once");
 await setRole("authenticated",id.owner);
 const growth=(await q("SELECT * FROM public.business_growth_summary($1::uuid,30)",[id.business])).rows;
 assert.equal(Number(growth.find(x=>x.metric==="new_customers").current_value),1);
 const curve=(await q("SELECT * FROM public.business_growth_series($1::uuid,30)",[id.business])).rows;
 assert.equal(curve.length,6,"Six chart buckets");
 assert.equal(curve.reduce((v,x)=>v+Number(x.verified_visits),0),1,"Visit chart reflects actual stamps operation");
 // A new promotion must never award old stamps retroactively.
 await setRole("postgres",id.owner);
 const lateRule=await addRule(await offer("Promoción posterior"),"Regalo demasiado tarde","stamps",5);
 await setRole("authenticated",id.staff);
 const late=(await q("SELECT * FROM public.staff_card_context($1::uuid)",[membership.id])).rows[0];
 assert.ok(late.staff_notes.every(x=>x.rule_id!==lateRule),"Old threshold should not be advertised");
 await q("SAVEPOINT invalid_claim");
 try{await q("SELECT public.staff_claim_automation_bonus($1::uuid,$2::uuid)",[lateRule,membership.id]);assert.fail("Retroactive gift was accepted");}
 catch(e){assert.equal(e.code,"P0001")}
 await q("ROLLBACK TO SAVEPOINT invalid_claim");
 console.log("OK: signup and stamp triggers, private delivery, growth metrics, aliases and one-time/retroactive gift safeguards.");
}finally{
 await q("ROLLBACK").catch(()=>{});
 client.release();await pool.end();
}
