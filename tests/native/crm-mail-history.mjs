import pg from "pg";
import assert from "node:assert/strict";
const connect=(user,password)=>new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),database:process.env.POSTGRES_DB,user,password,max:1});
const app=connect("lp_api",process.env.APP_DB_PASSWORD),auth=connect("lp_auth",process.env.AUTH_DB_PASSWORD);
try{
 const result=await auth.query("SELECT public.crm_mail_sync_actor() AS id");
 assert.equal(result.rows[0].id,null);
 await assert.rejects(auth.query("SELECT body_text FROM public.crm_mail_history"),{code:"42501"});
 const c=await app.connect();
 try{
  await c.query("BEGIN");await c.query("SET LOCAL ROLE anon");
  await assert.rejects(c.query("SELECT * FROM public.crm_mail_history"),{code:"42501"});
  await c.query("ROLLBACK");await c.query("BEGIN");await c.query("SET LOCAL ROLE authenticated");
  assert.equal((await c.query("SELECT count(*)::int AS n FROM public.crm_mail_history")).rows[0].n,0);
  await assert.rejects(c.query("INSERT INTO public.crm_mail_history(mailbox,source,external_id,correspondent,direction,occurred_at,delivery_status) VALUES('test@example.com','inbox','test','other@example.com','inbound',now(),'received')"),{code:"42501"});
  await c.query("ROLLBACK");
 }finally{c.release();}
 console.log("CRM: historial protegido por RLS; trabajador sin acceso directo al contenido.");
}finally{await Promise.all([app.end(),auth.end()]);}
