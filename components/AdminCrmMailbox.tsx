"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Thread={thread_id:string;subject:string;preview:string;from_name:string;from_email:string;last_message_uid:string;last_message_at:string;has_unread:boolean;last_senders?:string[]};
type Message={message_uid:string;from_name:string;from_email:string;direction:string;received_at:string;preview:string;body?:{text?:string;html?:string};has_attachments?:boolean};
type Data={connected:boolean;email?:string;threads?:Thread[];next_cursor?:string;unread?:number};
type Detail={thread:{subject:string;thread_id:string};messages:Message[]};
async function api(query="",body?:object){
 const r=await fetch("/api/local/admin/crm/mailbox"+query,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const j=await r.json();if(!r.ok)throw new Error(j.error||"No se pudo acceder al buzón.");return j;
}
const date=(s:string)=>new Date(s).toLocaleString("es-MX");
export function AdminCrmMailbox(){
 const [open,setOpen]=useState(false),[data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [folder,setFolder]=useState("INBOX"),[unreadOnly,setUnreadOnly]=useState(false),[pendingOnly,setPendingOnly]=useState(false);
 const [token,setToken]=useState(""),[refresh,setRefresh]=useState(""),[config,setConfig]=useState(false);
 const [detail,setDetail]=useState<Detail|null>(null),[reply,setReply]=useState(""),[cursor,setCursor]=useState("");
 const [compose,setCompose]=useState(false),[to,setTo]=useState(""),[subject,setSubject]=useState(""),[body,setBody]=useState(""),[permitted,setPermitted]=useState(false),[attempt,setAttempt]=useState("");
 const version=useRef(0),working=useRef(false);
 const load=useCallback(async(next="",silent=false)=>{
  if(working.current&&silent)return;
  const v=++version.current;
  if(!silent)setBusy(true);
  try{
   const p=new URLSearchParams({folder,unread:unreadOnly?"1":"0",...(next?{cursor:next}:{})});
   const d=await api("?"+p);if(v!==version.current)return;
   setData(d);setCursor(next);setError("");
  }catch(e){if(v===version.current)setError(e instanceof Error?e.message:"Error de conexión.");}
  finally{if(v===version.current)setBusy(false);}
 },[folder,unreadOnly]);
 useEffect(()=>{
  if(!open)return;
  void load();
  const timer=setInterval(()=>{if(!document.hidden&&!working.current)void load("",true);},300000);
  return()=>{clearInterval(timer);version.current++;};
 },[open,load]);
 async function act(action:()=>Promise<void>){
  if(working.current)return;working.current=true;setBusy(true);setError("");setNotice("");
  try{await action();}catch(e){setError(e instanceof Error?e.message:"Error de buzón.");}
  finally{working.current=false;setBusy(false);}
 }
 async function connect(){await act(async()=>{
  const d=await api("",{action:"connect",token,refresh});setData(d);setToken("");setRefresh("");setConfig(false);setDetail(null);await load();
 });}
 async function select(t:Thread){await act(async()=>{
  setDetail(null);setReply("");const d=await api("?"+new URLSearchParams({thread:t.thread_id}));setDetail(d);
  if(t.has_unread){await api("",{action:"read",id:t.last_message_uid,read:true});await load(cursor);}
 });}
 async function sendReply(){const inbound=detail?.messages.filter(m=>m.direction==="inbound").at(-1);
  if(!inbound||!reply.trim())return;
  await act(async()=>{
   const result=await api("",{action:"reply",id:inbound.message_uid,text:reply});
   if(!result.queued)throw new Error("No se ha confirmado el envío. Comprueba Enviados antes de repetir.");
   setReply("");setNotice("Respuesta en cola de envío.");
   const d=await api("?"+new URLSearchParams({thread:detail!.thread.thread_id}));setDetail(d);await load(cursor);
  });
 }
 async function sendNew(){if(!to.trim()||!subject.trim()||!body.trim()||!permitted)return;
  await act(async()=>{
   const id=attempt||crypto.randomUUID();setAttempt(id);
   const result=await api("",{action:"send",id,to,subject,text:body,permitted});
   if(!result.queued)throw new Error("No se confirmó el envío. Comprueba Enviados antes de repetir.");
   setCompose(false);setTo("");setSubject("");setBody("");setPermitted(false);setAttempt("");setNotice("Correo en cola de envío.");await load();
  });
 }
 const threads=(data?.threads||[]).filter(t=>!pendingOnly||t.from_email.toLowerCase()!==data?.email?.toLowerCase());
 return <section className="admin-inspector" style={{margin:"12px 0"}}>
  <div className="content-heading"><div><strong>Correo comercial · Sendcorex</strong>{data?.connected&&<small>{data.email}{data.unread? " · "+data.unread+" sin leer":""}</small>}</div>
   <button type="button" className="button button-outline button-sm" onClick={()=>setOpen(!open)}>{open?"Cerrar correo":"Abrir bandeja"}</button></div>
  {open&&<div className="form-stack">
   {error&&<div role="alert" className="alert error">{error}</div>}{notice&&<div role="status" className="alert success">{notice}</div>}
   {(!data?.connected||config)&&<form className="form-stack" onSubmit={e=>{e.preventDefault();void connect();}}>
    <p>Conecta el buzón comercial independiente. Genera su token en <a href="https://webmail.sendcorex.com" target="_blank" rel="noreferrer">Webmail de Sendcorex</a> → Configuración, con permiso de lectura y escritura. No es la API key general del panel.</p>
    <label>Token del buzón<input type="password" autoComplete="off" required value={token} onChange={e=>setToken(e.target.value)} disabled={busy}/></label>
    <label>Refresh token (si se proporciona)<input type="password" autoComplete="off" value={refresh} onChange={e=>setRefresh(e.target.value)} disabled={busy}/></label>
    <button type="submit" className="button button-dark button-sm" disabled={busy||!token.trim()}>Conectar y verificar</button>
    {config&&<button type="button" className="button button-outline button-sm" onClick={()=>{setConfig(false);setToken("");setRefresh("");}}>Cancelar</button>}
   </form>}
   {data?.connected&&<><div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
    <button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>{setFolder("INBOX");setDetail(null);}}>Entrada ({data.unread||0})</button>
    <button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>{setFolder("Sent");setDetail(null);setUnreadOnly(false);setPendingOnly(false);}}>Enviados</button>
    <button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>void load()}>Actualizar</button>
    <button type="button" className="button button-dark button-sm" disabled={busy} onClick={()=>setCompose(!compose)}>Redactar</button>
    <button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>setConfig(true)}>Reconectar</button>
    {folder==="INBOX"&&<><label><input type="checkbox" checked={unreadOnly} onChange={e=>setUnreadOnly(e.target.checked)}/> Sin leer</label><label><input type="checkbox" checked={pendingOnly} onChange={e=>setPendingOnly(e.target.checked)}/> Último mensaje recibido</label></>}
   </div>
   {compose&&<form className="form-stack" onSubmit={e=>{e.preventDefault();void sendNew();}}>
    <label>Para<input type="email" required maxLength={254} disabled={busy||!!attempt} value={to} onChange={e=>setTo(e.target.value)}/></label>
    <label>Asunto<input required maxLength={240} disabled={busy||!!attempt} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
    <label>Mensaje<textarea required rows={6} maxLength={15000} disabled={busy||!!attempt} value={body} onChange={e=>setBody(e.target.value)}/></label>
    <label><input type="checkbox" checked={permitted} disabled={busy||!!attempt} onChange={e=>setPermitted(e.target.checked)}/> Confirmo que puedo contactar con este destinatario, que el origen no es una lista prohibida por Sendcorex y que se respetan las bajas.</label>
    <small>Un destinatario por envío. Máximo 30 intentos de correo nuevo en 24 horas. Se incluirá la opción de baja.</small>
    <button type="submit" className="button button-dark button-sm" disabled={busy||!permitted||!!attempt}>Enviar correo</button>
    {attempt&&<p role="status">Ya se intentó enviar este mensaje. Comprueba Enviados antes de redactarlo nuevamente.</p>}
    <button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>{setCompose(false);setAttempt("");setPermitted(false);}}>Cerrar redacción</button>
   </form>}
   {busy&&<p role="status">Cargando correo…</p>}
   <div style={{display:"grid",gap:6}}>{threads.map(t=><button key={t.thread_id} type="button" className="button button-outline" style={{display:"block",textAlign:"left",whiteSpace:"normal",height:"auto"}} disabled={busy} onClick={()=>void select(t)}>
    <span style={{fontWeight:t.has_unread?700:400}}>{t.has_unread?"● ":""}{t.from_name||t.from_email} · {t.subject||"(Sin asunto)"}</span><small style={{display:"block"}}>{date(t.last_message_at)} · {t.preview}</small>
   </button>)}</div>
   {!busy&&!threads.length&&<p className="muted">No hay conversaciones en esta página.</p>}
   <div style={{display:"flex",gap:8}}>{cursor&&<button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>void load()}>Primera página</button>}{data.next_cursor&&<button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>void load(data.next_cursor)}>Siguiente página</button>}</div>
   {detail&&<div className="admin-inspector"><div className="content-heading"><strong>{detail.thread.subject||"(Sin asunto)"}</strong><button type="button" className="inline-table-button" onClick={()=>{setDetail(null);setReply("");}}>Cerrar conversación</button></div>
    {detail.messages.map(m=><div key={m.message_uid} style={{borderBottom:"1px solid var(--border,#ddd)",padding:"12px 0"}}><strong>{m.direction==="outbound"?"Enviado":m.from_name||m.from_email}</strong><small style={{display:"block"}}>{m.from_email} · {date(m.received_at)}</small><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{m.body?.text||m.preview||"(Sin texto disponible)"}</p>{m.has_attachments&&<small>Contiene adjuntos. Consultar en Webmail.</small>}</div>)}
    {detail.messages.some(m=>m.direction==="inbound")&&<form className="form-stack" onSubmit={e=>{e.preventDefault();void sendReply();}}><label>Responder<textarea rows={5} maxLength={15000} value={reply} onChange={e=>setReply(e.target.value)} required disabled={busy}/></label><button type="submit" className="button button-dark button-sm" disabled={busy||!reply.trim()}>Enviar respuesta</button></form>}
   </div>}
   <small className="muted">Actualización cada cinco minutos con la bandeja abierta. No se activan envíos automáticos.</small>
   </>}
  </div>}
 </section>;
}
