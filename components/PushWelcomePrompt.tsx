"use client";
import {useEffect,useState} from "react";
import {BellRing,CheckCircle2,ShieldCheck,X} from "lucide-react";
import {demoRole} from "@/lib/demo-local";

type PushConfig={enabled:boolean;publicKey:string};

function bytes(value:string):Uint8Array{
 const padded=(value+"=".repeat((4-value.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");
 return Uint8Array.from(atob(padded),x=>x.charCodeAt(0));
}
async function requestJson(path:string,body?:unknown){
 const response=await fetch(path,{
  method:body===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",
  ...(body===undefined?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
 });
 const result=await response.json() as {error?:string;[key:string]:unknown};
 if(!response.ok||result.error)throw new Error(result.error||"No se pudo completar la operación.");
 return result;
}
const storageKey="lp-push-intro-2026-v2";
function isInstalled(){
 return window.matchMedia("(display-mode: standalone)").matches||
  (navigator as Navigator&{standalone?:boolean}).standalone===true;
}

export function PushWelcomePrompt(){
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false);
 const [config,setConfig]=useState<PushConfig|null>(null);
 const [error,setError]=useState("");
 const [finished,setFinished]=useState(false);
 useEffect(()=>{
  let active=true;
  async function load(){
   try{
    if(demoRole()||!window.isSecureContext||!isInstalled()
      ||!("Notification" in window)||!("PushManager" in window)
      ||!("serviceWorker" in navigator)||Notification.permission==="denied"
      ||localStorage.getItem(storageKey))return;
    const c=await requestJson("/api/local/push/config");
    if(!c.enabled||!c.publicKey||!active)return;
    const reg=await navigator.serviceWorker.getRegistration();
    const sub=reg?await reg.pushManager.getSubscription():null;
    if(!active)return;
    if(sub&&Notification.permission==="granted"){
     await requestJson("/api/local/push/preferences",{
      action:"subscribe",endpoint:sub.endpoint,keys:sub.toJSON().keys
     });
     return;
    }
    setConfig({enabled:true,publicKey:String(c.publicKey)});
    setShow(true);
   }catch{
    // No interrumpir la vista de tarjetas si el servicio push está inaccesible.
   }
  }
  void load();
  return()=>{active=false};
 },[]);
 function dismiss(){
  localStorage.setItem(storageKey,"dismissed");
  setShow(false);
 }
 async function activate(){
  if(!config||busy)return;
  setBusy(true);setError("");
  try{
   // Primer await directamente asociado al clic: requerido por Android/iOS.
   const permission=await Notification.requestPermission();
   if(permission!=="granted")throw new Error("No se ha concedido el permiso de notificaciones. Puedes activarlo después en Ajustes.");
   const reg=await navigator.serviceWorker.ready;
   let subscription=await reg.pushManager.getSubscription();
   if(!subscription){
    subscription=await reg.pushManager.subscribe({
     userVisibleOnly:true,
     applicationServerKey:bytes(config.publicKey) as BufferSource
    });
   }
   await requestJson("/api/local/push/preferences",{
    action:"subscribe",endpoint:subscription.endpoint,keys:subscription.toJSON().keys
   });
   localStorage.setItem(storageKey,"accepted");
   setFinished(true);
  }catch(e){
   setError((e as Error).message);
  }finally{setBusy(false)}
 }
 if(!show)return null;
 return <div className="lp-push-welcome-overlay">
  <section className="lp-push-welcome" role="dialog" aria-modal="true" aria-labelledby="lp-push-welcome-title">
   <button type="button" aria-label="Cerrar" className="lp-push-welcome-close" onClick={dismiss}><X size={19}/></button>
   <span className="lp-push-welcome-icon"><BellRing size={26}/></span>
   {finished?<><h2 id="lp-push-welcome-title">¡Avisos activados!</h2>
     <p>Tu teléfono está registrado. Podrás cambiar tus preferencias en «Ajustes».</p>
     <button type="button" className="button button-dark button-full" onClick={()=>setShow(false)}><CheckCircle2 size={17}/> Continuar a mis tarjetas</button>
    </>:<>
     <h2 id="lp-push-welcome-title">¿Quieres recibir avisos de Loyally?</h2>
     <p>Permite las notificaciones del móvil para recibir promociones de las tarjetas cuyos avisos ya hayas aceptado. Podrás recibirlas aunque Loyally esté cerrada.</p>
     <p className="lp-push-welcome-privacy"><ShieldCheck size={15}/> Este permiso es opcional y no activa avisos de ningún negocio por sí solo. Los canales de cada tarjeta se gestionan en Ajustes.</p>
     {error&&<p role="alert" className="alert error">{error}</p>}
     <button type="button" className="button button-dark button-full" disabled={busy} onClick={activate}>
      <BellRing size={17}/>{busy?"Activando...":"Permitir notificaciones"}
     </button>
     <button type="button" className="button button-outline button-full" disabled={busy} onClick={dismiss}>Ahora no</button>
    </>}
  </section>
 </div>;
}
