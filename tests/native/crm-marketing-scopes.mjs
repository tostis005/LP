import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import pg from "pg";
assert.equal(process.env.POSTGRES_DB,"lp_test","Only run on isolated CI database");
const pool=new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,max:1});
const c=await pool.connect(),tag=randomUUID(),shared=tag+"@example.test";
try{
 await c.query("BEGIN");
 const create=async(suffix)=>(await c.query("INSERT INTO auth.users(email,password_hash,email_confirmed_at) VALUES($1,'test-only',now()) RETURNING id",[tag+suffix+"@example.test"])).rows[0].id;
 const admin=await create("-admin"),marketing=await create("-marketing"),customer=await create("-customer");
 await c.query("INSERT INTO public.platform_admins(user_id) VALUES($1)",[admin]);
 const scope={country_code:"MX",state_code:"14",municipality_code:"039",locality_code:"0001",neighborhood:"Centro"};
 await c.query("INSERT INTO public.crm_marketing_users(user_id,scopes) VALUES($1,$2::jsonb)",[marketing,JSON.stringify([scope])]);
 const add=async(suffix,state,municipality,locality,neighborhood)=>(await c.query("INSERT INTO public.crm_prospects(source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,neighborhood,activity_code,activity,category,email) VALUES($1,$2,'MX',$3,'Estado',$4,'Municipio',$5,'Localidad',$6,'722515','Cafetería','Restaurantes y cafeterías',$7) RETURNING id",[tag+suffix,suffix,state,municipality,locality,neighborhood,shared])).rows[0].id;
 const allowed=await add("allowed","14","039","0001","Centro"),outside=await add("outside","11","020","0001","Centro"),otherColony=await add("other","14","039","0001","Norte");
 const assume=async(id)=>{await c.query("RESET ROLE");await c.query("SET LOCAL ROLE authenticated");await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);};
 const visible=async()=>(await c.query("SELECT id FROM public.crm_prospects WHERE source_id LIKE $1 ORDER BY id",[tag+"%"])).rows.map(x=>x.id);
 const denied=async(fn)=>{await c.query("SAVEPOINT denied");await assert.rejects(fn);await c.query("ROLLBACK TO SAVEPOINT denied");};
 await assume(marketing);assert.deepEqual(await visible(),[allowed]);assert.equal((await c.query("SELECT public.is_platform_admin() AS v")).rows[0].v,false);
 await denied(()=>c.query("SELECT public.crm_marketing_save_contact($1,'contacted','outside')",[outside]));
 await denied(()=>c.query("SELECT public.crm_admin_marketing_users()"));
 await denied(()=>c.query("SELECT * FROM public.crm_marketing_users"));
 await c.query("SELECT public.crm_marketing_save_contact($1,'contacted','within scope')",[allowed]);
 await assume(admin);assert.equal((await c.query("SELECT count(*)::int AS n FROM public.crm_prospects WHERE source_id LIKE $1 AND status='contacted'",[tag+"%"])).rows[0].n,3,"Shared address inherits contact globally");
 await assume(customer);assert.deepEqual(await visible(),[]);await denied(()=>c.query("SELECT public.crm_marketing_save_contact($1,'qualified','customer')",[allowed]));
 await c.query("RESET ROLE");await c.query("UPDATE public.crm_marketing_users SET scopes='[]' WHERE user_id=$1",[marketing]);await assume(marketing);assert.deepEqual(await visible(),[]);
 await c.query("RESET ROLE");await c.query("UPDATE public.crm_marketing_users SET scopes=$2::jsonb,active=false WHERE user_id=$1",[marketing,JSON.stringify([scope])]);await assume(marketing);assert.deepEqual(await visible(),[]);await denied(()=>c.query("SELECT public.crm_marketing_save_contact($1,'contacted','disabled')",[allowed]));
 console.log("CRM marketing: geographic isolation, no admin escalation, no cross-scope updates, global contact dedup, empty scopes and disabled accounts OK");
}finally{await c.query("ROLLBACK");c.release();await pool.end();}
