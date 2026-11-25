"use client";
import {useState,type FormEvent} from "react";
import {Check,Gift,Plus,Pencil,X} from "lucide-react";
import {db} from "@/lib/supabase";
export type RewardOption={id:string;business_id:string;label:string;retail_cents:number|null;cost_cents:number|null;active:boolean;position:number};
export function RewardCatalog({businessId,options,onSaved,currency}:{currency:string;businessId:string;options:RewardOption[];onSaved:()=>Promise<void>}){
 const [view,setView]=useState<"list"|"create"|"edit">("list"),[editing,setEditing]=useState<string|null>(null),[label,setLabel]=useState(""),[cost,setCost]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 function beginCreate(){setEditing(null);setLabel("");setCost("");setView("create");setError("");setMessage("")}
 function beginEdit(option:RewardOption){setEditing(option.id);setLabel(option.label);setCost(option.cost_cents==null?"":String(option.cost_cents/100));setView("edit");setError("");setMessage("")}
 function cancel(){setView("list");setEditing(null);setError("")}
 async function save(e:FormEvent){
  e.preventDefault();const name=label.trim();
  if(name.length<2||name.length>120){setError("Escribe un nombre entre 2 y 120 caracteres.");return}
  const costCents=cost.trim()===""?null:Math.round(Number(cost)*100);
  if(costCents!==null&&(!Number.isFinite(costCents)||costCents<0||costCents>100000000)){setError("Coste inválido.");return}
  setBusy(true);setError("");setMessage("");
  const query=view==="edit"&&editing?
   db().from("reward_options").update({label:name,cost_cents:costCents}).eq("id",editing).eq("business_id",businessId):
   db().from("reward_options").insert({business_id:businessId,label:name,retail_cents:null,cost_cents:costCents,active:true,position:options.length});
  const result=await query;
  setBusy(false);if(result.error){setError(result.error.message);return}
  setView("list");setEditing(null);setLabel("");setMessage("Recompensa guardada.");await onSaved();
 }
 async function toggle(option:RewardOption){
  setBusy(true);setError("");setMessage("");
  const result=await db().from("reward_options").update({active:!option.active}).eq("id",option.id).eq("business_id",businessId);
  setBusy(false);if(result.error){setError(result.error.message);return}
  setMessage("Recompensas actualizadas.");await onSaved();
 }
 return <section className="panel-card lp-rewards" style={{marginTop:22}}>
  {view==="list"?<>
   <div className="content-heading lp-rewards-heading"><div><h2><Gift size={20}/> Catálogo de regalos</h2><p className="muted">Crea regalos y descuentos para que el empleado elija al canjear.</p></div>
    <button type="button" className="button button-dark button-sm" onClick={beginCreate}><Plus size={17}/> Añadir regalo</button></div>
   {options.length?options.map(option=><div key={option.id} className="activity-row lp-reward-row">
    <div className="activity-icon positive"><Gift size={17}/></div>
    <div><strong>{option.label}</strong><small>{option.cost_cents==null?"Coste sin registrar":new Intl.NumberFormat("es-MX",{style:"currency",currency}).format(option.cost_cents/100)+" de coste"}</small></div>
    <button type="button" className="inline-table-button" disabled={busy} onClick={()=>beginEdit(option)} aria-label={"Editar "+option.label}><Pencil size={15}/> Editar</button>
    <button type="button" className={"table-pill "+(option.active?"":"inactive")} disabled={busy} onClick={()=>void toggle(option)} aria-label={(option.active?"Desactivar ":"Activar ")+option.label}>{option.active?"Activo":"Inactivo"}</button>
   </div>):<div className="campaign-empty-state"><Gift size={25}/><h3>Todavía no hay regalos</h3><p>Añade un café, una hamburguesa o un descuento.</p><button type="button" className="button button-outline" onClick={beginCreate}><Plus size={17}/> Crear regalo</button></div>}
  </>:<>
   <div className="content-heading lp-rewards-heading"><div><h2>{view==="edit"?"Editar regalo":"Nuevo regalo"}</h2><p className="muted">Registra el coste real si quieres medir la inversión en regalos.</p></div><button type="button" className="button button-outline button-sm" onClick={cancel}><X size={17}/> Cancelar</button></div>
   <form className="form-stack lp-reward-form" onSubmit={save}>
    <label>Nombre del regalo o descuento<input autoFocus required minLength={2} maxLength={120} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Ej. Café gratis, 15% de descuento, 10 € de descuento"/></label>
    <label>Coste interno ({currency}, opcional)<input type="number" min="0" max="1000000" step=".01" value={cost} onChange={e=>setCost(e.target.value)} placeholder="Sin coste registrado"/><small>Se conservará el coste vigente en cada canje. Vacío significa desconocido, no cero.</small></label>
    <button className="button button-dark" type="submit" disabled={busy}>{busy?"Guardando...":"Guardar regalo"} <Check size={17}/></button>
   </form>
  </>}
  {error&&<div className="alert error" role="alert">{error}</div>}
  {message&&view==="list"&&<div className="alert success"><Check size={16}/>{message}</div>}
 </section>;
}
