// Procesador privado de avisos automáticos. Solo emite recibos en la
// bandeja de KREYV cuando la persona sigue teniendo consentimiento vigente.
import pg from "pg";
const required=["PGHOST","PGDATABASE","PGUSER","PGPASSWORD"];
for(const k of required)if(!process.env[k])throw Error("Falta la configuración de automatizaciones: "+k);
if(process.env.PGUSER!=="lp_auth")throw Error("Este proceso debe usar únicamente el rol lp_auth");
const pool=new pg.Pool({
 host:process.env.PGHOST,port:Number(process.env.PGPORT||5432),
 database:process.env.PGDATABASE,user:process.env.PGUSER,password:process.env.PGPASSWORD,
 max:2,connectionTimeoutMillis:7000
});
let running=true;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stop=()=>{running=false;};
process.on("SIGTERM",stop);
process.on("SIGINT",stop);
async function cycle(){
 let sent=0,skipped=0;
 for(let page=0;page<10&&running;page++){
  const r=await pool.query("SELECT * FROM public.dispatch_due_automations($1::integer)",[100]);
  const d=Number(r.rows[0]?.delivered||0),s=Number(r.rows[0]?.skipped||0);
  sent+=d;skipped+=s;
  if(d+s<100)break;
 }
 if(sent||skipped)console.log("Automatizaciones: avisos internos entregados",sent,"omitidos",skipped);
}
try{
 console.log("Procesador de avisos de KREYV activo");
 while(running){
  try{await cycle();}
  catch(error){console.error("No se ha podido procesar el lote de automatizaciones",error?.code||"error");}
  if(running)await pause(60_000);
 }
}finally{await pool.end();}
