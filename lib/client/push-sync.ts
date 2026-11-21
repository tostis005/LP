// Mantiene activa la suscripción push si el usuario ya concedió permiso al dispositivo.
// Nunca solicita permisos al abrir la aplicación: el permiso inicial sigue siendo explícito.
type PushConfig={enabled?:boolean;publicKey?:string};
let inFlight:Promise<void>|null=null;
let lastAccount="",lastSync=0;
function keyBytes(value:string):Uint8Array{
 const b64=(value+"=".repeat((4-value.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");
 return Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
}
function sameKey(a:ArrayBuffer|null,key:string):boolean{
 if(!a)return false;
 const x=new Uint8Array(a),y=keyBytes(key);
 return x.length===y.length&&x.every((value,i)=>value===y[i]);
}
async function register(sub:PushSubscription){
 const r=await fetch("/api/local/push/preferences",{
  method:"POST",credentials:"same-origin",cache:"no-store",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({action:"subscribe",endpoint:sub.endpoint,keys:sub.toJSON().keys})
 });
 if(!r.ok)throw new Error("No se pudo vincular la suscripción push");
}
async function sync(userId:string){
 if(!window.isSecureContext||!("serviceWorker" in navigator)||
  !("PushManager" in window)||!("Notification" in window)||
  Notification.permission!=="granted")return;
 const r=await fetch("/api/local/push/config",{credentials:"same-origin",cache:"no-store"});
 if(!r.ok)return;
 const config=await r.json() as PushConfig;
 if(!config.enabled||!config.publicKey)return;
 // Esperar al worker ya registrado por PwaSetup sin solicitar permiso otra vez.
 const worker=await navigator.serviceWorker.ready;
 let sub=await worker.pushManager.getSubscription();
 // Si el permiso sigue concedido, recuperar suscripciones perdidas o con VAPID antiguo.
 if(sub&&!sameKey(sub.options.applicationServerKey,config.publicKey)){
  // La clave VAPID puede cambiar durante un despliegue. Una suscripción con
  // una clave anterior puede provocar rechazos aunque el móvil tenga permiso.
  await sub.unsubscribe();
  sub=null;
 }
 if(!sub){
  sub=await worker.pushManager.subscribe({
   userVisibleOnly:true,
   applicationServerKey:keyBytes(config.publicKey) as BufferSource
  });
 }
 await register(sub);
}
export function syncExistingPushSubscription(userId:string,force=false):Promise<void>{
 if(typeof window==="undefined"||!userId)return Promise.resolve();
 if(inFlight)return inFlight;
 // Por apertura de la aplicación/cambio de cuenta, y al volver del segundo plano.
 if(!force&&lastAccount===userId&&Date.now()-lastSync<5*60*1000)return Promise.resolve();
 inFlight=sync(userId).then(()=>{
  lastAccount=userId;
  lastSync=Date.now();
 }).catch(()=>{
  // No bloquear la aplicación ni pedir permisos inesperados; Probar permite reintentar.
 }).finally(()=>{inFlight=null});
 return inFlight;
}
