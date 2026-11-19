"use client";
import {useState,type FormEvent} from "react";
import {Check,Gift,Plus} from "lucide-react";
import {db} from "@/lib/supabase";
export type RewardOption={id:string;business_id:string;label:string;retail_cents:number;cost_cents:number;active:boolean;position:number};
export function RewardCatalog({businessId,options,onSaved}:{businessId:string;options:RewardOption[];onSaved:()=>Promise<void>}){
 const [label,setLabel]=useState(""),[retail,setRetail]=useState(""),[cost,setCost]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function create(e:FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");
  const r=await db().from("reward_options").insert({business_id:businessId,label:label.trim(),retail_cents:Math.round(Number(retail)*100),cost_cents:Math.round(Number(cost)*100),active:true,position:options.length});
  setBusy(false);if(r.error){setError(r.error.message);return}
  setLabel("");setRetail("");setCost("");setMessage("Nueva recompensa guardada.");await onSaved();
 }
 async function toggle(option:RewardOption){setBusy(true);setError("");setMessage("");
  const r=await db().from("reward_options").update({active:!option.active}).eq("id",option.id).eq("business_id",businessId);
  setBusy(false);if(r.error){setError(r.error.message);return}setMessage("Catálogo actualizado.");await onSaved();
 }
 return <section className="panel-card" style={{marginTop:22}}>
  <div className="panel-icon"><Gift size={21}/></div><h2>Recompensas que puede elegir el cliente</h2>
  <p className="muted">Define varias opciones (por ejemplo, cinco cafés). Al canjear, el empleado seleccionará cuál se entrega. El valor de venta calcula el ahorro del cliente y el coste real alimenta el dashboard privado.</p>
  {options.map(o=><div key={o.id} className="activity-row"><div className="activity-icon positive"><Gift size={17}/></div>
   <div><strong>{o.label}</strong><span>Precio habitual: {(Number(o.retail_cents)/100).toFixed(2)} MXN · Coste: {(Number(o.cost_cents)/100).toFixed(2)} MXN</span></div>
   <button type="button" disabled={busy} onClick={()=>toggle(o)} className={"table-pill "+(o.active?"":"inactive")}>{o.active?"Activo":"Inactivo"}</button></div>)}
  {!options.length&&<p className="muted">Aún no hay opciones. Puedes mantener el premio genérico, pero sin precio ni coste no podremos calcular su ahorro o inversión.</p>}
  <form className="form-stack" onSubmit={create} style={{marginTop:20}}>
   <div className="lp-reward-option-row">
    <label>Nombre del producto<input required maxLength={120} minLength={2} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Café latte"/></label>
    <label>Precio venta (MXN)<input required type="number" min={0} max={1000000} step=".01" value={retail} onChange={e=>setRetail(e.target.value)} placeholder="65.00"/></label>
    <label>Coste real (MXN)<input required type="number" min={0} max={1000000} step=".01" value={cost} onChange={e=>setCost(e.target.value)} placeholder="18.00"/></label>
    <button disabled={busy} className="button button-dark button-sm"><Plus size={17}/> Añadir</button>
   </div>
  </form>
  {error&&<div className="alert error">{error}</div>}{message&&<div className="alert success"><Check size={16}/>{message}</div>}
  <p className="tiny-note">Los importes se guardan al canjear para preservar los informes históricos aunque cambie el catálogo.</p>
 </section>
}
