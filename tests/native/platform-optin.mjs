import assert from "node:assert/strict";
import pg from "pg";
const pool=new pg.Pool({
 host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD
});
const client=await pool.connect();
try{
 await client.query("BEGIN");
 for(const [suffix,checked] of [["yes",true],["no",false]]){
  const email="initial-choice-"+suffix+"@loyally.test";
  const r=await client.query(
   "INSERT INTO auth.users(email,password_hash,raw_user_meta_data) VALUES($1,$2,$3::jsonb) RETURNING id",
   [email,"!test",JSON.stringify({full_name:"Prueba temporal",platform_marketing_opt_in:checked})]
  );
  const user=r.rows[0].id;
  const before=await client.query("SELECT opted_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id IS NULL",[user]);
  assert.equal(before.rowCount,0,"Verification required before marketing records");
  await client.query("UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1",[user]);
  const after=await client.query("SELECT opted_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id IS NULL",[user]);
  assert.equal(after.rowCount,checked?1:0,"Only explicit signup consent should be stored");
  if(checked){
   assert.equal(after.rows[0].opted_in,true);
   await client.query("UPDATE public.marketing_consents SET opted_in=false WHERE customer_id=$1 AND business_id IS NULL",[user]);
   await client.query("UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1",[user]);
   await client.query("UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1",[user]);
   const preference=await client.query("SELECT opted_in FROM public.marketing_consents WHERE customer_id=$1 AND business_id IS NULL",[user]);
   assert.equal(preference.rows[0].opted_in,false,"Re-verifying must not override later withdrawal");
  }
 }
 await client.query("ROLLBACK");
 console.log("OK: marketing opt-in requires affirmative signup checkbox and verified email; withdrawal is respected.");
}catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}
finally{client.release();await pool.end();}
