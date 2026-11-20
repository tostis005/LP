"use client";
import {useEffect,useState} from "react";
import {Bell,BellOff,CheckCircle2,ShieldCheck} from "lucide-react";
import {showActionToast} from "@/lib/action-toast";

type Preference={business_id:string;business_name:string;opted_in:boolean};
type Config={enabled:boolean;publicKey:string};

function keyBytes(value:string):Uint8Array{
 const padded=(value+"=".repeat((4-value.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");
 const binary=atob(padded);
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function jsonRequest(path:string,init?:RequestInit){
 const res=await fetch(path,{credentials:"same-origin",cache:"no-store",...init});
 const data=await res.json() as {error?:string;[key:string]:unknown};
 if(!res.ok||data.error)throw new Error(data.error||"No se pudo completar la solicitud.");
 return data;
}

export function PushPreferences({showBusinesses=true}:{showBusinesses?:boolean}={}){
 const [config,setConfig]=useState<Config>({enabled:false,publicKey:""});
 const [items,setItems]=useState<Preference[]>([]),[platformOptedIn,setPlatformOptedIn]=useState(false);
 const [supported,setSupported]=useState(false),[deviceActive,setDeviceActive]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
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
    setPlatformOptedIn(p.platform_opted_in===true);
    const isSupported=window.isSecureContext&&"serviceWorker" in navigator
     &&"PushManager" in window&&"Notification" in window;
    setSupported(isSupported);
    if(isSupported){
     const reg=await navigator.serviceWorker.getRegistration();
     const sub=reg?await reg.pushManager.getSubscription():null;
     if(sub&&Notification.permission==="granted"&&c.enabled){
      // Al entrar con otra cuenta en el mismo móvil, vincular la suscripción con la cuenta actual.
      const data=sub.toJSON();
      await jsonRequest("/api/local/push/preferences",{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({action:"subscribe",endpoint:sub.endpoint,keys:data.keys})
      });
     }
     if(mounted)setDeviceActive(!!sub&&Notification.permission==="granted");
    }
   }catch(e){if(mounted)setError((e as Error).message);}
   finally{if(mounted)setLoading(false);}
  }
  load();
  return()=>{mounted=false;};
 },[]);
 async function activate(){
  setBusy(true);setError("");setNotice("");
  try{
   if(!config.enabled)throw new Error("Kreyv todavía no ha activado el servicio push.");
   if(!supported)throw new Error("Este navegador no admite push. En iPhone, abre Kreyv desde el icono de la pantalla de inicio.");
   // Debe solicitarse desde un clic del usuario, especialmente en iPhone.
   const permission=await Notification.requestPermission();
   if(permission!=="granted")throw new Error("Debes permitir las notificaciones en los ajustes del teléfono.");
   const reg=await navigator.serviceWorker.ready;
   let sub=await reg.pushManager.getSubscription();
   if(!sub){
    sub=await reg.pushManager.subscribe({
     userVisibleOnly:true,
     applicationServerKey:keyBytes(config.publicKey) as BufferSource
    });
   }
   const data=sub.toJSON();
   await jsonRequest("/api/local/push/preferences",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"subscribe",endpoint:sub.endpoint,keys:data.keys})
   });
   setDeviceActive(true);
   setNotice("Dispositivo registrado. Gestiona los negocios desde los ajustes de tus tarjetas.");showActionToast("Notificaciones activadas en este móvil.");
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function deactivate(){
  setBusy(true);setError("");setNotice("");
  try{
   const reg=await navigator.serviceWorker.ready;
   const sub=await reg.pushManager.getSubscription();
   if(sub){
    await jsonRequest("/api/local/push/preferences",{
     method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({action:"unsubscribe",endpoint:sub.endpoint})
    });
    await sub.unsubscribe();
   }
   setDeviceActive(false);
   setNotice("Push desactivado en este dispositivo. Tus preferencias de los negocios se mantienen para otros dispositivos.");showActionToast("Notificaciones desactivadas en este móvil.");
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function togglePlatform(){
  setBusy(true);setError("");setNotice("");
  const next=!platformOptedIn;
  try{
   await jsonRequest("/api/local/push/preferences",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"platform_consent",opted_in:next})
   });
   setPlatformOptedIn(next);showActionToast("Preferencias de notificaciones guardadas.");
   setNotice(next?"Has aceptado los avisos de Kreyv. También debes activar las notificaciones de este dispositivo para recibirlos.":"Has desactivado los avisos de Kreyv.");
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 async function toggle(item:Preference){
  setBusy(true);setError("");setNotice("");
  try{
   const opted_in=!item.opted_in;
   await jsonRequest("/api/local/push/preferences",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"consent",business_id:item.business_id,opted_in})
   });
   setItems(prev=>prev.map(p=>p.business_id===item.business_id?{...p,opted_in}:p));showActionToast("Preferencia de "+item.business_name+" guardada.");
   setNotice(opted_in?"Promociones activadas para "+item.business_name+".":"Promociones desactivadas para "+item.business_name+".");
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 return <section className="panel-card" style={{marginTop:22}}>
  <div className="panel-icon"><Bell size={22}/></div>
  <h2>Notificaciones del teléfono</h2>
  <p className="muted">Recibe ofertas de tus negocios favoritos en este móvil, incluso con Kreyv cerrada. El permiso del teléfono y la aceptación de cada negocio son independientes.</p>
  {loading?<p className="muted">Comprobando notificaciones...</p>:<>
   {!config.enabled&&<div className="info-callout"><ShieldCheck size={18}/>El servicio push se activará cuando Kreyv configure las claves VAPID y HTTPS.</div>}
   {config.enabled&&!supported&&<div className="info-callout"><BellOff size={18}/>Necesitas HTTPS y un navegador compatible. En iPhone, instala Kreyv en la pantalla de inicio y ábrela desde su icono (iOS 16.4 o posterior).</div>}
   {config.enabled&&supported&&<div className="campaign-compose-actions" style={{marginBottom:14}}>
    <button className="button button-dark button-sm" type="button" disabled={busy}
     onClick={activate}><Bell size={16}/>{deviceActive?"Sincronizar este dispositivo":"Activar push en este dispositivo"}</button>
    {deviceActive&&<button className="button button-outline button-sm" type="button" disabled={busy}
     onClick={deactivate}><BellOff size={16}/>Desactivar aquí</button>}
   </div>}
   <div className="check-control lp-platform-push-consent">
    <input type="checkbox" id="push-consent-loyally" checked={platformOptedIn} disabled={busy} onChange={togglePlatform}/>
    <label htmlFor="push-consent-loyally"><strong>Avisos de Kreyv: regalos, novedades y nuevos negocios</strong>
     <small>Opcional y separado de cada establecimiento. El servicio de avisos de la plataforma se activará próximamente; cuando esté disponible necesitará el permiso de este dispositivo.</small></label>
   </div>
   {showBusinesses&&items.length>0&&<div className="form-stack">
    {items.map(item=><div key={item.business_id} className="check-control">
     <input type="checkbox" id={"push-consent-"+item.business_id} checked={item.opted_in}
      disabled={busy||!deviceActive||!config.enabled} onChange={()=>toggle(item)}/>
     <label htmlFor={"push-consent-"+item.business_id}><strong>{item.business_name}</strong><small>{item.opted_in?"Has aceptado sus notificaciones comerciales.":"No recibirás campañas push de este negocio."}</small></label>
    </div>)}
   </div>}
   {showBusinesses&&!items.length&&<p className="muted">Cuando te unas a un negocio y guardes su tarjeta, podrás activar aquí sus notificaciones.</p>}
  </>}
  {error&&<div className="alert error" role="alert">{error}</div>}
  {notice&&<div className="alert success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
  <p className="tiny-note">Solo llegan notificaciones a dispositivos compatibles, registrados y autorizados. Puedes desactivar cada negocio cuando quieras.</p>
 </section>;
}
