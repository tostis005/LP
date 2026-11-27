"use client";
import {useCallback,useEffect,useState} from "react";
import {Gift} from "lucide-react";
import {availableMilestonePositions} from "@/lib/milestones";
import {StampGrid} from "@/components/StampMarks";
import {db} from "@/lib/supabase";
import {RewardCatalog,type RewardOption} from "@/components/RewardCatalog";
type Row={id:string;position:number;cycle_size:number;label:string;active:boolean};
export function StampMilestoneSettings({businessId,total,currency}:{businessId:string;total:number;currency:string}){
 const [options,setOptions]=useState<RewardOption[]>([]);
 const [rows,setRows]=useState<Row[]>([]),[position,setPosition]=useState(""),[reward,setReward]=useState(""),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const reload=useCallback(async()=>{const [r,catalog]=await Promise.all([db().rpc("manager_stamp_milestones",{p_business:businessId}),db().from("milestone_reward_options").select("*").eq("business_id",businessId).order("position",{ascending:true})]);if(catalog.error)setMessage(catalog.error.message);else setOptions(catalog.data||[]);if(r.error)setMessage(r.error.message);else{setRows(r.data||[]);setEnabled((r.data||[]).some((x:Row)=>x.active))}},[businessId]);
 useEffect(()=>{void reload()},[reload]);
 const freePositions=availableMilestonePositions(total,rows);
 const activeRules=rows.filter(r=>r.active).map(r=>({position:r.position,label:r.label}));
 async function add(e:React.FormEvent){e.preventDefault();if(!freePositions.includes(Number(position))){setMessage("Ese sello ya tiene un premio o no está disponible. Elige otro.");return;}setBusy(true);setMessage("");const r=await db().rpc("manager_add_stamp_milestone",{p_business:businessId,p_position:Number(position),p_reward:reward});setBusy(false);if(r.error){setMessage(r.error.message);await reload();}else{setPosition("");setReward("");await reload()}}
 async function disable(id:string){if(!confirm("¿Desactivar este premio para futuros ciclos? Los premios ya desbloqueados se conservan."))return;setBusy(true);const r=await db().rpc("manager_disable_stamp_milestone",{p_rule:id});setBusy(false);if(r.error)setMessage(r.error.message);else await reload()}
 return <><RewardCatalog businessId={businessId} options={options} currency={currency} intermediate onSaved={reload}/><section className="panel-card" style={{marginTop:22}}><h2><Gift size={20}/> Asignar regalos a los sellos</h2><p className="muted">Opcionales. Se desbloquean al llegar a una posición de la tarjeta, se repiten en cada ciclo y no descuentan sellos. Solo cuentan los umbrales alcanzados después de configurarlos. Solo puede haber un premio activo por sello; el último se reserva al premio final.</p>
 {total>=2&&total<=30&&<div className="milestone-settings-preview"><StampGrid total={total} earned={0} milestones={activeRules}/><small>Así se indican los regalos intermedios en la tarjeta.</small></div>}
 <div className="form-stack">{rows.filter(r=>r.active).map(r=><div key={r.id} className="activity-row"><div><strong>Sello {r.position} · {r.label}</strong><small>Cada {r.cycle_size} sellos</small></div><button disabled={busy} className="button button-outline" onClick={()=>void disable(r.id)}>Desactivar</button></div>)}
 {!enabled?<button type="button" className="button button-outline" disabled={total<2||total>30} onClick={()=>setEnabled(true)}>Configurar premios intermedios</button>:<form className="form-stack" onSubmit={add}>
 <label>Posición del premio<select required value={position} onChange={e=>setPosition(e.target.value)}><option value="">Selecciona sello</option>{freePositions.map(i=><option key={i} value={i}>Sello {i}</option>)}</select></label>
 <label>Regalo intermedio<select required value={reward} onChange={e=>setReward(e.target.value)}><option value="">Selecciona regalo</option>{options.filter(o=>o.active).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
 {!options.some(o=>o.active)&&<p>Crea primero un regalo activo en el catálogo de regalos intermedios.</p>}
 <button className="button button-dark" disabled={busy||!freePositions.includes(Number(position))||!reward}>Añadir premio intermedio</button></form>}
 {enabled&&!freePositions.length&&total>=2&&total<=30&&<p>Todos los sellos intermedios tienen un premio asignado.</p>}{total>30&&<p>Disponible en tarjetas de hasta 30 sellos.</p>}{message&&<p role="alert">{message}</p>}</div></section></>
}
