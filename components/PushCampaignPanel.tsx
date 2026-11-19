"use client";
import {useCallback,useEffect,useState} from "react";
import {BellRing,Check,ShieldCheck} from "lucide-react";
import {demoRole} from "@/lib/demo-local";

type Campaign={id:string;title:string;status:string;recipient_count:number;sent_count:number;failed_count:number;created_at:string};
type Overview={devices:number;campaigns:Campaign[];enabled:boolean};
async function api(path:string,init?:RequestInit){
 const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...init});
 const data=await response.json() as {error?:string;[key:string]:unknown};
 if(!response.ok||data.error)throw new Error(data.error||"No se pudo completar la operación.");
 return data;
}
const statusText:Record<string,string>={queued:"En cola",sending:"Enviando",sent:"Enviada",partial:"Parcial",failed:"Fallida"};

export function PushCampaignPanel({businessId}:{businessId:string}){
 const [overview,setOverview]=useState<Overview>({devices:0,campaigns:[],enabled:false});
 const [title,setTitle]=useState(""),[body,setBody]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [notice,setNotice]=useState(""),[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  const result=await api("/api/local/push/campaigns?business="+encodeURIComponent(businessId));
  const next:Overview={devices:Number(result.devices||0),enabled:!!result.enabled,
   campaigns:(result.campaigns||[]) as Campaign[]};
  setOverview(next);return next;
 },[businessId]);
 useEffect(()=>{let alive=true;setLoading(true);
  refresh().catch(e=>{if(alive)setError((e as Error).message)})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[refresh]);
 async function continueCampaign(id:string){
  // Se procesan lotes acotados; si hay miles de destinatarios, queda opción de reanudar.
  let last:Overview=overview;
  for(let batch=0;batch<25;batch++){
   await api("/api/local/push/send",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({campaign_id:id})
   });
   last=await refresh();
   const current=last.campaigns.find(c=>c.id===id);
   if(!current||!["queued","sending"].includes(current.status))break;
  }
  const current=last.campaigns.find(c=>c.id===id);
  if(current)setNotice(current.sent_count+" envíos aceptados, "+current.failed_count+
   " fallidos y "+Math.max(0,current.recipient_count-current.sent_count-current.failed_count)+
   " pendientes. "+(["queued","sending"].includes(current.status)?"Puedes continuar el envío desde el historial.":"Campaña procesada."));
 }
 async function create(e:React.FormEvent){
  e.preventDefault();setError("");setNotice("");
  if(demoRole()){setError("Los envíos reales están desactivados en modo demostración.");return;}
  if(!overview.enabled){setError("Web Push todavía no está configurado en el servidor.");return;}
  if(overview.devices<1){setError("No hay dispositivos con permiso y consentimiento de este negocio.");return;}
  if(!window.confirm("¿Enviar esta notificación a "+overview.devices+" dispositivos registrados de este negocio?"))return;
  setBusy(true);
  try{
   const result=await api("/api/local/push/campaigns",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({business_id:businessId,title:title.trim(),body:body.trim()})
   });
   setTitle("");setBody("");
   await refresh();
   await continueCampaign(String(result.id));
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function resume(id:string){
  setBusy(true);setNotice("");setError("");
  try{await continueCampaign(id)}
  catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 return <div>
  <div className="campaign-overview-grid">
   <div className="panel-card campaign-overview-stat"><span>Dispositivos con consentimiento</span><strong>{loading?"…":overview.devices}</strong><small>Con tarjeta de este negocio y push activado</small></div>
   <div className="panel-card campaign-overview-stat"><span>Canal</span><strong>Web Push</strong><small>Android y PWA instalada en iPhone</small></div>
   <div className="panel-card campaign-overview-stat"><span>Coste de envío</span><strong>Sin coste por push</strong><small>No se contabilizan cargos de campaña</small></div>
  </div>
  {!overview.enabled&&<div className="info-callout"><ShieldCheck size={18}/>El envío push estará disponible cuando configuremos HTTPS y las claves VAPID en el servidor.</div>}
  <div className="campaign-editor-grid">
   <form className="panel-card campaign-compose" onSubmit={create}>
    <div className="panel-icon"><BellRing size={23}/></div>
    <h2>Enviar notificación push</h2>
    <p className="muted">Solo se enviará a los dispositivos de clientes que tienen tarjeta de este negocio y aceptaron sus promociones push.</p>
    <div className="form-stack">
     <label>Título<input required minLength={3} maxLength={120} value={title}
      onChange={e=>setTitle(e.target.value)} placeholder="¡Hoy tienes una sorpresa!"/></label>
     <label>Mensaje<textarea required rows={5} minLength={3} maxLength={500} value={body}
      onChange={e=>setBody(e.target.value)} placeholder="Visítanos esta semana y consigue un sello extra."/></label>
     <small>{body.length}/500 caracteres</small>
     <div className="campaign-compose-actions"><button className="button button-dark" type="submit"
      disabled={busy||loading||!overview.enabled||overview.devices===0||title.trim().length<3||body.trim().length<3||!!demoRole()}>
      {busy?"Enviando...":"Enviar push"} <BellRing size={17}/></button></div>
    </div>
    <p className="tiny-note">El teléfono debe haber autorizado las notificaciones. Un dispositivo puede dejar de estar disponible después del envío.</p>
   </form>
   <div className="campaign-sidebar">
    <section className="panel-card"><h2>Historial push</h2>
     {overview.campaigns.map(c=><div className="campaign-draft-row" key={c.id}>
      <div><strong>{c.title}</strong><span>{statusText[c.status]||c.status} · {new Date(c.created_at).toLocaleDateString("es-ES")}</span>
       <small>{c.sent_count} aceptados · {c.failed_count} fallidos · {Math.max(0,c.recipient_count-c.sent_count-c.failed_count)} pendientes</small></div>
      {["queued","sending"].includes(c.status)&&<button className="button button-outline button-sm"
       type="button" disabled={busy||!overview.enabled||!!demoRole()} onClick={()=>resume(c.id)}>Continuar</button>}
     </div>)}
     {!overview.campaigns.length&&<p className="muted">Todavía no hay campañas push.</p>}
    </section>
    <section className="panel-card"><h2>Privacidad y destinatarios</h2>
     <p className="muted">Las suscripciones y claves de cada dispositivo se guardan de forma privada. Cada negocio solo puede enviar mensajes a los clientes de sus propias tarjetas.</p>
     <p className="tiny-note">«Aceptados» indica que el servicio push recibió el mensaje, no que el usuario lo haya leído.</p>
    </section>
   </div>
  </div>
  {error&&<div className="alert error" role="alert">{error}</div>}
  {notice&&<div className="alert success" role="status"><Check size={17}/>{notice}</div>}
 </div>;
}
