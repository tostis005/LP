"use client";
import {useEffect,useState} from "react";
import {Bell,BellOff,CheckCircle2,ShieldCheck} from "lucide-react";
import {showActionToast} from "@/lib/action-toast";
import {devicePushSubscription,deviceCardRequest} from "@/lib/client/device-card-qr";

type Preference={business_id:string;business_name:string;opted_in:boolean};
type Config={enabled:boolean;publicKey:string};

class PushRequestError extends Error {
 constructor(message:string,readonly status:number){super(message);this.name="PushRequestError";}
}
function keyBytes(value:string):Uint8Array{
 const padded=(value+"=".repeat((4-value.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");
 return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
}
function sameServerKey(current:ArrayBuffer|null,key:string){
 if(!current)return false;
 const a=new Uint8Array(current),b=keyBytes(key);
 return a.length===b.length&&a.every((byte,index)=>byte===b[index]);
}
async function jsonRequest(path:string,init?:RequestInit){
 const res=await fetch(path,{credentials:"same-origin",cache:"no-store",...init});
 const data=await res.json() as {error?:string;[key:string]:unknown};
 if(!res.ok||data.error)throw new PushRequestError(data.error||"No se pudo completar la solicitud.",res.status);
 return data;
}
function postPush(path:string,body:Record<string,unknown>){
 return jsonRequest(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
async function register(sub:PushSubscription){
 await postPush("/api/local/push/preferences",{action:"subscribe",endpoint:sub.endpoint,keys:sub.toJSON().keys});
}
async function clearOldSubscription(sub:PushSubscription){
 const endpoint=sub.endpoint;
 const removed=await sub.unsubscribe();
 if(!removed)throw new Error("No se pudo renovar la suscripción del teléfono. Vuelve a intentarlo.");
 // Se retira solo un endpoint obsoleto; no se modifican los consentimientos de los negocios.
 await postPush("/api/local/push/preferences",{action:"unsubscribe",endpoint}).catch(()=>{});
}
async function ensureSubscription(reg:ServiceWorkerRegistration,publicKey:string,renew=false){
 let sub=await reg.pushManager.getSubscription();
 if(sub&&(renew||!sameServerKey(sub.options.applicationServerKey,publicKey))){
  await clearOldSubscription(sub);
  sub=null;
 }
 if(!sub)sub=await reg.pushManager.subscribe({
  userVisibleOnly:true,applicationServerKey:keyBytes(publicKey) as BufferSource
 });
 await register(sub);
 return sub;
}
function sendTest(sub:PushSubscription){
 return postPush("/api/local/push/test",{endpoint:sub.endpoint});
}

export function PushPreferences({showBusinesses=true}:{showBusinesses?:boolean}={}){
 const [config,setConfig]=useState<Config>({enabled:false,publicKey:""});
 const [items,setItems]=useState<Preference[]>([]);
 const [supported,setSupported]=useState(false),[deviceActive,setDeviceActive]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [transactionEnabled,setTransactionEnabled]=useState<boolean|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{
  let mounted=true;
  async function load(){
   try{
    const [c,p]=await Promise.all([
     jsonRequest("/api/local/push/config"),
     jsonRequest("/api/local/push/preferences")
    ]);
    if(!mounted)return;
    setConfig({enabled:!!c.enabled,publicKey:String(c.publicKey||"")});
    setItems((p.businesses||[]) as Preference[]);
    const isSupported=window.isSecureContext&&"serviceWorker" in navigator
     &&"PushManager" in window&&"Notification" in window;
    setSupported(isSupported);
    if(isSupported){
     const reg=await navigator.serviceWorker.getRegistration();
     const sub=reg?await reg.pushManager.getSubscription():null;
     if(sub&&Notification.permission==="granted"&&c.enabled){
      // Volver a vincular el móvil a la cuenta activa sin pedir permisos nuevos.
      await register(sub);
      const pref=await deviceCardRequest({action:"preference",endpoint:sub.endpoint});if(mounted)setTransactionEnabled(pref.enabled??null);
     }
     if(mounted)setDeviceActive(!!sub&&Notification.permission==="granted");
    }
   }catch(e){if(mounted)setError((e as Error).message);}
   finally{if(mounted)setLoading(false);}
  }
  void load();
  return()=>{mounted=false;};
 },[]);
 async function testNotification(){
  setBusy(true);setError("");setNotice("");
  try{
   if(!config.enabled||!config.publicKey)throw new Error("Las notificaciones no están disponibles en este momento.");
   if(!supported)throw new Error("Este navegador no admite notificaciones push. En iPhone, abre KREYVI desde el icono de inicio.");
   if(Notification.permission==="denied")throw new Error("Las notificaciones están bloqueadas en el teléfono. Actívalas en los ajustes del sistema y vuelve a probar.");
   // El permiso inicial solo puede solicitarse al pulsar el botón.
   if(Notification.permission!=="granted"){
    const permission=await Notification.requestPermission();
    if(permission!=="granted")throw new Error("Necesitas permitir las notificaciones del teléfono para recibir avisos.");
   }
   const reg=await navigator.serviceWorker.ready;
   let sub=await ensureSubscription(reg,config.publicKey);
   setDeviceActive(true);
   const pref=await deviceCardRequest({action:"preference",endpoint:sub.endpoint});setTransactionEnabled(pref.enabled??null);
   try{
    await sendTest(sub);
   }catch(e){
    // Un endpoint rechazado (409) puede recuperarse sin mostrar un botón de reparación.
    if(!(e instanceof PushRequestError)||![404,409,410].includes(e.status))throw e;
    sub=await ensureSubscription(reg,config.publicKey,true);
    await sendTest(sub);
    const renewed=await deviceCardRequest({action:"preference",endpoint:sub.endpoint});setTransactionEnabled(renewed.enabled??null);
   }
   setNotice("Notificación de prueba enviada.");
   showActionToast("Prueba de notificaciones enviada.");
  }catch(e){
   if(typeof Notification!=="undefined"&&Notification.permission!=="granted")setDeviceActive(false);
   setError((e as Error).message);
  }finally{setBusy(false);}
 }
 async function toggleTransaction(checked:boolean){
  setBusy(true);setError("");setNotice("");
  try{
   const sub=await devicePushSubscription();if(!sub)throw Error("Activa primero las notificaciones en este móvil.");
   const pref=await deviceCardRequest({action:"preference",endpoint:sub.endpoint,enabled:checked});
   if(typeof pref.enabled!=="boolean")throw Error("No se pudo guardar esta preferencia.");
   setTransactionEnabled(pref.enabled);showActionToast("Preferencia de avisos de compras guardada.");
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function toggle(item:Preference){
  setBusy(true);setError("");setNotice("");
  try{
   const opted_in=!item.opted_in;
   await postPush("/api/local/push/preferences",{action:"consent",business_id:item.business_id,opted_in});
   setItems(prev=>prev.map(p=>p.business_id===item.business_id?{...p,opted_in}:p));
   showActionToast("Preferencia de "+item.business_name+" guardada.");
   setNotice(opted_in?"Promociones activadas para "+item.business_name+".":"Promociones desactivadas para "+item.business_name+".");
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 return <section className="panel-card" style={{marginTop:22}}>
  <div className="panel-icon"><Bell size={22}/></div>
  <h2>Probar notificaciones</h2>

  {loading?<p className="muted">Comprobando notificaciones...</p>:<>
   {!config.enabled&&<div className="info-callout"><ShieldCheck size={18}/>Las notificaciones no están disponibles en este momento.</div>}
   {config.enabled&&!supported&&<div className="info-callout"><BellOff size={18}/>Necesitas un navegador compatible. En iPhone, instala KREYVI en la pantalla de inicio y ábrela desde su icono (iOS 16.4 o posterior).</div>}
   {config.enabled&&supported&&<div className="campaign-compose-actions" style={{marginBottom:14}}>
    <button className="button button-dark button-sm" type="button" disabled={busy}
     onClick={testNotification}><Bell size={16}/>{busy?"Enviando...":"Enviar prueba"}</button>
    {deviceActive&&<span className="muted" role="status">Avisos permitidos en este móvil</span>}
   </div>}
   {deviceActive&&transactionEnabled!==null&&<label className="check-control"><input type="checkbox" checked={transactionEnabled} disabled={busy} onChange={e=>void toggleTransaction(e.target.checked)}/><span><strong>Avisos de compras y recompensas</strong><small>Sellos, puntos, cashback y premios en este móvil. Independientes de las promociones.</small></span></label>}
   {showBusinesses&&items.length>0&&<div className="form-stack">
    {items.map(item=><div key={item.business_id} className="check-control">
     <input type="checkbox" id={"push-consent-"+item.business_id} checked={item.opted_in}
      disabled={busy||!config.enabled} onChange={()=>toggle(item)}/>
     <label htmlFor={"push-consent-"+item.business_id}><strong>{item.business_name}</strong><small>{item.opted_in?"Has aceptado sus notificaciones comerciales.":"No recibirás campañas push de este negocio."}</small></label>
    </div>)}
   </div>}
   {showBusinesses&&!items.length&&<p className="muted">Cuando guardes una tarjeta, podrás elegir qué negocios pueden enviarte avisos.</p>}
  </>}
  {error&&<div className="alert error" role="alert">{error}</div>}
  {notice&&<div className="alert success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
 </section>;
}
