import pg from "pg";
import {randomBytes,scrypt as scryptCallback} from "node:crypto";
import {promisify} from "node:util";
const scrypt=promisify(scryptCallback);

const people=[
 {role:"ADMIN",email:"admin@loyally.local",name:"Administración Loyally"},
 {role:"BUSINESS",email:"gestor@loyally.local",name:"Responsable de negocio"},
 {role:"STAFF",email:"empleado@loyally.local",name:"Personal de tienda"},
 {role:"CUSTOMER",email:"cliente@loyally.local",name:"Cliente Loyally"}
];
for(const u of people){
 const password=process.env["LP_SHOWCASE_"+u.role+"_PASSWORD"]||"";
 if(password.length<20||password.length>128)throw new Error("Falta la contraseña privada para "+u.role);
}
const shops=[
 ["Café Noma","cafe-noma","Cafetería","coffee","stamps","Un café gratis",8,32.535,-117.046],
 ["Brunch Club","brunch-club","Restaurante","burger","stamps","Desayuno para compartir",6,32.520,-117.034],
 ["Barba Norte","barba-norte","Barbería","beard","stamps","Arreglo de barba gratis",10,32.504,-117.025],
 ["Studio Verde","studio-verde","Peluquería","hair","stamps","Tratamiento capilar",8,32.502,-116.999],
 ["Taco Lumbre","taco-lumbre","Taquería","taco","stamps","Orden de tacos gratis",8,32.526,-117.018],
 ["Pan Mar","pan-mar","Panadería","bread","stamps","Pan artesanal de regalo",10,32.533,-117.117],
 ["Dulce Frontera","dulce-frontera","Heladería","icecream","stamps","Helado de cortesía",7,32.538,-116.958],
 ["Punto Fit","punto-fit","Gimnasio","gym","points","Clase gratuita",500,32.485,-116.986],
 ["Lavanda Spa","lavanda-spa","Bienestar","spa","cashback","Descuento en servicios",10000,32.516,-117.039],
 ["Marea Pets","marea-pets","Mascotas","pet","points","Accesorio para tu mascota",350,32.525,-117.109]
];
const pool=new pg.Pool({host:process.env.PGHOST||"db",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const db=await pool.connect();
try{
 await db.query("BEGIN");
 const ids={};
 for(const p of people){
  const r=await db.query("SELECT id FROM auth.users WHERE lower(email)=$1",[p.email]);
  if(r.rowCount){ids[p.role]=r.rows[0].id;continue}
  const password=process.env["LP_SHOWCASE_"+p.role+"_PASSWORD"];
  const salt=randomBytes(16).toString("hex");
  const hash="scrypt$"+salt+"$"+(await scrypt(password,salt,64)).toString("hex");
  const created=await db.query(
   "INSERT INTO auth.users(email,password_hash,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),$3::jsonb) RETURNING id",
   [p.email,hash,JSON.stringify({full_name:p.name})]
  );
  ids[p.role]=created.rows[0].id;
 }
 await db.query("INSERT INTO public.platform_admins(user_id) VALUES($1) ON CONFLICT DO NOTHING",[ids.ADMIN]);
 const existing={},createdSlugs=new Set();
 for(const [name,slug,category,icon,type,reward,cost,lat,lng] of shops){
  const internalSlug="interno-"+slug;
  let r=await db.query("SELECT id FROM public.businesses WHERE slug=$1",[internalSlug]);
  let isNew=!r.rowCount;
  if(isNew){
   r=await db.query(
    "INSERT INTO public.businesses(name,slug,category,accent_color,stamp_icon,stamp_color,card_text,public_listing,active,description) VALUES($1,$2,$3,'#571c32',$4,'#571c32','GRACIAS POR VOLVER',true,true,'') RETURNING id",
    [name,internalSlug,category,icon]);
  }
  const id=r.rows[0].id;existing[slug]=id;
  if(isNew){
   createdSlugs.add(slug);
   await db.query("INSERT INTO public.loyalty_programs(business_id,type,reward_label,reward_cost) VALUES($1,$2,$3,$4)",[id,type,reward,cost]);
   await db.query("INSERT INTO public.business_locations(business_id,name,address,city,country,lat,lng,visible) VALUES($1,$2,$3,'Tijuana','México',$4,$5,true)",
    [id,name,"Dirección por configurar",lat,lng]);
  }
  if(slug==="cafe-noma")
   await db.query("INSERT INTO public.business_members(business_id,user_id,role,active) VALUES($1,$2,'owner',true) ON CONFLICT (business_id,user_id) DO NOTHING",[id,ids.BUSINESS]);
 }
 await db.query("INSERT INTO public.business_members(business_id,user_id,role,active) VALUES($1,$2,'employee',true) ON CONFLICT (business_id,user_id) DO NOTHING",[existing["cafe-noma"],ids.STAFF]);
 for(const slug of ["cafe-noma","brunch-club","punto-fit","lavanda-spa"]){
  if(!createdSlugs.has(slug))continue;
  await db.query("INSERT INTO public.loyalty_memberships(business_id,customer_id,balance,total_earned) VALUES($1,$2,0,0) ON CONFLICT(business_id,customer_id) DO NOTHING",[existing[slug],ids.CUSTOMER]);
 }
 // Las migraciones pueden preceder a la provisión del escaparate interno.
 await db.query("SELECT public.seed_internal_noma_to_163()");
 await db.query("SELECT public.seed_internal_noma_dashboard()");
 await db.query("COMMIT");
 console.log("Cuentas autenticadas y negocios persistentes preparados; se han conservado los datos preexistentes.");
}catch(error){await db.query("ROLLBACK");throw error}
finally{db.release();await pool.end()}
