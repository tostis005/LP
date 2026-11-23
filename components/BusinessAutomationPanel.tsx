"use client";
import {useCallback,useEffect,useState} from "react";
import {ArrowRight,BellRing,Check,Clock3,Gift,Plus,Save,SlidersHorizontal,Ticket,Users} from "lucide-react";
type Trigger="signup"|"stamps";
type Rule={id:string;name:string;trigger_kind:Trigger;delay_days:number;target_stamps:number|null;window_days:number|null;
 staff_instruction:string;active:boolean;created_at:string;title:string;preview:string;details:string};
async function call(url:string,init?:RequestInit){
 const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...init});
 const body=await response.json() as {error?:string;rules?:Rule[];id?:string};
 if(!response.ok||body.error)throw Error(body.error||"No se pudo completar la operación.");
 return body;
}
export function BusinessAutomationPanel({businessId,programType}:{businessId:string;programType:string}){
 const [rules,setRules]=useState<Rule[]>([]);
 const [showEditor,setShowEditor]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [name,setName]=useState(""),[trigger,setTrigger]=useState<Trigger>("signup"),[delay,setDelay]=useState(2);
 const [threshold,setThreshold]=useState(5),[windowDays,setWindowDays]=useState(30),[instruction,setInstruction]=useState("");
 const [title,setTitle]=useState(""),[preview,setPreview]=useState(""),[details,setDetails]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{const result=await call("/api/local/automations?business="+encodeURIComponent(businessId));setRules(result.rules||[]);setError("")}
  catch(e){setError((e as Error).message)}finally{setLoading(false)}
 },[businessId]);
 useEffect(()=>{void refresh()},[refresh]);
 function preset(kind:"welcome"|"milestone"){
  setError("");setNotice("");setShowEditor(true);
  if(kind==="welcome"){
   setName("Bienvenida después del alta");setTrigger("signup");setDelay(2);setThreshold(5);setWindowDays(30);setInstruction("");
   setTitle("¡Te estamos esperando!");setPreview("Ya tienes tu tarjeta. Ven a sumar tus primeros sellos.");
   setDetails("Gracias por unirte a nuestro programa. Presenta tu tarjeta en tu próxima visita para empezar a conseguir recompensas.");
  }else{
   setName("Regalo por cinco sellos");setTrigger("stamps");setDelay(0);setThreshold(5);setWindowDays(30);
   setInstruction("Si llega a 5 sellos dentro de los primeros 30 días, entregar un croissant de cortesía al verificar la compra.");
   setTitle("¡Has conseguido 5 sellos!");setPreview("Pregunta en caja por tu regalo especial.");
   setDetails("Al conseguir 5 sellos en los primeros 30 días desde tu inscripción, puedes pedir tu detalle especial en el establecimiento.");
  }
 }
 function clear(){
  setShowEditor(false);setName("");setTitle("");setPreview("");setDetails("");setInstruction("");setTrigger("signup");setDelay(2);
 }
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   await call("/api/local/automations",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"create",business_id:businessId,name,trigger_kind:trigger,delay_days:delay,
     target_stamps:trigger==="stamps"?threshold:null,window_days:trigger==="stamps"?windowDays:null,
     staff_instruction:trigger==="stamps"?instruction:"",title,preview,details})
   });
   clear();setNotice("Automatización activada. Se aplicará a las próximas altas o hitos, según tu regla.");
   await refresh();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function toggle(rule:Rule){
  setBusy(true);setError("");setNotice("");
  try{
   await call("/api/local/automations",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"toggle",business_id:businessId,rule_id:rule.id,active:!rule.active})});
   setNotice(rule.active?"Automatización pausada.":"Automatización reactivada.");
   await refresh();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="automation-page">
  <div className="automation-intro">
   <div><span className="page-eyebrow">SECUENCIAS AUTOMÁTICAS</span><h2>Mensajes en el momento adecuado</h2>
    <p>Define qué sucede cuando alguien se une o alcanza un objetivo. KREYV programa el aviso sin modificar los sellos de la tarjeta.</p></div>
   {!showEditor&&<button type="button" className="button button-dark" onClick={()=>preset("welcome")}><Plus size={17}/> Crear automatización</button>}
  </div>
  {error&&<div className="alert error" role="alert">{error}</div>}
  {notice&&<div className="alert success"><Check size={17}/>{notice}</div>}
  {!showEditor&&<div className="automation-presets">
   <button type="button" onClick={()=>preset("welcome")}><Users size={21}/><strong>Después del alta</strong><span>Dar la bienvenida tras 2 días</span><ArrowRight size={17}/></button>
   {programType==="stamps"&&<button type="button" onClick={()=>preset("milestone")}><Ticket size={21}/><strong>Al llegar a los sellos</strong><span>Un premio al alcanzar 5 en 30 días</span><ArrowRight size={17}/></button>}
  </div>}
  {showEditor&&<form className="panel-card automation-editor" onSubmit={save}>
   <div className="content-heading"><div><h3>Nueva automatización</h3><p>Define el momento y el mensaje.</p></div>
    <button type="button" className="button button-outline button-sm" onClick={clear}>Cancelar</button></div>
   <div className="form-stack">
    <label>Nombre interno de la regla<input required minLength={3} maxLength={70} value={name} onChange={e=>setName(e.target.value)}/></label>
    <div className="automation-flow">
     <div className="automation-flow-step"><span><SlidersHorizontal size={17}/> 1. Cuando sucede</span>
      <label>Activador<select value={trigger} onChange={e=>setTrigger(e.target.value as Trigger)}>
       <option value="signup">Una persona guarda la tarjeta</option>
       {programType==="stamps"&&<option value="stamps">Alcanza un número de sellos</option>}
      </select></label>
      {trigger==="stamps"&&<div className="form-two">
       <label>Sellos acumulados<input type="number" min={1} max={100} required value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/></label>
       <label>Dentro de los primeros días<input type="number" min={1} max={365} required value={windowDays} onChange={e=>setWindowDays(Number(e.target.value))}/></label>
      </div>}
     </div>
     <ArrowRight className="automation-flow-arrow" size={19}/>
     <div className="automation-flow-step"><span><Clock3 size={17}/> 2. Esperar</span>
      <label>Días desde el evento<input type="number" min={0} max={90} required value={delay} onChange={e=>setDelay(Number(e.target.value))}/></label>
      <small>0 = al producirse el evento. Un proceso automático comprueba los avisos pendientes.</small>
     </div>
     <ArrowRight className="automation-flow-arrow" size={19}/>
     <div className="automation-flow-step"><span><BellRing size={17}/> 3. Avisar</span>
      <p>El cliente verá el aviso en «Avisos», si ha aceptado comunicaciones.</p>
      <small>Este flujo no envía automáticamente SMS, WhatsApp, email ni push.</small>
     </div>
    </div>
    <label>Título del aviso<input required minLength={3} maxLength={50} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Resumen<input required minLength={3} maxLength={120} value={preview} onChange={e=>setPreview(e.target.value)}/></label>
    <label>Mensaje completo<textarea required minLength={3} maxLength={6000} rows={4} value={details} onChange={e=>setDetails(e.target.value)}/></label>
    {trigger==="stamps"&&<label>Instrucción para el empleado (opcional)
     <textarea maxLength={250} rows={3} value={instruction} onChange={e=>setInstruction(e.target.value)}
      placeholder="Ej.: al quinto sello dentro de 30 días, entregar un croissant."/>
     <small>Se muestra al escanear la tarjeta. El empleado confirma y entrega el obsequio; KREYV no altera automáticamente el saldo.</small></label>}
    <button className="button button-dark" disabled={busy}><Save size={17}/>{busy?"Guardando...":"Activar automatización"}</button>
   </div>
  </form>}
  <section className="automation-list" aria-label="Automatizaciones configuradas">
   <div className="content-heading"><div><h3>Tus automatizaciones</h3><p>Reglas nuevas para próximas altas y objetivos, no retroactivas.</p></div></div>
   {loading?<div className="soft-panel">Cargando automatizaciones...</div>:
   rules.length===0?<div className="empty-state compact"><Gift size={25}/><h3>Aún no hay automatizaciones</h3><p>Crea una regla de bienvenida o un objetivo de sellos.</p></div>:
   rules.map(rule=><article key={rule.id} className="automation-rule">
    <div className="automation-rule-icon">{rule.trigger_kind==="signup"?<Users size={21}/>:<Ticket size={21}/>}</div>
    <div className="automation-rule-info"><h4>{rule.name}</h4>
     <p>{rule.trigger_kind==="signup"?"Nueva tarjeta":"Al llegar a "+rule.target_stamps+" sellos en "+rule.window_days+" días"}
      {" · "+(rule.delay_days?"Esperar "+rule.delay_days+" días":"Al instante")}</p>
     <small>{rule.title} · {rule.preview}</small>
     {rule.staff_instruction&&<small className="automation-rule-note">Caja: {rule.staff_instruction}</small>}
    </div>
    <button type="button" className={"automation-status"+(rule.active?" active":"")} disabled={busy}
     onClick={()=>void toggle(rule)} aria-label={(rule.active?"Pausar":"Activar")+" "+rule.name}>
     {rule.active?"Activa":"Pausada"}
    </button>
   </article>)}
  </section>
 </section>;
}
