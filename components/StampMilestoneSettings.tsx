"use client";
import {useCallback,useEffect,useState} from "react";
import {Gift} from "lucide-react";
import {db} from "@/lib/supabase";
import type {RewardOption} from "@/components/RewardCatalog";
type Row={id:string;position:number;cycle_size:number;label:string;active:boolean};
export function StampMilestoneSettings({businessId,total,options}:{businessId:string;total:number;options:RewardOption[]}){
 const [rows,setRows]=useState<Row[]>([]),[position,setPosition]=useState(""),[reward,setReward]=useState(""),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const reload=useCallback(async()=>{const r=await db().rpc("manager_stamp_milestones",{p_business:businessId});if(r.error)setMessage(r.error.message);else{setRows(r.data||[]);setEnabled((r.data||[]).some((x:Row)=>x.active))}},[businessId]);
 useEffect(()=>{void reload()},[reload]);
 async function add(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");const r=await db().rpc("manager_add_stamp_milestone",{p_business:businessId,p_position:Number(position),p_reward:reward});setBusy(false);if(r.error)setMessage(r.error.message);else{setPosition("");setReward("");await reload()}}
 async function disable(id:string){if(!confirm("¿Desactivar este premio para futuros ciclos? Los premios ya desbloqueados se conservan."))return;setBusy(true);const r=await db().rpc("manager_disable_stamp_milestone",{p_rule:id});setBusy(false);if(r.error)setMessage(r.error.message);else await reload()}
 return <section className="panel-card" style={{marginTop:22}}><h2><Gift size={20}/> Premios intermedios</h2><p className="muted">Opcionales. Se desbloquean al llegar a una posición de la tarjeta, se repiten en cada ciclo y no descuentan sellos. Solo cuentan los umbrales alcanzados después de configurarlos.</p>
 <div className="form-stack">{rows.filter(r=>r.active).map(r=><div key={r.id} className="activity-row"><div><strong>Sello {r.position} · {r.label}</strong><small>Cada {r.cycle_size} sellos</small></div><button disabled={busy} className="button button-outline" onClick={()=>void disable(r.id)}>Desactivar</button></div>)}
 {!enabled?<button type="button" className="button button-outline" disabled={total<2||total>30} onClick={()=>setEnabled(true)}>Configurar premios intermedios</button>:<form className="form-stack" onSubmit={add}>
 <label>Posición del premio<select required value={position} onChange={e=>setPosition(e.target.value)}><option value="">Selecciona sello</option>{Array.from({length:Math.max(0,Math.min(29,total-1))},(_,i)=>i+1).filter(i=>!rows.some(r=>r.active&&r.position===i)).map(i=><option key={i} value={i}>Sello {i}</option>)}</select></label>
 <label>Regalo del catálogo<select required value={reward} onChange={e=>setReward(e.target.value)}><option value="">Selecciona regalo</option>{options.filter(o=>o.active).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
 {!options.some(o=>o.active)&&<p>Crea primero un regalo en el catálogo.</p>}
 <button className="button button-dark" disabled={busy||!position||!reward}>Añadir premio intermedio</button></form>}
 {total>30&&<p>Disponible en tarjetas de hasta 30 sellos.</p>}{message&&<p role="alert">{message}</p>}</div></section>
}
