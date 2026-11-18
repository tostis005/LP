// Exclusivo para una base VACÍA y AISLADA; nunca para producción.
import pg from "pg";
import {randomBytes,scrypt as scryptCallback} from "node:crypto";
import {promisify} from "node:util";
const scrypt=promisify(scryptCallback);
if(process.env.LP_SANDBOX_MODE!=="true")throw new Error("LP_SANDBOX_MODE=true necesario en una base aislada.");
const database=process.env.POSTGRES_DB||"";
if(!/^lp_(sandbox|demo|test)(_|$)/.test(database))throw new Error("Usa una base lp_sandbox, lp_demo o lp_test.");
const password=process.env.LP_DEMO_PASSWORD||"";
if(password.length<12||password.length>128)throw new Error("Define LP_DEMO_PASSWORD segura en el entorno (12+ caracteres).");
const pool=new pg.Pool({host:process.env.PGHOST||"db",port:Number(process.env.PGPORT||5432),database,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const client=await pool.connect();
const sites=[
 ["Café Noma","cafe-noma","Cafetería","#275642","coffee","stamps","Un café gratis",8,32.535,-117.046,"Zona Centro"],
 ["Brunch Club","brunch-club","Restaurante","#bb7550","burger","stamps","Desayuno para compartir",6,32.520,-117.034,"La Cacho"],
 ["Barba Norte","barba-norte","Barbería","#68558e","beard","stamps","Arreglo de barba gratis",10,32.504,-117.025,"Chapultepec"],
 ["Studio Verde","studio-verde","Peluquería","#9d566f","hair","stamps","Tratamiento capilar",8,32.502,-116.999,"Hipódromo"],
 ["Taco Lumbre","taco-lumbre","Taquería","#bb5b35","taco","stamps","Orden de tacos gratis",8,32.526,-117.018,"Zona Río"],
 ["Pan Mar","pan-mar","Panadería","#94704a","croissant","stamps","Pan artesanal de regalo",10,32.533,-117.117,"Playas de Tijuana"],
 ["Dulce Frontera","dulce-frontera","Heladería y postres","#ab647e","icecream","stamps","Helado de cortesía",7,32.538,-116.958,"Otay"],
 ["Punto Fit","punto-fit","Gimnasio","#294b72","gym","points","Clase gratuita con 500 puntos",500,32.485,-116.986,"Las Palmas"],
 ["Lavanda Spa","lavanda-spa","Spa y bienestar","#8163a4","spa","cashback","100 MXN de descuento",10000,32.516,-117.039,"La Cacho"],
 ["Marea Pets","marea-pets","Mascotas","#287d79","pet","points","Accesorio para tu mascota",350,32.525,-117.109,"Playas de Tijuana"]
];
const accounts=[["admin","Alex Demo Administración"],["gestor","Clara Demo Negocio"],["empleado","Daniel Demo Atención"],["cliente","Martina López"]];
try{
 await client.query("BEGIN");
 const counts=await client.query("SELECT (SELECT count(*) FROM auth.users) AS users,(SELECT count(*) FROM public.businesses) AS businesses");
 if(Number(counts.rows[0].users)||Number(counts.rows[0].businesses))throw new Error("Base no vacía: no se cambia ningún dato existente.");
 const ids={};
 for(const [role,full_name] of accounts){
  const salt=randomBytes(16).toString("hex"),hash="scrypt$"+salt+"$"+(await scrypt(password,salt,64)).toString("hex");
  const r=await client.query("INSERT INTO auth.users(email,password_hash,raw_user_meta_data,email_confirmed_at) VALUES($1,$2,$3::jsonb,now()) RETURNING id",
   [role+"@demo.loyally.test",hash,JSON.stringify({full_name,whatsapp:"+526641234567"})]);
  ids[role]=r.rows[0].id;
 }
 await client.query("INSERT INTO public.platform_admins(user_id) VALUES($1)",[ids.admin]);
 const businessIds={};
 for(const [name,slug,category,color,icon,type,reward,cost,lat,lng,zone] of sites){
  const b=await client.query("INSERT INTO public.businesses(name,slug,description,category,accent_color,stamp_icon,card_text,card_text_color,stamp_color,public_listing,active) VALUES($1,$2,$3,$4,$5,$6,'QUÉ BIEN QUE HAS VUELTO','#ffffff','#275642',true,true) RETURNING id",
   [name,slug,"Negocio ficticio para pruebas en "+zone+", Tijuana.",category,color,icon]);
  businessIds[slug]=b.rows[0].id;
  await client.query("INSERT INTO public.loyalty_programs(business_id,type,reward_label,reward_cost,points_per_euro,cashback_bps) VALUES($1,$2,$3,$4,1,500)",
   [b.rows[0].id,type,reward,cost]);
  await client.query("INSERT INTO public.business_locations(business_id,name,address,city,country,lat,lng,visible) VALUES($1,$2,$3,'Tijuana','México',$4,$5,true)",
   [b.rows[0].id,name+" · "+zone,zone+" (ubicación de demostración)",lat,lng]);
  await client.query("INSERT INTO public.business_members(business_id,user_id,role,active) VALUES($1,$2,'owner',true)",[b.rows[0].id,ids.admin]);
 }
 await client.query("INSERT INTO public.business_members(business_id,user_id,role) VALUES($1,$2,'owner')",[businessIds["cafe-noma"],ids.gestor]);
 await client.query("INSERT INTO public.business_members(business_id,user_id,role) VALUES($1,$2,'employee')",[businessIds["cafe-noma"],ids.empleado]);
 for(const [slug,balance] of [["cafe-noma",8],["brunch-club",2],["punto-fit",200],["lavanda-spa",4000]]){
  await client.query("INSERT INTO public.loyalty_memberships(business_id,customer_id,balance,total_earned) VALUES($1,$2,$3,$3)",
   [businessIds[slug],ids.cliente,balance]);
 }
 await client.query("INSERT INTO public.marketing_consents(customer_id,business_id,opted_in) VALUES($1,$2,true)",[ids.cliente,businessIds["cafe-noma"]]);
 await client.query("COMMIT");
 console.log("Sandbox: 10 negocios en Tijuana, cuatro usuarios reales, tarjetas y premio de prueba.");
 console.log("Emails: "+accounts.map(a=>a[0]+"@demo.loyally.test").join(", "));
 console.log("La clave es LP_DEMO_PASSWORD; nunca se guarda en Git ni se imprime.");
}catch(e){await client.query("ROLLBACK");throw e}
finally{client.release();await pool.end()}
