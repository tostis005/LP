// Procesador privado de avisos automáticos. Solo emite recibos en la
// bandeja de KREYV cuando la persona sigue teniendo consentimiento vigente.
import pg from "pg";
import {createHmac} from "node:crypto";
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
async function mailCycle(){
 // Use the private Docker network; never send the database password itself.
 const results=await Promise.allSettled(["inbox","logs"].map(async source=>{
  const body=JSON.stringify({action:"sync",source}),time=String(Date.now());
  const signature=createHmac("sha256",process.env.PGPASSWORD).update("crm-mail-sync-v1:"+time+":"+body).digest("hex");
  const response=await fetch("http://web:3000/api/local/admin/crm/history",{method:"POST",headers:{"Content-Type":"application/json","x-crm-worker-time":time,"x-crm-worker-signature":signature},body,redirect:"error",signal:AbortSignal.timeout(70000)});
  if(!response.ok)throw Error("CRM sync HTTP "+response.status);
  const data=await response.json();if(data.error)throw Error("CRM sync provider");
  if(data.synced)console.log("CRM: sincronización",source,data.synced);
 }));
 if(results.some(r=>r.status==="rejected"))console.warn("CRM: sincronización no disponible; se reintentará en el siguiente ciclo.");
}
async function transactionCycle(){
 const time=String(Date.now()),signature=createHmac("sha256",process.env.PGPASSWORD).update("transaction-push-v1:"+time).digest("hex");
 const response=await fetch("http://web:3000/api/local/push/transaction-worker",{method:"POST",headers:{"x-transaction-worker-time":time,"x-transaction-worker-signature":signature},redirect:"error",signal:AbortSignal.timeout(55000)});
 if(!response.ok)throw Error("Transaction push HTTP "+response.status);
 const data=await response.json();if(data.processed)console.log("Avisos de compras procesados:",data.processed);
}
try{
 console.log("Procesador de avisos de KREYV activo");
 while(running){
  await Promise.allSettled([cycle().catch(error=>{console.error("No se ha podido procesar el lote de automatizaciones",error?.code||"error");}),mailCycle(),transactionCycle().catch(()=>console.warn("Avisos de compras: reintento en el siguiente ciclo."))]);
  if(running)await pause(60_000);
 }
}finally{await pool.end();}
