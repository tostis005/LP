"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {BellRing,Check,Clock3,Gift,PauseCircle,PlayCircle,Plus,Save,SlidersHorizontal,Ticket,Users,Repeat,ShoppingBag,CalendarClock,Pencil} from "lucide-react";
type Trigger="signup"|"no_visit"|"visits"|"stamps"|"inactivity"|"first_redeem";
type Rule={id:string;name:string;trigger_kind:Trigger;delay_days:number;target_stamps:number|null;
 window_days:number|null;target_visits:number|null;inactivity_days:number|null;
 staff_instruction:string;active:boolean;created_at:string;title:string;preview:string;details:string};
type Mode="new"|"edit"|null;
const triggerItems:{value:Trigger;label:string;detail:string;group:string}[]=[
 {value:"signup",label:"Se registra una tarjeta nueva",detail:"Da la bienvenida y anima a hacer la primera compra.",group:"Activar clientes nuevos"},
 {value:"no_visit",label:"No realiza su primera visita",detail:"Recuerda la tarjeta a quien se apuntó pero aún no ha comprado.",group:"Activar clientes nuevos"},
 {value:"visits",label:"Alcanza un número de visitas",detail:"Reconoce la primera compra o premia la repetición de visitas.",group:"Fidelizar y reconocer"},
 {value:"stamps",label:"Alcanza una cantidad de sellos",detail:"Activa un aviso al conseguir un objetivo dentro de un plazo.",group:"Fidelizar y reconocer"},
 {value:"first_redeem",label:"Canjea su primera recompensa",detail:"Refuerza el hábito después de disfrutar del primer premio.",group:"Fidelizar y reconocer"},
 {value:"inactivity",label:"Lleva días sin volver",detail:"Recupera clientes que ya compraron pero dejaron de venir.",group:"Recuperar clientes"}
];
async function call(url:string,init?:RequestInit){
 const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...init});
 const body=await response.json() as {error?:string;rules?:Rule[];id?:string};
 if(!response.ok||body.error)throw Error(body.error||"No se pudo completar la operación.");
 return body;
}
const numberOrNull=(value:string)=>value.trim()?Number(value):null;
function conditionLabel(rule:Pick<Rule,"trigger_kind"|"target_visits"|"target_stamps"|"inactivity_days"|"window_days"|"delay_days">){
 switch(rule.trigger_kind){
  case "signup":return "Al guardar la tarjeta"+(rule.delay_days?" · después de "+rule.delay_days+" días":" · en cuanto se registra");
  case "no_visit":return "Sin primera compra durante "+rule.inactivity_days+" días";
  case "visits":return "Al completar "+rule.target_visits+" "+(rule.target_visits===1?"visita":"visitas")+(rule.delay_days?" · esperar "+rule.delay_days+" días":"");
  case "stamps":return "Al conseguir "+rule.target_stamps+" sellos en los primeros "+rule.window_days+" días"+(rule.delay_days?" · esperar "+rule.delay_days+" días":"");
  case "inactivity":return "Tras "+rule.inactivity_days+" días sin volver después de una compra";
  case "first_redeem":return "Después del primer canje"+(rule.delay_days?" · esperar "+rule.delay_days+" días":"");
 }
}
export function BusinessAutomationPanel({businessId,programType}:{businessId:string;programType:string}){
 const [rules,setRules]=useState<Rule[]>([]),[mode,setMode]=useState<Mode>(null),[editing,setEditing]=useState<Rule|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [name,setName]=useState(""),[trigger,setTrigger]=useState<Trigger| "">("");
 const [delay,setDelay]=useState("0"),[threshold,setThreshold]=useState(""),[windowDays,setWindowDays]=useState("");
 const [visits,setVisits]=useState(""),[inactivityDays,setInactivityDays]=useState(""),[instruction,setInstruction]=useState("");
 const [title,setTitle]=useState(""),[preview,setPreview]=useState(""),[details,setDetails]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{const result=await call("/api/local/automations?business="+encodeURIComponent(businessId));setRules(result.rules||[]);setError("")}
  catch(e){setError((e as Error).message)}finally{setLoading(false)}
 },[businessId]);
 useEffect(()=>{setRules([]);setMode(null);void refresh()},[refresh]);
 const selectedTrigger=useMemo(()=>triggerItems.find(t=>t.value===trigger),[trigger]);
 function reset(){
  setMode(null);setEditing(null);setName("");setTrigger("");setDelay("0");
  setThreshold("");setWindowDays("");setVisits("");setInactivityDays("");setInstruction("");
  setTitle("");setPreview("");setDetails("");
 }
 function begin(){
  reset();setError("");setNotice("");setMode("new");
 }
 function edit(rule:Rule){
  reset();setError("");setNotice("");setEditing(rule);setMode("edit");
  setName(rule.name);setTrigger(rule.trigger_kind);setTitle(rule.title);
  setPreview(rule.preview);setDetails(rule.details);
 }
 async function save(e:React.FormEvent){
  e.preventDefault();setError("");setNotice("");
  if(mode==="new"&&!trigger){setError("Selecciona primero qué debe activar la campaña.");return}
  setBusy(true);
  try{
   if(mode==="edit"&&editing){
    await call("/api/local/automations",{method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({action:"edit",business_id:businessId,rule_id:editing.id,name,title,preview,details})});
    setNotice("Mensaje actualizado. El disparador y las condiciones siguen siendo los mismos.");
   }else{
    const response=await call("/api/local/automations",{method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({
      action:"create",business_id:businessId,name,trigger_kind:trigger,
      delay_days:trigger==="no_visit"||trigger==="inactivity"?0:Number(delay),
      target_stamps:trigger==="stamps"?numberOrNull(threshold):null,
      window_days:trigger==="stamps"?numberOrNull(windowDays):null,
      target_visits:trigger==="visits"?numberOrNull(visits):null,
      inactivity_days:trigger==="no_visit"||trigger==="inactivity"?numberOrNull(inactivityDays):null,
      staff_instruction:trigger==="stamps"?instruction:"",title,preview,details
     })});
    if(!response.id)throw Error("No se ha confirmado la creación de la campaña.");
    setNotice("Campaña automática creada. Se activará cuando se cumpla la regla con nuevos eventos.");
   }
   reset();await refresh();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function toggle(rule:Rule){
  setBusy(true);setError("");setNotice("");
  try{
   await call("/api/local/automations",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"toggle",business_id:businessId,rule_id:rule.id,active:!rule.active})});
   setNotice(rule.active?"Campaña pausada. No se entregarán avisos mientras esté detenida.":"Campaña reactivada.");
   await refresh();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="automation-page">
  <div className="automation-intro">
   <div><span className="page-eyebrow">CAMPAÑAS AUTOMÁTICAS</span>
    <h2>Automatizaciones</h2>
    <p>Crea tus propias reglas para captar visitas, fidelizar y recuperar clientes. Cada campaña se activa por hechos registrados en la tarjeta.</p></div>
   {!mode&&<button type="button" className="button button-dark" onClick={begin}><Plus size={17}/> Nueva campaña automática</button>}
  </div>
  {error&&<div className="alert error" role="alert">{error}</div>}
  {notice&&<div className="alert success" role="status"><Check size={17}/>{notice}</div>}
  {mode&&<form className="panel-card automation-editor" onSubmit={save}>
   <div className="content-heading"><div><span className="page-eyebrow">{mode==="edit"?"EDITAR CAMPAÑA":"NUEVA CAMPAÑA"}</span>
    <h3>{mode==="edit"?"Editar mensaje automático":"Define tu flujo"}</h3>
    <p>{mode==="edit"?"Puedes cambiar el mensaje. Para modificar cuándo se dispara, crea una regla nueva.":"Elige un disparador, sus condiciones y el aviso que recibirá el cliente."}</p></div>
    <button type="button" className="button button-outline button-sm" disabled={busy} onClick={reset}>Cancelar</button></div>
   <div className="automation-builder">
    <section className="automation-builder-step">
     <div className="automation-step-heading"><span className="automation-step-index">1</span><div><h4>¿Cuándo se activa?</h4><p>Elige una acción real del cliente o un tiempo sin actividad.</p></div><SlidersHorizontal size={20}/></div>
     {mode==="new"?<div className="form-stack">
      <label>Disparador<select required value={trigger} onChange={e=>{setTrigger(e.target.value as Trigger|"");setError("");}}>
       <option value="">Selecciona el disparador...</option>
       {["Activar clientes nuevos","Fidelizar y reconocer","Recuperar clientes"].map(group=><optgroup label={group} key={group}>
        {triggerItems.filter(item=>item.group===group&&(item.value!=="stamps"||programType==="stamps"))
         .map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
       </optgroup>)}
      </select></label>
      {selectedTrigger&&<p className="automation-trigger-description">{selectedTrigger.detail}</p>}
      {trigger==="visits"&&<label>Número de compras verificadas
       <input required type="number" min={1} max={500} step={1} value={visits} onChange={e=>setVisits(e.target.value)} placeholder="Indica cuántas visitas"/>
       <small>Una compra registrada en caja equivale a una visita, aunque se concedan varios sellos.</small></label>}
      {trigger==="stamps"&&<div className="automation-condition-grid">
       <label>Sellos acumulados<input required type="number" min={1} max={100} step={1} value={threshold}
        onChange={e=>setThreshold(e.target.value)} placeholder="Objetivo de sellos"/></label>
       <label>Dentro de los primeros días desde el alta<input required type="number" min={1} max={365} step={1}
        value={windowDays} onChange={e=>setWindowDays(e.target.value)} placeholder="Plazo en días"/></label>
       <small>Se tienen en cuenta los sellos ganados realmente y el plazo desde que el cliente se inscribió.</small>
      </div>}
      {(trigger==="no_visit"||trigger==="inactivity")&&<label>Días sin compras
       <input required type="number" min={1} max={365} step={1} value={inactivityDays}
        onChange={e=>setInactivityDays(e.target.value)} placeholder="Indica el número de días"/>
       <small>{trigger==="no_visit"?"Desde que guardó la tarjeta. Se cancela el aviso si hace una compra.":"Desde la última compra. Si vuelve antes, se reinicia el plazo. Máximo un aviso por cliente y campaña."}</small>
      </label>}
     </div>:<div className="automation-fixed-rule"><strong>{selectedTrigger?.label}</strong>
      <p>{editing&&conditionLabel(editing)}</p></div>}
    </section>
    {mode==="new"&&trigger!=="no_visit"&&trigger!=="inactivity"&&<section className="automation-builder-step">
     <div className="automation-step-heading"><span className="automation-step-index">2</span><div><h4>¿Cuánto debe esperar?</h4><p>El aviso se programa después del evento.</p></div><Clock3 size={20}/></div>
     <label>Días de espera<input type="number" required min={0} max={90} step={1} value={delay} onChange={e=>setDelay(e.target.value)}/></label>
     <small>0 días = al producirse el evento (según la frecuencia del procesador automático).</small>
    </section>}
    <section className="automation-builder-step">
     <div className="automation-step-heading"><span className="automation-step-index">{mode==="edit"?"2":trigger==="no_visit"||trigger==="inactivity"?"2":"3"}</span>
      <div><h4>¿Qué mensaje recibirá?</h4><p>El aviso aparecerá en «Avisos» dentro de KREYV si el cliente mantiene su consentimiento.</p></div><BellRing size={20}/></div>
     <div className="form-stack">
      <label>Nombre interno de la campaña<input required minLength={3} maxLength={70} value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre visible para tu equipo"/></label>
      <label>Título para el cliente<input required minLength={3} maxLength={50} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Título del aviso"/></label>
      <label>Resumen<input required minLength={3} maxLength={120} value={preview} onChange={e=>setPreview(e.target.value)} placeholder="Resumen breve"/></label>
      <label>Mensaje completo<textarea required minLength={3} maxLength={6000} rows={4} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Escribe el contenido de la campaña"/></label>
      {mode==="new"&&trigger==="stamps"&&<label>Instrucción especial para caja (opcional)
       <textarea maxLength={250} rows={3} value={instruction} onChange={e=>setInstruction(e.target.value)}
        placeholder="Describe qué obsequio debe entregar el empleado y cómo verificarlo"/>
       <small>El empleado verá la promoción al escanear y confirmará su entrega una sola vez. No se descuentan sellos.</small>
      </label>}
     </div>
    </section>
   </div>
   <div className="automation-builder-bottom">
    <p><Gift size={16}/> Este flujo no envía automáticamente SMS, WhatsApp, email ni push y no modifica el saldo de la tarjeta.</p>
    <button className="button button-dark" disabled={busy||mode==="new"&&!trigger}><Save size={17}/>{busy?"Guardando...":mode==="edit"?"Guardar mensaje":"Crear y activar campaña"}</button>
   </div>
  </form>}
  <section className="automation-list" aria-label="Campañas automáticas configuradas">
   <div className="content-heading"><div><h3>Campañas configuradas</h3>
    <p>Solo se muestran las reglas creadas por tu negocio, nunca campañas de ejemplo.</p></div>
    {!loading&&rules.length>0&&<span className="automation-total">{rules.length} {rules.length===1?"campaña":"campañas"}</span>}</div>
   {loading?<div className="soft-panel">Cargando campañas...</div>:
   rules.length===0?<div className="automation-blank-state"><BellRing size={29}/>
    <h3>Aún no tienes campañas automáticas</h3>
    <p>Cuando crees una, aparecerá aquí con su disparador, condiciones y estado.</p>
    {!mode&&<button type="button" onClick={begin} className="button button-outline"><Plus size={16}/> Crear mi primera campaña</button>}
   </div>:
   rules.map(rule=><article key={rule.id} className="automation-rule">
    <div className="automation-rule-icon">{rule.trigger_kind==="signup"||rule.trigger_kind==="no_visit"?<Users size={21}/>:
     rule.trigger_kind==="stamps"?<Ticket size={21}/>:rule.trigger_kind==="visits"?<ShoppingBag size={21}/>:
     rule.trigger_kind==="inactivity"?<CalendarClock size={21}/>:<Repeat size={21}/>}</div>
    <div className="automation-rule-info"><h4>{rule.name}</h4><p>{conditionLabel(rule)}</p>
     <small>Mensaje: {rule.title} · {rule.preview}</small>
     {rule.staff_instruction&&<small className="automation-rule-note">Nota para caja: {rule.staff_instruction}</small>}
    </div>
    <div className="automation-rule-actions">
     <button type="button" className="automation-edit-action" disabled={busy} onClick={()=>edit(rule)}
      aria-label={"Editar el mensaje de "+rule.name}><Pencil size={15}/> Editar</button>
     <button type="button" className={"automation-status"+(rule.active?" active":"")} disabled={busy}
      onClick={()=>void toggle(rule)} aria-label={(rule.active?"Pausar":"Activar")+" "+rule.name}>
      {rule.active?<PauseCircle size={16}/>:<PlayCircle size={16}/>}
      {rule.active?"Activa":"Pausada"}
     </button>
    </div>
   </article>)}
  </section>
 </section>;
}
