// Smoke tests para PostgreSQL NATIVO, sin Supabase ni mock de seguridad.
import pg from "pg";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
const dbName=process.env.POSTGRES_DB,host=process.env.PGHOST||"127.0.0.1";
const admin=new pg.Pool({host,database:dbName,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const api=new pg.Pool({host,database:dbName,user:"lp_api",password:process.env.APP_DB_PASSWORD});
async function actor(id,email,fn){
 const c=await api.connect();
 try {
  await c.query("BEGIN");
  await c.query("SET LOCAL ROLE authenticated");
  await c.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.email',$2,true)",[id,email]);
  const result=await fn(c);
  await c.query("COMMIT");
  return result;
 }catch(e){await c.query("ROLLBACK");throw e}
 finally{c.release()}
}
const suffix=randomUUID().slice(0,8);
const email1="admin-"+suffix+"@example.com",email2="extra-"+suffix+"@example.com";
try{
 const a=await admin.query("INSERT INTO auth.users(email,password_hash,email_confirmed_at) VALUES($1,'scrypt$test$test',now()) RETURNING id",[email1]);
 const b=await admin.query("INSERT INTO auth.users(email,password_hash,email_confirmed_at) VALUES($1,'scrypt$test$test',now()) RETURNING id",[email2]);
 const adminId=a.rows[0].id,otherId=b.rows[0].id;
 await admin.query("INSERT INTO public.platform_admins(user_id) VALUES($1)",[adminId]);
 const business=await actor(adminId,email1,async c=>(await c.query(
  "SELECT public.admin_create_business($1::text,$2::text,$3::text) AS id",
  ["Prueba LP", "test-"+suffix,email2]
 )).rows[0].id);
 assert.match(business,/^[a-f0-9-]{36}$/);
 const noAccess=await actor(otherId,email2,async c=>c.query("SELECT id FROM public.businesses WHERE id=$1",[business]));
 assert.equal(noAccess.rowCount,0,"RLS must hide private tenants");
 await assert.rejects(
   ()=>actor(otherId,email2,c=>c.query("SELECT public.admin_create_business('intruso','intruso-"+suffix+"',$1)",[email2])),
   /No autorizado/
 );
 const users=await actor(adminId,email1,c=>c.query("SELECT * FROM public.admin_user_directory()"));
 assert.ok(users.rows.length>=2,"Admin sees user directory");
 const roles=await api.query("SELECT rolname,rolsuper FROM pg_roles WHERE rolname IN ('lp_api','lp_auth')");
 assert.equal(roles.rows.length,2);
 assert.ok(roles.rows.every(r=>r.rolsuper===false),"web roles must not be superusers");
 console.log("OK: native migrations, RLS, admin RPC, user directory, least privilege");
}finally{await admin.end();await api.end()}
