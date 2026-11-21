import assert from "node:assert/strict";
import pg from "pg";

const pool=new pg.Pool({
 host:process.env.PGHOST||"127.0.0.1",
 port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,
 user:process.env.POSTGRES_USER,
 password:process.env.POSTGRES_PASSWORD
});
const client=await pool.connect();
try{
 const rows=(await client.query(
  "SELECT id,email FROM auth.users WHERE email IN ('cliente@demo.loyally.test','gestor@demo.loyally.test')"
 )).rows;
 const ids=Object.fromEntries(rows.map(x=>[x.email.split("@")[0],x.id]));
 const shop=(await client.query("SELECT id FROM public.businesses WHERE slug='cafe-noma'")).rows[0];
 const other=(await client.query("SELECT b.id FROM public.businesses b WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_memberships m WHERE m.business_id=b.id AND m.customer_id=$1::uuid) LIMIT 1",[ids.cliente])).rows[0];
 assert.ok(ids.cliente&&ids.gestor&&shop?.id&&other?.id,"El sandbox de Tijuana es obligatorio");

 await client.query("BEGIN");
 // Una suscripción privada no da acceso automático a los mensajes de negocios.
 const endpoint="https://fcm.googleapis.com/fcm/send/test-lp-push-"+Date.now();
 await client.query("INSERT INTO public.business_marketing_rates(business_id,price_cents,whatsapp_price_cents,push_price_cents,currency) VALUES($1,5,7,12,'MXN') ON CONFLICT(business_id) DO UPDATE SET push_price_cents=12,currency='MXN'",[shop.id]);
 await client.query("SELECT public.register_web_push_subscription($1::uuid,$2::text,$3::text,$4::text)",
  [ids.cliente,endpoint,"B".repeat(87),"C".repeat(22)]);
 await client.query("SET LOCAL ROLE authenticated");
 await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[ids.cliente]);
 const owned=await client.query("SELECT * FROM public.customer_push_subscription($1::text)",[endpoint]);
 assert.equal(owned.rowCount,1,"El cliente puede revisar su propia suscripción push");
 assert.equal(owned.rows[0].endpoint,endpoint);
 await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[ids.gestor]);
 const foreign=await client.query("SELECT * FROM public.customer_push_subscription($1::text)",[endpoint]);
 assert.equal(foreign.rowCount,0,"Otro usuario no puede leer claves push ajenas");
 await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[ids.cliente]);
 const before=await client.query("SELECT * FROM public.customer_push_preferences()");
 assert.ok(before.rows.some(x=>x.business_id===shop.id&&!x.opted_in),"Push inicialmente desactivado");
 await client.query("SAVEPOINT no_other_business");
 await assert.rejects(()=>client.query("SELECT public.customer_set_push_consent($1::uuid,true)",[other.id]),
  e=>e.code==="P0001","Un cliente no puede consentir por un negocio sin tarjeta");
 await client.query("ROLLBACK TO SAVEPOINT no_other_business");
 await client.query("SELECT public.customer_set_push_consent($1::uuid,true)",[shop.id]);
 const after=await client.query("SELECT * FROM public.customer_push_preferences()");
 assert.ok(after.rows.some(x=>x.business_id===shop.id&&x.opted_in),"Consentimiento por negocio registrado");

 await client.query("RESET ROLE");
 await client.query("SET LOCAL ROLE authenticated");
 await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[ids.gestor]);
 const quote=await client.query("SELECT public.business_push_quote($1::uuid) AS devices",[shop.id]);
 assert.equal(Number(quote.rows[0].devices),1,"Un dispositivo asociado a una tarjeta y consentimiento");
 const pricing=await client.query("SELECT * FROM public.business_push_pricing($1::uuid)",[shop.id]);
 assert.equal(Number(pricing.rows[0].price_cents),12,"Tarifa particular del negocio");
 assert.equal(Number(pricing.rows[0].total_cents),12,"Presupuesto por dispositivo");
 await client.query("SAVEPOINT no_other_shop");
 await assert.rejects(()=>client.query("SELECT public.business_push_quote($1::uuid)",[other.id]),
  e=>e.code==="P0001","El gestor no debe consultar clientes de otra tienda");
 await client.query("ROLLBACK TO SAVEPOINT no_other_shop");
 const campaign=(await client.query(
  "SELECT public.business_create_push_campaign($1::uuid,'Oferta de prueba','Tienes un sello extra',12::bigint) AS id",
  [shop.id]
 )).rows[0].id;
 await client.query("RESET ROLE");
 const claimed=await client.query("SELECT * FROM public.claim_push_delivery($1::uuid)",[campaign]);
 assert.equal(claimed.rowCount,1,"Solo se encola el dispositivo permitido");
 assert.equal(claimed.rows[0].endpoint,endpoint,"El destino corresponde al cliente autorizado");
 await client.query("SELECT public.finish_push_delivery($1::uuid,true,false)",[claimed.rows[0].delivery_id]);
 const success=(await client.query("SELECT status,sent_count FROM public.push_campaigns WHERE id=$1",[campaign])).rows[0];
 assert.equal(success.status,"sent");
 assert.equal(success.sent_count,1);
 const usage=await client.query("SELECT * FROM public.push_usage_ledger WHERE campaign_id=$1",[campaign]);
 assert.equal(usage.rowCount,1,"El envío aceptado se registra una sola vez");
 assert.equal(usage.rows[0].price_cents,12,"El precio se conserva al momento del envío");
 await client.query("SELECT public.finish_push_delivery($1::uuid,true,false)",[claimed.rows[0].delivery_id]);
 const duplicate=await client.query("SELECT count(*)::int n FROM public.push_usage_ledger WHERE campaign_id=$1",[campaign]);
 assert.equal(duplicate.rows[0].n,1,"No se puede contabilizar dos veces");

 await client.query("SET LOCAL ROLE authenticated");
 await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[ids.gestor]);
 const second=(await client.query(
  "SELECT public.business_create_push_campaign($1::uuid,'Otra promoción','Prueba después de la baja',12::bigint) AS id",
  [shop.id]
 )).rows[0].id;
 await client.query("RESET ROLE");
 await client.query("SET LOCAL ROLE authenticated");
 await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[ids.cliente]);
 await client.query("SELECT public.customer_set_push_consent($1::uuid,false)",[shop.id]);
 await client.query("RESET ROLE");
 const skipped=await client.query("SELECT * FROM public.claim_push_delivery($1::uuid)",[second]);
 assert.equal(skipped.rowCount,0,"Baja aplicada incluso a campañas ya en cola");
 const final=(await client.query("SELECT status,failed_count FROM public.push_campaigns WHERE id=$1",[second])).rows[0];
 assert.equal(final.status,"failed");
 assert.equal(final.failed_count,1);
 await client.query("ROLLBACK");
 console.log("OK: Web Push requiere dispositivo y consentimiento, aisla negocios y respeta bajas posteriores.");
}catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}
finally{client.release();await pool.end()}
