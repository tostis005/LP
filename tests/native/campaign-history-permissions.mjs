import assert from "node:assert/strict";
import pg from "pg";

const config={host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),database:process.env.POSTGRES_DB};
const admin=new pg.Pool({...config,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const app=new pg.Pool({...config,user:"lp_api",password:process.env.APP_DB_PASSWORD});

async function asUser(id,fn){
 const client=await app.connect();
 try{
  await client.query("BEGIN");
  await client.query("SET LOCAL ROLE authenticated");
  await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);
  return await fn(client);
 }finally{
  await client.query("ROLLBACK").catch(()=>{});
  client.release();
 }
}
try{
 const owner=(await admin.query(
  "SELECT u.id AS user_id,m.business_id FROM auth.users u JOIN public.business_members m "+
  "ON m.user_id=u.id WHERE u.email='owner@kreyvi.com' AND m.active AND m.role='owner' "+
  "ORDER BY m.business_id LIMIT 1")).rows[0];
 const customer=(await admin.query(
  "SELECT id FROM auth.users WHERE email='cliente@kreyvi.com' LIMIT 1")).rows[0];
 assert.ok(owner?.user_id&&owner?.business_id,"Missing business owner fixture");
 assert.ok(customer?.id,"Missing customer fixture");
 await asUser(owner.user_id,async client=>{
  const isOwner=await client.query("SELECT public.is_business_manager($1::uuid) AS ok",[owner.business_id]);
  assert.equal(isOwner.rows[0].ok,true);

  // Ejecutar el listado con la subconsulta UNION que utiliza /api/local/offers.
  // Antes de la migración fallaba con 42501 incluso si la tabla estaba vacía.
  const query=await client.query(
   "SELECT o.id, "+
   "(SELECT coalesce(json_agg(json_build_object('id',q.id,'channel',q.channel,'status',q.status,"+
   "'recipient_count',q.recipient_count,'sent_count',q.sent_count,'failed_count',q.failed_count)), '[]'::json) "+
   "FROM (SELECT c.id,c.channel,c.status,c.recipient_count,c.sent_count,c.failed_count "+
   "FROM public.marketing_campaigns c WHERE c.offer_id=o.id UNION ALL "+
   "SELECT p.id,'push'::text,p.status,p.recipient_count,p.sent_count,p.failed_count "+
   "FROM public.push_campaigns p WHERE p.id=o.push_campaign_id) q) AS campaigns, "+
   "(SELECT count(*) FROM public.offer_campaign_charges x WHERE x.offer_id=o.id) AS charged_channels "+
   "FROM public.business_offers o WHERE o.business_id=$1::uuid LIMIT 100",[owner.business_id]);
  assert.ok(Array.isArray(query.rows));

  const pushed=await client.query(
   "SELECT public.business_save_push_campaign($1::uuid,$2::text,$3::text,NULL::uuid) AS id",
   [owner.business_id,"Aviso de prueba","Mensaje de prueba"]);
  const campaignId=pushed.rows[0].id;
  const visible=await client.query(
   "SELECT id,status,recipient_count,sent_count,failed_count FROM public.push_campaigns WHERE id=$1::uuid",
   [campaignId]);
  assert.equal(visible.rows.length,1,"Owner can see status of own push campaign");
  assert.equal(visible.rows[0].status,"draft");
  await assert.rejects(
   ()=>client.query("SELECT body_text FROM public.push_campaigns WHERE id=$1::uuid",[campaignId]),
   e=>e.code==="42501","Full push payload remains restricted to the service");
 });
 await asUser(customer.id,async client=>{
  const visible=await client.query("SELECT id,status FROM public.push_campaigns WHERE business_id=$1::uuid",[owner.business_id]);
  assert.equal(visible.rows.length,0,"Unrelated customer cannot list business push campaigns");
 });
 const still=await admin.query("SELECT id FROM public.push_campaigns WHERE title=$1",["Aviso de prueba"]);
 assert.equal(still.rowCount,0,"Test push campaign must roll back");
 console.log("OK: campañas visibles al gestor desde el inicio, privacidad RLS y payload push protegido.");
}finally{await Promise.all([admin.end(),app.end()])}
