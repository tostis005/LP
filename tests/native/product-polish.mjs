import assert from "node:assert/strict";
import pg from "pg";
const pool=new pg.Pool({
 host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD
});
const db=await pool.connect();
try{
 await db.query("BEGIN");
 const users=Object.fromEntries((await db.query(
  "SELECT id,email FROM auth.users WHERE email=ANY($1::text[])",
  [["admin@loyally.local","gestor@loyally.local","empleado@loyally.local"]]
 )).rows.map(x=>[x.email,x.id]));
 const biz=(await db.query("SELECT id FROM public.businesses WHERE slug='interno-cafe-noma'")).rows[0];
 assert.ok(biz?.id,"CI business must exist");
 for(const email of ["admin@loyally.local","gestor@loyally.local","empleado@loyally.local"])assert.ok(users[email],email);
 await db.query("SET LOCAL ROLE authenticated");
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users["admin@loyally.local"]]);
 await db.query("SELECT public.admin_set_business_currency($1::uuid,'USD')",[biz.id]);
 let result=await db.query("SELECT currency FROM public.businesses WHERE id=$1",[biz.id]);
 assert.equal(result.rows[0].currency,"USD","Admin configures the business currency");
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users["gestor@loyally.local"]]);
 await db.query("INSERT INTO public.reward_options(business_id,label,active,position) VALUES($1,'15% de descuento',true,0)",[biz.id]);
 result=await db.query("SELECT retail_cents,cost_cents FROM public.reward_options WHERE business_id=$1 AND label='15% de descuento'",[biz.id]);
 assert.equal(result.rows[0]?.retail_cents,null,"Rewards do not need retail price");
 assert.equal(result.rows[0]?.cost_cents,null,"Rewards do not need business cost");
 await db.query("SAVEPOINT protected_update");
 await assert.rejects(
  db.query("SELECT public.admin_set_business_currency($1::uuid,'EUR')",[biz.id]),
  /No autorizado/i
 );
 await db.query("ROLLBACK TO SAVEPOINT protected_update");
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users["empleado@loyally.local"]]);
 await db.query("SAVEPOINT protected_catalog");
 await assert.rejects(
  db.query("INSERT INTO public.reward_options(business_id,label,active,position) VALUES($1,'Regalo no autorizado',true,0)",[biz.id]),
  /row-level security|permission denied/i
 );
 await db.query("ROLLBACK TO SAVEPOINT protected_catalog");
 const card=(await db.query("SELECT card_token FROM public.loyalty_memberships WHERE business_id=$1 LIMIT 1",[biz.id])).rows[0];
 assert.ok(card?.card_token,"A real customer card must exist");
 await db.query("SELECT public.staff_award_card($1::uuid,2500,1,$2::text)",[card.card_token,"TEST-USD-"+Date.now()]);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users["admin@loyally.local"]]);
 await db.query("SAVEPOINT protected_money");
 await assert.rejects(
  db.query("SELECT public.admin_set_business_currency($1::uuid,'EUR')",[biz.id]),
  /La moneda no puede cambiarse con importes históricos/i
 );
 await db.query("ROLLBACK TO SAVEPOINT protected_money");
 await db.query("ROLLBACK");
 console.log("OK: currencies, nullable reward prices and permission isolation enforced by PostgreSQL.");
}catch(e){await db.query("ROLLBACK").catch(()=>{});throw e}
finally{db.release();await pool.end()}
