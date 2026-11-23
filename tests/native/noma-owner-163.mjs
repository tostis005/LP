import assert from "node:assert/strict";
import pg from "pg";
const p=new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,max:1});
const db=await p.connect();
const q=(sql,args=[])=>db.query(sql,args);
try{
 await q("BEGIN");
 const owner=(await q("SELECT id FROM auth.users WHERE lower(email)='gestor@loyally.local'")).rows[0]?.id;
 const admin=(await q("SELECT id FROM auth.users WHERE lower(email)='admin@loyally.local'")).rows[0]?.id;
 const cafe=(await q("SELECT id FROM public.businesses WHERE slug='interno-cafe-noma'")).rows[0]?.id;
 assert.ok(owner&&admin&&cafe,"The provisioned Café Noma, owner and admin must exist");
 const roles=await q("SELECT business_id FROM public.business_members WHERE user_id=$1 AND active AND role IN ('owner','manager')",[owner]);
 assert.deepEqual(roles.rows.map(r=>r.business_id),[cafe],"The owner can only manage Café Noma");
 assert.equal((await q("SELECT count(*)::integer n FROM public.platform_admins WHERE user_id=$1",[admin])).rows[0].n,1);
 const seeded=(await q("SELECT public.seed_internal_noma_to_163() AS n")).rows[0].n;
 assert.ok(seeded>=0,"Seed is safe to run twice");
 const membership=(await q("SELECT count(*)::integer n FROM public.loyalty_memberships WHERE business_id=$1",[cafe])).rows[0].n;
 assert.equal(membership,163,"Show exactly 163 registered Café Noma cards");
 assert.equal((await q("SELECT public.seed_internal_noma_to_163() AS n")).rows[0].n,0,"Idempotent");
 const metrics=(await q(
  "SELECT count(*) FILTER(WHERE t.kind='earn')::integer visits, "+
  "count(*) FILTER(WHERE t.kind='redeem')::integer redemptions, "+
  "count(DISTINCT t.membership_id) FILTER(WHERE t.kind='earn')::integer active "+
  "FROM public.loyalty_transactions t WHERE t.business_id=$1",[cafe])).rows[0];
 assert.ok(metrics.visits>300,"There must be meaningful example visits");
 assert.ok(metrics.redemptions>0,"Some customers should redeem rewards");
 assert.ok(metrics.active>100,"Many example customers should have visited");
 const reconcile=(await q(
  "SELECT count(*)::integer errors FROM public.loyalty_memberships m "+
  "LEFT JOIN LATERAL (SELECT coalesce(sum(amount_delta),0)::integer balance,"+
  " coalesce(sum(amount_delta) FILTER(WHERE kind='earn'),0)::integer total "+
  "FROM public.loyalty_transactions t WHERE t.membership_id=m.id) x ON true "+
  "WHERE m.business_id=$1 AND (m.balance<>x.balance OR m.total_earned<>x.total)",[cafe])).rows[0].errors;
 assert.equal(reconcile,0,"Issued and redeemed stamps must reconcile");
 const fake=(await q("SELECT count(*)::integer n FROM auth.users WHERE email LIKE 'cafe-noma-ejemplo-%@example.invalid' AND email_confirmed_at IS NULL")).rows[0].n;
 assert.ok(fake>=162,"Synthetic users must be unconfirmed and clearly marked");
 const consent=(await q("SELECT count(*)::integer n FROM public.marketing_consents c JOIN auth.users u ON u.id=c.customer_id WHERE u.email LIKE 'cafe-noma-ejemplo-%@example.invalid'")).rows[0].n;
 assert.equal(consent,0,"No marketing permissions for dummy customers");
 await q("SELECT set_config('request.jwt.claim.sub',$1,true)",[owner]);
 const growth=(await q("SELECT * FROM public.business_growth_summary($1::uuid,30)",[cafe])).rows;
 assert.ok(growth.some(x=>x.metric==="habitual_customers"&&Number(x.current_value)>0));
 const directory=(await q("SELECT count(*)::integer n FROM public.business_customer_directory($1::uuid)",[cafe])).rows[0].n;
 assert.equal(directory,163,"Owner's customer directory must show all example cards");
 console.log("OK: owner only Café Noma, admin remains global, 163 demo cards, valid balances/visits/rewards, zero fake consent.");
}finally{await q("ROLLBACK").catch(()=>{});db.release();await p.end();}
