import assert from "node:assert/strict";
import pg from "pg";

const pool=new pg.Pool({
 host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD
});
const client=await pool.connect();
let transaction=false;
try{
 const user=(await client.query(
  "SELECT id,email FROM auth.users WHERE email='cliente@kreyvi.com'"
 )).rows[0];
 assert.ok(user,"A real customer account exists");
 const business=(await client.query(`
  SELECT b.id FROM public.businesses b
  WHERE b.slug LIKE 'interno-%' AND b.active AND b.public_listing
  AND NOT EXISTS(
   SELECT 1 FROM public.loyalty_memberships m WHERE m.business_id=b.id AND m.customer_id=$1
  ) ORDER BY b.slug LIMIT 2
 `,[user.id])).rows;
 assert.equal(business.length,2,"Two additional discoverable QA merchants exist");

 await client.query("BEGIN"); transaction=true;
 await client.query("SET LOCAL ROLE authenticated");
 await client.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.email',$2,true)",[user.id,user.email]);
 const without=(await client.query(
  "SELECT public.join_program_with_notifications($1::uuid,false) AS card",
  [business[0].id])).rows[0];
 assert.ok(without.card,"The customer gets the real loyalty card even when declining marketing");
 const noMarketing=await client.query(
  "SELECT opted_in,whatsapp_opted_in,push_opted_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id=$2",
  [user.id,business[0].id]);
 assert.equal(noMarketing.rowCount,0,"Declining marketing never creates an opt-in");
 await client.query("SAVEPOINT default_card");
 const defaultCard=(await client.query("SELECT public.join_program_with_notifications($1::uuid,true) AS card",[business[1].id])).rows[0];
 assert.ok(defaultCard.card);
 const defaults=(await client.query("SELECT opted_in,whatsapp_opted_in,push_opted_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id=$2",[user.id,business[1].id])).rows[0];
 assert.deepEqual(defaults,{opted_in:true,whatsapp_opted_in:true,push_opted_in:true},"New card preferences are saved, not merely checked in the UI");
 await client.query("SELECT public.business_upsert_consent($1::uuid,false)",[business[1].id]);
 await client.query("SELECT public.join_program_with_notifications($1::uuid,true)",[business[1].id]);
 assert.equal((await client.query("SELECT opted_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id=$2",[user.id,business[1].id])).rows[0].opted_in,false,"Rejoining never reverses an opt-out");
 await client.query("ROLLBACK TO SAVEPOINT default_card");
 const second=(await client.query(
  "SELECT public.join_program_with_notifications($1::uuid,false) AS card",
  [business[1].id])).rows[0];
 assert.ok(second.card,"A second card can be saved without renewed permission");
 const globalDeclined=(await client.query(
  "SELECT global_business_opt_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id IS NULL",
  [user.id])).rows[0];
 assert.equal(globalDeclined.global_business_opt_in,false,"A declined choice is remembered for later cards");
 await client.query("SAVEPOINT no_phone");
 let rejected=false;
 try{
  await client.query("SELECT public.customer_set_all_notifications(true)");
 }catch(e){rejected=true;assert.match(e.message,/WhatsApp|prefijo/i);}
 assert.equal(rejected,true,"All-channel approval requires a valid WhatsApp contact number");
 await client.query("ROLLBACK TO SAVEPOINT no_phone");

 await client.query("RESET ROLE");
 await client.query(
  "UPDATE auth.users SET raw_user_meta_data=jsonb_set(coalesce(raw_user_meta_data,'{}'::jsonb),'{whatsapp}',to_jsonb($1::text),true) WHERE id=$2",
  ["+526641234567",user.id]);
 await client.query("SET LOCAL ROLE authenticated");
 await client.query("SELECT public.customer_set_all_notifications(true)");
 const approved=(await client.query(
  "SELECT public.join_program_with_notifications($1::uuid,false) AS card",
  [business[1].id])).rows[0];
 assert.ok(approved.card,"The approved global preference is applied without a second opt-in");
 const firstChannels=(await client.query(
  "SELECT opted_in,whatsapp_opted_in,push_opted_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id=$2",
  [user.id,business[0].id])).rows[0];
 assert.deepEqual(firstChannels,{opted_in:true,whatsapp_opted_in:true,push_opted_in:true},"The global choice also updates existing cards");
 const channels=(await client.query(
  "SELECT opted_in,whatsapp_opted_in,push_opted_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id=$2",
  [user.id,business[1].id])).rows[0];
 assert.deepEqual(channels,{opted_in:true,whatsapp_opted_in:true,push_opted_in:true},
  "A single explicit opt-in enables email, WhatsApp and push independently in storage");
 const preferences=await client.query(
  "SELECT business_id,opted_in FROM public.customer_push_preferences() WHERE business_id=$1",
  [business[1].id]);
 assert.equal(preferences.rows[0]?.opted_in,true,"The customer's push settings reflect the approved card");

 await client.query("SELECT public.business_upsert_consent($1::uuid,false)",[business[1].id]);
 const after=(await client.query(
  "SELECT opted_in,whatsapp_opted_in,push_opted_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id=$2",
  [user.id,business[1].id])).rows[0];
 assert.deepEqual(after,{opted_in:false,whatsapp_opted_in:true,push_opted_in:true},
  "Disabling email leaves WhatsApp and push untouched");
 await client.query("SELECT public.business_upsert_whatsapp_consent($1::uuid,false)",[business[1].id]);
 await client.query("SELECT public.customer_set_push_consent($1::uuid,false)",[business[1].id]);
 const off=(await client.query(
  "SELECT opted_in,whatsapp_opted_in,push_opted_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id=$2",
  [user.id,business[1].id])).rows[0];
 assert.deepEqual(off,{opted_in:false,whatsapp_opted_in:false,push_opted_in:false},
  "Customers can independently revoke every channel without losing the membership");
 const cardStill=(await client.query(
  "SELECT id FROM public.loyalty_memberships WHERE customer_id=$1 AND business_id=$2",
  [user.id,business[1].id])).rows[0];
 assert.equal(cardStill.id,approved.card,"Revocation never deletes the card");
 await client.query("ROLLBACK");transaction=false;
 console.log("OK: consent-free signup, one explicit three-channel opt-in, WhatsApp number validation, independent revocation and persistent cards.");
}catch(e){if(transaction)await client.query("ROLLBACK").catch(()=>{});throw e}
finally{client.release();await pool.end()}
