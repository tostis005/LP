import assert from "node:assert/strict";
import pg from "pg";
import {randomUUID} from "node:crypto";
const pool=new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,max:1});
const c=await pool.connect();
const q=(sql,params=[])=>c.query(sql,params);
try{
 await q("BEGIN");
 const owner=randomUUID(),business=randomUUID();
 await q("INSERT INTO auth.users(id,email,password_hash,raw_user_meta_data,email_confirmed_at) VALUES($1,$2,'test','{}'::jsonb,now())",
  [owner,"noma-manager-"+randomUUID()+"@example.test"]);
 await q("INSERT INTO public.businesses(id,name,slug,category,active) VALUES($1,'Café Noma','cafe-noma','Cafetería',true)",[business]);
 await q("INSERT INTO public.loyalty_programs(business_id,type,reward_cost,max_stamps_per_action,min_seconds_between_awards) VALUES($1,'stamps',8,3,0)",[business]);
 await q("INSERT INTO public.business_members(business_id,user_id,role) VALUES($1,$2,'owner')",[business,owner]);
 const seeded=await q("SELECT public.seed_cafe_noma_demo_activity() AS n");
 assert.equal(seeded.rows[0].n,20,"Create exactly 20 labeled demo accounts");
 const r=await q(
  "SELECT count(DISTINCT m.id)::integer cards, count(t.id)::integer movements,"+
  " count(t.id) FILTER(WHERE t.kind='earn')::integer purchases,"+
  " count(t.id) FILTER(WHERE t.kind='redeem')::integer redeems,"+
  " min(m.created_at) oldest,max(m.created_at) newest "+
  "FROM public.loyalty_memberships m "+
  "LEFT JOIN public.loyalty_transactions t ON t.membership_id=m.id "+
  "WHERE m.business_id=$1",[business]);
 assert.equal(r.rows[0].cards,20);
 assert.ok(r.rows[0].purchases>50,"Substantial varied purchase data");
 assert.ok(r.rows[0].redeems>0,"Canjes must exist in example history");
 assert.ok(new Date(r.rows[0].oldest)<new Date(r.rows[0].newest),"Vary dates");
 const balances=await q(
  "SELECT count(*)::integer mismatches FROM public.loyalty_memberships m "+
  "LEFT JOIN LATERAL (SELECT coalesce(sum(t.amount_delta),0)::integer total,"+
  "coalesce(sum(t.amount_delta) FILTER(WHERE t.kind='earn'),0)::integer earned "+
  "FROM public.loyalty_transactions t WHERE t.membership_id=m.id) stats ON true "+
  "WHERE m.business_id=$1 AND (m.balance<>stats.total OR m.total_earned<>stats.earned)",[business]);
 assert.equal(balances.rows[0].mismatches,0,"All demo stamp balances must reconcile");
 const fake=await q("SELECT count(*)::integer n FROM auth.users WHERE email LIKE 'noma-demo-%@example.invalid' AND email_confirmed_at IS NULL");
 assert.equal(fake.rows[0].n,20,"Synthetic customers cannot sign in");
 const consent=await q("SELECT count(*)::integer n FROM public.marketing_consents WHERE business_id=$1",[business]);
 assert.equal(consent.rows[0].n,0,"Demo customers never opt into marketing");
 const idempotency=await q("SELECT public.seed_cafe_noma_demo_activity() n");
 assert.equal(idempotency.rows[0].n,0,"Seeding twice must not duplicate rows");
 await q("SELECT set_config('request.jwt.claim.sub',$1,true)",[owner]);
 const series=await q("SELECT * FROM public.business_growth_series($1::uuid,30)",[business]);
 const summary=await q("SELECT * FROM public.business_growth_summary($1::uuid,30)",[business]);
 assert.equal(series.rows.length,6);
 assert.ok(series.rows.some(x=>Number(x.new_customers)>0));
 assert.ok(summary.rows.some(x=>x.metric==="habitual_customers"&&Number(x.current_value)>0));
 console.log("OK: Café Noma fixture contains valid dates, purchases, canjes, balanced stamps, repeat visits and zero marketing consent.");
}finally{await q("ROLLBACK").catch(()=>{});c.release();await pool.end();}
