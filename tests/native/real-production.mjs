import assert from "node:assert/strict";
import pg from "pg";
const pool=new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const db=await pool.connect();
try{
 const names=["admin","gestor","empleado","cliente"];
 const mapping={admin:"ADMIN",gestor:"BUSINESS",empleado:"STAFF",cliente:"CUSTOMER"};
 const addresses={ADMIN:"administrador@kreyvi.com",BUSINESS:"owner@kreyvi.com",STAFF:"empleado@kreyvi.com",CUSTOMER:"cliente@kreyvi.com"};
 const rows=(await db.query("SELECT q.role,u.id,u.email FROM auth.qa_profile_accounts q JOIN auth.users u ON u.id=q.user_id")).rows;
 for(const row of rows)assert.equal(row.email,addresses[row.role]);
 const users=Object.fromEntries(names.map(name=>[name,rows.find(row=>row.role===mapping[name])?.id]));
 for(const name of names)assert.ok(users[name],"Real login account missing: "+name);
 const sites=(await db.query("SELECT id,slug,public_listing,card_background FROM public.businesses WHERE slug LIKE 'interno-%'")).rows;
 assert.equal(sites.length,10,"Ten internal locations must be persistent in PostgreSQL");
 assert.ok(sites.every(s=>s.public_listing===true),"QA fixture stores must appear in customer discovery during validation");
 const cafe=sites.find(s=>s.slug==="interno-cafe-noma");assert.ok(cafe);
 const designed=sites.filter(s=>s.slug!=="interno-cafe-noma");
 assert.equal(new Set(designed.map(s=>s.card_background)).size,9);
 assert.ok(designed.every(s=>s.card_background==="/brand/card-designs/gallery-vivid-"+s.slug.slice(8)+".svg"));
 assert.equal((await db.query("SELECT public.apply_internal_showcase_card_designs() AS changed")).rows[0].changed,0,"Do not overwrite existing designs");
 // The upgrade must never override a separately customized internal card.
 await db.query("BEGIN");
 try{
  const fixture=designed[0].id;
  await db.query("UPDATE public.businesses SET card_background='/brand/card-designs/coffee.svg' WHERE id=$1",[fixture]);
  assert.equal((await db.query("SELECT public.apply_internal_showcase_card_designs() AS changed")).rows[0].changed,0);
  assert.equal((await db.query("SELECT card_background FROM public.businesses WHERE id=$1",[fixture])).rows[0].card_background,"/brand/card-designs/coffee.svg");
 }finally{await db.query("ROLLBACK");}
 const owned=await db.query("SELECT count(*)::int n FROM public.business_members WHERE user_id=$1 AND role='owner' AND active",[users.gestor]);
 assert.equal(owned.rows[0].n,1,"Business owner manages only Café Noma; superadmin sees all shops separately");
 const cards=await db.query("SELECT m.id,m.card_token,m.balance FROM public.loyalty_memberships m WHERE m.customer_id=$1",[users.cliente]);
 assert.equal(cards.rowCount,4,"Customer needs four actual cards");
 assert.ok(cards.rows.every(c=>/^[0-9a-f-]{36}$/i.test(c.card_token)),"Every card has a valid QR token");
 const card=(await db.query("SELECT card_token,balance FROM public.loyalty_memberships WHERE customer_id=$1 AND business_id=$2",[users.cliente,cafe.id])).rows[0];
 await db.query("BEGIN");
 await db.query("UPDATE public.business_marketing_rates SET price_cents=41,whatsapp_price_cents=85,push_price_cents=25,currency='EUR' WHERE business_id=$1",[cafe.id])
  .then(async r=>{if(r.rowCount===0)await db.query("INSERT INTO public.business_marketing_rates(business_id,price_cents,whatsapp_price_cents,push_price_cents,currency) VALUES($1,41,85,25,'EUR')",[cafe.id])});
 await db.query("SET LOCAL ROLE authenticated");
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users.gestor]);
 const quote=await db.query("SELECT * FROM public.business_mail_quote($1::uuid)",[cafe.id]);
 assert.equal(quote.rows[0]?.currency,"EUR","Manager must read the admin's configured currency");
 assert.equal(Number(quote.rows[0]?.price_cents),41,"Manager must read the admin's exact price");
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users.empleado]);
 const found=await db.query("SELECT * FROM public.staff_lookup_card($1::uuid)",[card.card_token]);
 assert.ok(found.rowCount,"Staff must see the customer's real QR");
 const result=await db.query("SELECT public.staff_award_card($1::uuid,0,1,$2::text) as balance",[card.card_token,"CI-AUTHENTIC-"+Date.now()]);
 assert.equal(Number(result.rows[0].balance),Number(card.balance)+1,"Stamps must update the real balance");
 await db.query("RESET ROLE");
 const persisted=await db.query("SELECT balance FROM public.loyalty_memberships WHERE card_token=$1",[card.card_token]);
 assert.equal(Number(persisted.rows[0].balance),Number(card.balance)+1,"Award must persist within the database transaction");
 await db.query("ROLLBACK");
 console.log("OK: four real accounts, ten private stores, QR, staff transactions and business pricing share PostgreSQL.");
}catch(e){await db.query("ROLLBACK").catch(()=>{});throw e}
finally{db.release();await pool.end()}
