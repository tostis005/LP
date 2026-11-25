"use client";
import {useCallback,useEffect,useState,useRef} from "react";
import {Mail,RefreshCw,ArrowUpRight,ArrowDownLeft,Clock,CheckCircle2} from "lucide-react";
type SyncState={source:string;last_finished:string|null;window_end:string|null;last_error:string|null};
type Status={connected:boolean;email?:string;logsConnected?:boolean;states?:SyncState[]};
type Message={source:string;external_id:string;correspondent:string;direction:string;occurred_at:string;subject:string;body_text:string;delivery_status:string};
async function request(query="",body?:object){
 const r=await fetch("/api/local/admin/crm/history"+query,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok)throw new Error(data.error||"No se pudo acceder al historial.");return data;
}
const fmt=(d:string)=>new Date(d).toLocaleString("es-MX",{dateStyle:"medium",timeStyle:"short"});
const labels:Record<string,string>={received:"Recibido",delivered:"Aceptado por destinatario",bounced:"Rebotado",spam:"Rechazado por spam",rate_limited:"Límite de envío",not_sent:"No enviado",unknown:"Estado desconocido"};
export function useCrmMailSync(onChange:()=>void){
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(""),[syncing,setSyncing]=useState(false);
 const busy=useRef(false),callback=useRef(onChange);callback.current=onChange;
 const refresh=useCallback(async()=>{const d=await request();setStatus(d);return d as Status;},[]);
 const run=useCallback(async()=>{
  if(busy.current)return;busy.current=true;setSyncing(true);
  try{
   const d=await refresh();if(!d.connected)return;
   const sources=d.logsConnected?["inbox","logs"]:["inbox"];
   const results=await Promise.all(sources.map(source=>request("",{action:"sync",source}).catch(e=>({error:e.message}))));
   await refresh();setError(results.map(r=>r.error).filter(Boolean).join(" · "));
   if(results.some(r=>r.synced>0))callback.current();
  }catch(e){setError(e instanceof Error?e.message:"Error de sincronización.");}
  finally{busy.current=false;setSyncing(false);}
 },[refresh]);
 useEffect(()=>{void run();const timer=setInterval(()=>{if(!document.hidden)void run();},60000);return()=>clearInterval(timer);},[run]);
 return {status,error,syncing,run,refresh};
}
export function CrmMailSettings({sync}:{sync:ReturnType<typeof useCrmMailSync>}){
 const [token,setToken]=useState(""),[refresh,setRefresh]=useState(""),[key,setKey]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function save(){setBusy(true);setError("");try{await request("",{action:"configure",token,refresh,key});setToken("");setRefresh("");setKey("");await sync.run();}catch(e){setError(e instanceof Error?e.message:"No se pudo conectar.");}finally{setBusy(false);}}
 return <section className="crm-sync-panel">
  <div className="content-heading"><div><h3>Sincronización comercial</h3><p>El correo se guarda en PostgreSQL y aparece en las fichas de los negocios. Los envíos y respuestas se gestionan en Sendcorex.</p></div><button type="button" className="button button-outline button-sm" disabled={sync.syncing||busy} onClick={()=>void sync.run()}><RefreshCw size={15}/> {sync.syncing?"Sincronizando…":"Sincronizar"}</button></div>
  <div className="crm-sync-status"><strong>{sync.status?.email||"Buzón sin conectar"}</strong><small>{sync.status?.logsConnected?"Registro de envíos conectado":"Registro de envíos sin conectar"}</small>{sync.status?.states?.map(s=><div key={s.source}><strong>{s.source==="inbox"?"Entrada":"Envíos"}</strong><span>{s.window_end?"Importación en curso":s.last_finished?"Actualizado "+fmt(s.last_finished):"Pendiente"}</span>{s.last_error&&<small role="alert">{s.last_error}</small>}</div>)}</div>
  {(sync.error||error)&&<p role="alert" className="alert error">{error||sync.error}</p>}
  <details open={!sync.status?.connected}><summary>Configurar conexión</summary><form className="form-stack" onSubmit={e=>{e.preventDefault();void save();}}>
    <p>Introduce los tokens de <a href="https://webmail.sendcorex.com" target="_blank" rel="noreferrer">Webmail</a> y la API key del panel de Sendcorex con permiso <code>logs:read</code>. Se guardan cifrados. No se muestran de nuevo.</p>
    <label>Token de acceso del buzón<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)}/></label>
    <label>Refresh token<input type="password" autoComplete="off" value={refresh} onChange={e=>setRefresh(e.target.value)}/></label>
    <label>API key de envíos (logs:read)<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}/></label>
    <button className="button button-dark button-sm" type="submit" disabled={busy||(!token&&!key)||!!token&&!refresh}>{busy?"Verificando…":"Guardar conexión"}</button>
   </form></details><small className="muted">Los datos se consultan localmente. La sincronización comprueba cambios cada cinco minutos con el CRM abierto; la primera importación avanza por páginas.</small>
 </section>;
}
export function CrmContactHistory({id,revision}:{id:string;revision:number}){
 const [messages,setMessages]=useState<Message[]>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const seq=useRef(0);
 const load=useCallback(async(offset=0)=>{const v=++seq.current;setLoading(true);setError("");try{const d=await request("?"+new URLSearchParams({contact:id,offset:String(offset)}));if(v!==seq.current)return;setMessages(old=>offset?[...old,...d.messages]:d.messages);setMore(d.more);}catch(e){if(v===seq.current)setError(e instanceof Error?e.message:"No se pudo cargar.");}finally{if(v===seq.current)setLoading(false);}},[id]);
 useEffect(()=>{setMessages([]);void load();return()=>{seq.current++;};},[load,revision]);
 return <section className="crm-contact-history"><div className="content-heading"><div><h3><Mail size={17}/> Historial de correo</h3><small>Mensajes asociados a los correos registrados del negocio.</small></div></div>
  {error&&<p role="alert">{error}</p>}{loading&&!messages.length&&<p role="status">Cargando historial local…</p>}{!loading&&!messages.length&&!error&&<p className="muted">Todavía no hay comunicaciones registradas.</p>}
  {messages.map(m=><details key={m.source+":"+m.external_id+":"+m.correspondent} className="crm-history-item"><summary><span className={"crm-history-icon "+m.direction}>{m.direction==="inbound"?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span><span><strong>{m.subject||"(Sin asunto)"}</strong><small>{m.direction==="inbound"?"Recibido de":"Enviado a"} {m.correspondent} · {fmt(m.occurred_at)}</small><small>{labels[m.delivery_status]||m.delivery_status}</small></span></summary><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{m.body_text||"Contenido no disponible en Sendcorex."}</p></details>)}
  {more&&<button type="button" className="button button-outline button-sm" disabled={loading} onClick={()=>void load(messages.length)}>Ver más comunicaciones</button>}
 </section>;
}
