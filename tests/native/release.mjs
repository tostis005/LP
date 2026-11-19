import assert from "node:assert/strict";
import pg from "pg";
const pool=new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const client=await pool.connect();
async function identity(userId){await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[userId]);}
try{
 const ids=Object.fromEntries((await client.query("SELECT id,email FROM auth.users WHERE email LIKE '%@demo.loyally.test'")).rows.map(r=>[r.email.split("@")[0],r.id]));
 const shop=(await client.query("SELECT id,slug FROM public.businesses WHERE slug='cafe-noma'")).rows[0];
 assert.ok(ids.gestor&&ids.cliente&&ids.admin&&shop,"Need seeded Tijuana roles");
 await client.query("BEGIN");await client.query("SET LOCAL ROLE authenticated");await identity(ids.gestor);
 await assert.rejects(()=>client.query("SELECT public.join_program($1::uuid)",[shop.id]),e=>e.code==="P0001"&&/cuenta de cliente/.test(e.message));
 await client.query("ROLLBACK");
 await client.query("BEGIN");await client.query("SET LOCAL ROLE authenticated");await identity(ids.gestor);
 const members=await client.query("SELECT * FROM public.business_customer_directory($1::uuid)",[shop.id]);
 assert.ok(members.rowCount>0);
 assert.ok(members.rows.every(m=>m.email.includes("***")&&!m.email.includes("cliente@demo.loyally.test")));
 const employees=await client.query("SELECT * FROM public.business_staff_directory($1::uuid)",[shop.id]);
 assert.ok(employees.rows.every(x=>x.email.includes("***")));
 const wq=await client.query("SELECT * FROM public.business_whatsapp_quote($1::uuid)",[shop.id]);
 assert.equal(Number(wq.rows[0].contacts),0,"WhatsApp has no opt-in by default");
 assert.equal(wq.rows[0].price_cents,null,"WhatsApp cannot be priced without platform administrator");
 const usage=await client.query("SELECT * FROM public.business_marketing_usage($1::uuid)",[shop.id]);
 assert.equal(usage.rowCount,0);
 await client.query("ROLLBACK");
 await client.query("BEGIN");
 await client.query("UPDATE auth.users SET raw_user_meta_data=raw_user_meta_data-'whatsapp' WHERE id=$1",[ids.cliente]);
 await client.query("SET LOCAL ROLE authenticated");await identity(ids.cliente);
 const joined=await client.query("SELECT public.join_program($1::uuid)",[shop.id]);
 assert.ok(joined.rows[0].join_program,"Customer should still join programs");
 await assert.rejects(()=>client.query("SELECT public.business_upsert_whatsapp_consent($1::uuid,true)",[shop.id]),e=>e.code==="P0001");
 await client.query("ROLLBACK");
 await client.query("BEGIN");await client.query("SET LOCAL ROLE authenticated");await identity(ids.admin);
 await client.query("UPDATE public.businesses SET public_listing=false WHERE id=$1",[shop.id]);
 const unpublished=await client.query("SELECT * FROM public.public_business_details('cafe-noma')");
 assert.equal(unpublished.rowCount,0,"Unpublished business must not leak via public details");
 await client.query("ROLLBACK");
 console.log("OK: merchant cannot join; customer can; masked email; WhatsApp requires consent; preview separate from public; safe usage.");
}catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{client.release();await pool.end();}
