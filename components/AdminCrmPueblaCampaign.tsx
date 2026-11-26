"use client";
import {useRef,useState} from "react";
type Candidate={id:string;name:string;email:string;category:string;activity:string;source_url:string;status:string};
type Plan={sender:string|null;remaining:number|null;subject:string;candidates:Candidate[];github?:{enabled:boolean;fiscalAddress:string;dailyLimit:number|null}};
const endpoint="/api/local/admin/crm/campaigns/puebla";
async function call(body?:object){
 const r=await fetch(endpoint,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const j=await r.json();if(!r.ok)throw new Error(j.error||"No se pudo completar la operación.");return j;
}
export function AdminCrmPueblaCampaign({onChange}:{onChange:()=>void}){
 const [plan,setPlan]=useState<Plan|null>(null),[selected,setSelected]=useState<string[]>([]),[address,setAddress]=useState(""),[permitted,setPermitted]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[sent,setSent]=useState<string[]>([]),[current,setCurrent]=useState("");
 const working=useRef(false);
 const [githubNotice,setGithubNotice]=useState(""),[dailyLimit,setDailyLimit]=useState("30");
 async function configureGithub(enabled:boolean){
  if(working.current||enabled&&(!permitted||address.trim().length<10))return;
  working.current=true;setBusy(true);setError("");setGithubNotice("");
  try{await call({action:"configure_github",enabled,permitted,fiscalAddress:address,dailyLimit:dailyLimit.trim()===""?null:Number(dailyLimit)});const p:Plan=await call();setPlan(p);setSelected(p.candidates.slice(0,p.remaining??p.candidates.length).map(c=>c.id));setPermitted(false);setGithubNotice(enabled?"Canal GitHub habilitado para órdenes autorizadas.":"Canal GitHub deshabilitado.");}
  catch(e){setError(e instanceof Error?e.message:"No se pudo configurar el canal.");}
  finally{working.current=false;setBusy(false);}
 }
 async function prepare(){
  if(working.current)return;working.current=true;setBusy(true);setError("");setPermitted(false);setSent([]);
  try{const p:Plan=await call();setPlan(p);setAddress(p.github?.fiscalAddress||"");setDailyLimit(p.github?.dailyLimit===null?"":String(p.github?.dailyLimit??30));setSelected(p.candidates.slice(0,p.remaining??p.candidates.length).map(c=>c.id));}
  catch(e){setError(e instanceof Error?e.message:"No se pudo preparar la selección.");}
  finally{working.current=false;setBusy(false);}
 }
 async function send(){
  if(working.current||!plan?.sender||!permitted||address.trim().length<10||!selected.length||plan.remaining!==null&&selected.length>plan.remaining)return;
  const batch=plan.candidates.filter(c=>selected.includes(c.id));
  working.current=true;setBusy(true);setError("");setSent([]);
  let count=0;
  try{for(const row of batch){
   setCurrent(row.name);
   const result=await call({id:row.id,email:row.email,fiscalAddress:address,permitted});
   if(!result.queued)throw new Error("SendCoreX no confirmó la cola. Revisa el historial antes de repetir.");
   count++;setSent(old=>[...old,row.name]);setSelected(old=>old.filter(id=>id!==row.id));
  }}catch(e){setError("Campaña detenida después de "+count+" correos confirmados en cola. "+(e instanceof Error?e.message:"Error de envío.")+" Actualiza la selección antes de continuar.");}
  finally{setCurrent("");setPermitted(false);setPlan(null);setSelected([]);working.current=false;setBusy(false);onChange();}
 }
 return <section className="admin-inspector" style={{margin:"12px 0"}}>
  <div className="content-heading"><div><strong>Campaña comercial · Puebla</strong><small>Plantilla HTML Kreyvi, personalizada por negocio. La vista manual muestra hasta 30 candidatos; las órdenes GitHub admiten la cantidad solicitada.</small></div>
  <button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>void prepare()}>Preparar selección</button></div>
  {error&&<div role="alert" className="alert error">{error}</div>}
  {!!sent.length&&<div role="status" className="alert success">{sent.length} correos confirmados en cola. La entrega se comprueba en el historial.</div>}
  {current&&<p role="status">Enviando a {current}…</p>}
  {githubNotice&&<p role="status">{githubNotice}</p>}
  {plan&&<div className="form-stack">
   <p>Remitente: {plan.sender||"No conectado"} · Intentos disponibles en 24 h: {plan.remaining??"Sin límite local"} · Seleccionados: {selected.length}</p>
   <p><strong>Asunto:</strong> {plan.subject}</p>
   <div style={{maxHeight:360,overflow:"auto"}}>{plan.candidates.map(c=><label key={c.id} style={{display:"flex",gap:10,alignItems:"center",padding:6}}><input type="checkbox" disabled={busy} checked={selected.includes(c.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/><span>{c.name} — {c.email}<br/><small>{c.category} · <a href={c.source_url} target="_blank" rel="noreferrer">Fuente del contacto</a></small></span></label>)}</div>
   <label>Dirección fiscal real<input value={address} maxLength={500} disabled={busy} onChange={e=>setAddress(e.target.value)} placeholder="Dirección postal del remitente"/></label>
   <label style={{display:"flex",gap:10,alignItems:"center"}}><input type="checkbox" checked={permitted} disabled={busy} onChange={e=>setPermitted(e.target.checked)}/>Confirmo que los contactos seleccionados pueden recibir esta comunicación comercial conforme a las condiciones de SendCoreX y la normativa aplicable.</label>
   <button type="button" className="button" disabled={busy||!plan.sender||!permitted||address.trim().length<10||!selected.length||plan.remaining!==null&&selected.length>plan.remaining} onClick={()=>void send()}>Enviar {selected.length} correos seleccionados</button>
   <div className="admin-inspector"><strong>Canal de órdenes GitHub</strong><p>Estado: {plan.github?.enabled?"Habilitado":"Deshabilitado"}. Habilitar autoriza envíos futuros en la cantidad indicada por el propietario, únicamente cuando la comunicación esté permitida y el proveedor lo permita. Puedes revocarlo aquí. La dirección fiscal queda en el CRM, nunca en GitHub.</p><label>Límite de intentos en 24 horas (opcional)<input type="number" min={1} max={2147483647} step={1} value={dailyLimit} disabled={busy||plan.github?.enabled} onChange={e=>setDailyLimit(e.target.value)} placeholder="Sin límite local"/></label><small>Vacío = sin límite local. Para cambiar una autorización existente, deshabilita el canal y autorízalo de nuevo. Se mantienen las restricciones del proveedor.</small><button type="button" className="button button-outline" disabled={busy||(!plan.github?.enabled&&(!plan.sender||!permitted||address.trim().length<10))} onClick={()=>void configureGithub(!plan.github?.enabled)}>{plan.github?.enabled?"Deshabilitar canal GitHub":"Autorizar canal GitHub"}</button></div>
   <small>Sin seguimiento de aperturas o clics. SendCoreX añade su mecanismo de baja. Los errores detienen el lote; no se reintenta automáticamente.</small>
  </div>}
 </section>;
}
