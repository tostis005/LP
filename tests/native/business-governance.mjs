import assert from "node:assert/strict";
import pg from "pg";
const pool=new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const client=await pool.connect();
const as=async(id)=>{await client.query("SET LOCAL ROLE authenticated");await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id])};
async function denied(sql,params=[],message="Operation must be denied"){
 await client.query("SAVEPOINT protect");
 let blocked=false;
 try{await client.query(sql,params)}catch(e){blocked=true;assert.ok(["42501","P0001","23505"].includes(e.code),message+": "+e.message)}
 await client.query("ROLLBACK TO SAVEPOINT protect");
 assert.ok(blocked,message);
}
try{
 const users=Object.fromEntries((await client.query("SELECT id,email FROM auth.users WHERE email IN ('admin@demo.loyally.test','gestor@demo.loyally.test')")).rows.map(r=>[r.email.split("@")[0],r.id]));
 const business=(await client.query("SELECT id FROM public.businesses WHERE slug='cafe-noma'")).rows[0];
 assert.ok(users.admin&&users.gestor&&business?.id,"Seeded profiles and business required");
 await client.query("BEGIN");
 await as(users.gestor);
 await denied("SELECT public.manager_create_branch($1::uuid,'Sucursal no autorizada','sucursal-no-autorizada','gestor@demo.loyally.test')",[business.id],"Manager cannot create a new company");
 await denied("INSERT INTO public.business_locations(business_id,name,address,city,country,lat,lng) VALUES($1,'Segundo local','Segunda dirección 33','Tijuana','México',32.5,-117.01)",[business.id],"Manager cannot add location");
 await denied("DELETE FROM public.business_locations WHERE business_id=$1",[business.id],"Manager cannot delete location");
 await denied("UPDATE public.businesses SET parent_business_id=$1 WHERE id=$1",[business.id],"Manager cannot change franchise");
 const address=(await client.query("SELECT id,address FROM public.business_locations WHERE business_id=$1 LIMIT 1",[business.id])).rows[0];
 assert.ok(address?.id,"Business should have its one location");
 const updated=await client.query("UPDATE public.business_locations SET address='Calle del Comercio 33' WHERE id=$1 RETURNING address",[address.id]);
 assert.equal(updated.rows[0]?.address,"Calle del Comercio 33","Manager can update own address");
 await client.query("ROLLBACK");

 await client.query("BEGIN");
 await as(users.admin);
 const created=await client.query("SELECT public.admin_provision_business($1,$2,$3,$4::uuid,$5::uuid,$6::integer) id",
  ["Sucursal Centro","sucursal-centro-test","gestor@demo.loyally.test",business.id,business.id,1290]);
 const newId=created.rows[0].id;
 const [linked,reference,cloned,contract]=await Promise.all([
  client.query("SELECT parent_business_id FROM public.businesses WHERE id=$1",[newId]),
  client.query("SELECT type,reward_label,reward_cost FROM public.loyalty_programs WHERE business_id=$1",[business.id]),
  client.query("SELECT type,reward_label,reward_cost FROM public.loyalty_programs WHERE business_id=$1",[newId]),
  client.query("SELECT agreed_monthly_cents FROM public.business_billing WHERE business_id=$1",[newId])
 ]);
 assert.equal(linked.rows[0]?.parent_business_id,business.id,"Franchise group links to parent");
 assert.equal(cloned.rows[0]?.type,reference.rows[0]?.type,"Card type cloned");
 assert.equal(cloned.rows[0]?.reward_label,reference.rows[0]?.reward_label,"Card reward cloned");
 assert.equal(Number(contract.rows[0]?.agreed_monthly_cents),1290,"Each site has independent negotiated price");
 const location=await client.query("SELECT public.admin_set_business_location($1::uuid,'Sucursal Centro','Avenida Centro 123','Tijuana','México',32.5,-117.01)",[newId]);
 assert.ok(location.rows[0]?.admin_set_business_location,"Admin creates first address");
 await denied("INSERT INTO public.business_locations(business_id,name,address,city,country,lat,lng) VALUES($1,'Otro local','Avenida Norte 333','Tijuana','México',32.5,-117.01)",[newId],"Even admin must use another business for a second location");
 await client.query("SELECT public.admin_set_business_contract($1::uuid,$2::integer)",[newId,990]);
 const changed=await client.query("SELECT agreed_monthly_cents FROM public.business_billing WHERE business_id=$1",[newId]);
 assert.equal(Number(changed.rows[0]?.agreed_monthly_cents),990,"Admin can grant a volume discount");
 await client.query("ROLLBACK");
 console.log("OK: only platform admins create stores/branches, each site has independent price and one address, managers edit their address.");
}catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{client.release();await pool.end();}
