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
  [["admin@loyally.local","gestor@loyally.local","empleado@loyally.local","cliente@loyally.local"]]
 )).rows.map(x=>[x.email,x.id]));
 // Una tienda sin importes históricos para verificar el cambio inicial de moneda.
 const biz=(await db.query("INSERT INTO public.businesses(name,slug,active,public_listing) VALUES('Moneda de prueba','test-owner-currency-isolated',true,false) RETURNING id")).rows[0];
 await db.query("INSERT INTO public.loyalty_programs(business_id,type,reward_label,reward_cost) VALUES($1,'stamps','Café',8)",[biz.id]);
 await db.query("INSERT INTO public.business_members(business_id,user_id,role,active) VALUES($1,$2,'owner',true),($1,$3,'employee',true)",[biz.id,users["gestor@loyally.local"],users["empleado@loyally.local"]]);
 await db.query("INSERT INTO public.loyalty_memberships(business_id,customer_id) VALUES($1,$2)",[biz.id,users["cliente@loyally.local"]]);
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
 const option=(await db.query("UPDATE public.reward_options SET cost_cents=150 WHERE business_id=$1 RETURNING id",[biz.id])).rows[0];
 await db.query("UPDATE public.loyalty_programs SET require_purchase_amount=true,reward_cost=1,min_seconds_between_awards=0 WHERE business_id=$1",[biz.id]);
 await db.query("SELECT public.business_save_default_reward_cost($1,200)",[biz.id]);
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
 const card=(await db.query("SELECT id,card_token FROM public.loyalty_memberships WHERE business_id=$1 LIMIT 1",[biz.id])).rows[0];
 assert.ok(card?.card_token,"A real customer card must exist");
 await db.query("SAVEPOINT missing_purchase");
 await assert.rejects(db.query("SELECT public.staff_award_card($1,0,1,NULL)",[card.card_token]),/Indica el importe/);
 await db.query("ROLLBACK TO SAVEPOINT missing_purchase");
 await db.query("SAVEPOINT employee_cost");
 await assert.rejects(db.query("SELECT * FROM public.business_default_reward_cost($1)",[biz.id]),/No autorizado/);
 await db.query("ROLLBACK TO SAVEPOINT employee_cost");
 await db.query("SELECT public.staff_award_card($1::uuid,2500,1,$2::text)",[card.card_token,"TEST-USD-"+Date.now()]);
 await db.query("SELECT public.staff_redeem_card_choice($1,NULL,$2)",[card.card_token,option.id]);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users["gestor@loyally.local"]]);
 await db.query("UPDATE public.reward_options SET cost_cents=350,active=false WHERE id=$1",[option.id]);
 let finance=(await db.query("SELECT * FROM public.business_customer_financials($1)",[biz.id])).rows[0];
 assert.equal(Number(finance.sales_cents),2500);
 assert.equal(Number(finance.reward_cost_cents),150,"Changing catalog cost does not change a recorded redemption");
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users["empleado@loyally.local"]]);
 await db.query("SELECT public.staff_award_card($1,3000,1,$2)",[card.card_token,"TEST-DEFAULT-"+Date.now()]);
 await db.query("SELECT public.staff_redeem_card_choice($1,NULL,NULL)",[card.card_token]);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users["gestor@loyally.local"]]);
 await db.query("SELECT public.business_save_default_reward_cost($1,900)",[biz.id]);
 finance=(await db.query("SELECT * FROM public.business_customer_financials($1)",[biz.id])).rows[0];
 assert.equal(Number(finance.sales_cents),5500);
 assert.equal(Number(finance.reward_cost_cents),350,"Default reward cost is also frozen per redemption");
 const metrics=(await db.query("SELECT * FROM public.business_dashboard_metrics($1,30)",[biz.id])).rows;
 assert.equal(Number(metrics.find(r=>r.metric==="reward_cost_cents").current_value),350);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users["cliente@loyally.local"]]);
 const history=(await db.query("SELECT * FROM public.customer_card_history($1,20,0)",[card.id])).rows;
 assert.equal(history.length,4);
 assert.ok(history.some(r=>r.kind==="redeem"&&r.reward_label==="15% de descuento"));
 assert.ok(!Object.hasOwn(history[0],"cost_cents"),"Internal cost must not be disclosed to customer");
 await db.query("SAVEPOINT customer_finance");
 await assert.rejects(db.query("SELECT * FROM public.business_customer_financials($1)",[biz.id]),/No autorizado/);
 await db.query("ROLLBACK TO SAVEPOINT customer_finance");
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users["gestor@loyally.local"]]);
 await db.query("UPDATE public.loyalty_programs SET require_purchase_amount=false WHERE business_id=$1",[biz.id]);
 assert.equal((await db.query("SELECT * FROM public.business_customer_financials($1)",[biz.id])).rowCount,0,"Disable monetary customer reports");

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
