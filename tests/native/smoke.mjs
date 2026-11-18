// Aislamiento de roles de PostgreSQL nativo; base de datos CI vacía.
import pg from "pg";
const connect=(user,password)=>new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),database:process.env.POSTGRES_DB,user,password,max:2});
const app=connect("lp_api",process.env.APP_DB_PASSWORD);
const auth=connect("lp_auth",process.env.AUTH_DB_PASSWORD);
let passed=0;
async function test(name,fn){
 await fn();passed++;console.log("OK:",name);
}
async function assertDenied(query){
 try{await query();throw Error("Acceso indebido")}
 catch(e){if(e.message==="Acceso indebido"||!["42501","P0001"].includes(e.code))throw e}
}
try{
 await test("auth accede a sus cuentas",async()=>{
  const r=await auth.query("SELECT count(*)::int n FROM auth.users");
  if(r.rows[0].n!==0)throw Error("Se esperaba base nueva");
 });
 await test("auth no consulta negocios",()=>assertDenied(()=>auth.query("SELECT * FROM public.businesses LIMIT 1")));
 const client=await app.connect();
 try{
  await client.query("BEGIN");
  await client.query("SET LOCAL ROLE anon");
  await test("anon no consulta perfiles",()=>assertDenied(()=>client.query("SELECT * FROM public.profiles LIMIT 1")));
  await client.query("ROLLBACK");
  await client.query("BEGIN");
  await client.query("SET LOCAL ROLE authenticated");
  await test("sin identidad no hay rol admin",async()=>{
   const r=await client.query("SELECT public.is_platform_admin() AS admin");
   if(r.rows[0]?.admin!==false)throw Error("Elevación de privilegios");
  });
  await test("sin identidad no crea negocios",()=>assertDenied(()=>client.query("SELECT public.admin_create_business('Ejemplo','ejemplo','test@example.com')")));
  await client.query("ROLLBACK");
 }finally{client.release()}
 console.log("Pruebas superadas:",passed);
}finally{await Promise.all([app.end(),auth.end()])}