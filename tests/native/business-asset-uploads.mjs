import assert from "node:assert/strict";
import pg from "pg";
import {randomUUID} from "node:crypto";

const config={host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),database:process.env.POSTGRES_DB};
const admin=new pg.Pool({...config,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const app=new pg.Pool({...config,user:"lp_api",password:process.env.APP_DB_PASSWORD});

async function impersonate(userId,fn){
 const client=await app.connect();
 try{
  await client.query("BEGIN");
  await client.query("SET LOCAL ROLE authenticated");
  await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[userId]);
  return await fn(client);
 }finally{
  await client.query("ROLLBACK").catch(()=>{});
  client.release();
 }
}
try{
 const result=await admin.query(
  "SELECT u.id AS manager_id,b.business_id FROM auth.users u "+
  "JOIN public.business_members b ON b.user_id=u.id AND b.active AND b.role='owner' "+
  "WHERE u.email='gestor@loyally.local' ORDER BY b.business_id LIMIT 1");
 const manager=result.rows[0];
 assert.ok(manager,"Showcase business owner missing");
 const customer=(await admin.query(
  "SELECT id FROM auth.users WHERE email='cliente@loyally.local' LIMIT 1")).rows[0];
 assert.ok(customer,"Showcase customer missing");
 const fileName="oferta-"+randomUUID()+".webp";
 await impersonate(manager.manager_id,async client=>{
  const stored=await client.query(
   "SELECT public.register_business_asset($1::uuid,$2::text) AS path",[manager.business_id,fileName]);
  assert.equal(stored.rows[0]?.path,manager.business_id+"/"+fileName);
  const metadata=await client.query(
   "SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id='business-assets' AND name=$1",
   [manager.business_id+"/"+fileName]);
  // No se concede SELECT sobre metadatos: el registro funciona aunque RLS los oculte.
  assert.equal(metadata.rows[0].count,0,"El listado de archivos debe mantenerse privado");
  await client.query("SAVEPOINT duplicate_image");
  await assert.rejects(
   ()=>client.query("SELECT public.register_business_asset($1::uuid,$2::text)",[manager.business_id,fileName]),
   error=>error.code==="23505","No se debe permitir registrar el mismo archivo dos veces");
  await client.query("ROLLBACK TO SAVEPOINT duplicate_image");
 });
 await assert.rejects(
  ()=>impersonate(customer.id,client=>client.query(
   "SELECT public.register_business_asset($1::uuid,$2::text)",[manager.business_id,"oferta-"+randomUUID()+".jpg"])),
  /No tienes permiso para subir imágenes de este negocio/,"Customers must not upload to business assets");
 await assert.rejects(
  ()=>impersonate(manager.manager_id,client=>client.query(
   "SELECT public.register_business_asset($1::uuid,$2::text)",[manager.business_id,"../outside.png"])),
  /Nombre de imagen no válido/,"Asset paths must stay within their business");
 const persisted=await admin.query("SELECT 1 FROM storage.objects WHERE name=$1",
  [manager.business_id+"/"+fileName]);
 assert.equal(persisted.rowCount,0,"Image metadata remains transactional during tests");
 console.log("OK: manager can upload campaign image, unrelated user denied, traversal rejected, rollback clean.");
}finally{await Promise.all([admin.end(),app.end()])}
