"use client";
import {useEffect,useMemo,useState} from "react";
import {BarChart3,Download,Search,Users} from "lucide-react";
import {db} from "@/lib/supabase";
import {units,dateShort,customerDisplayName} from "@/lib/format";
import type {ProgramType} from "@/lib/types";
export type EmployeeActivity={user_id:string;employee_name:string;operations:number;awarded_units:number;redemptions:number;sales_cents:number;priced_operations:number};
type Staff={user_id:string;full_name:string;email:string;active:boolean};
type Customer={user_id:string;full_name:string;email:string;balance:number;total_earned:number;visits:number;marketing_ok:boolean;joined_at:string};
type CustomerActivity={user_id:string;last_visit:string|null;period_visits:number};
type Tx={id:string;kind:"earn"|"redeem"|"reversal";amount_delta:number;purchase_cents:number|null;ticket_ref:string|null;created_at:string;employee_id:string|null;employee_name:string|null;customer_name:string|null;reversal_of:string|null;reversal_reason:string|null;reversed:boolean;reward_label:string|null;total_count:number};
const count=(v:number)=>Number(v||0).toLocaleString("es-MX");
const localDate=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
function previousDate(days:number){const d=new Date();d.setDate(d.getDate()-days+1);return localDate(d)}
function endExclusive(date:string){if(!date)return null;const d=new Date(date+"T00:00:00");d.setDate(d.getDate()+1);return d.toISOString()}
function beginning(date:string){return date?new Date(date+"T00:00:00").toISOString():null}
const shortDate=(value:string)=>new Date(value).toLocaleDateString("es-MX",{day:"2-digit",month:"short"});
const fullDate=(value:string)=>new Date(value).toLocaleString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
const money=(value:number,currency:string)=>new Intl.NumberFormat("es-MX",{style:"currency",currency}).format(value/100);
export function EmployeeChart({rows,days,programType,currency}:{rows:EmployeeActivity[];days:number;programType?:ProgramType;currency:string}){
 const [metric,setMetric]=useState<"awarded_units"|"operations"|"redemptions"|"sales_cents">("awarded_units");
 const unit=programType==="stamps"?"Sellos":programType==="points"?"Puntos":"Saldo";
 const labels={awarded_units:unit,operations:"Compras",redemptions:"Canjes",sales_cents:"Importe"};
 const format=(value:number)=>metric==="awarded_units"?units(value,programType,currency):metric==="sales_cents"?money(value,currency):count(value);
 const sorted=[...rows].sort((a,b)=>Number(b[metric])-Number(a[metric]));
 const max=Math.max(1,...sorted.map(r=>Number(r[metric]||0)));
 const total=sorted.reduce((n,r)=>n+Number(r[metric]||0),0);
 return <section className="panel-card owner-employee-chart"><div className="content-heading"><div><h3><BarChart3 size={18}/> Actividad por empleado</h3><p className="muted">Últimos {days} días</p></div><strong>{format(total)}</strong></div>
  <div className="owner-metric-switch" role="group" aria-label="Indicador de empleados">{(Object.keys(labels) as (keyof typeof labels)[]).map(k=><button key={k} type="button" className={metric===k?"active":""} aria-pressed={metric===k} onClick={()=>setMetric(k)}>{labels[k]}</button>)}</div>
  {sorted.length?<div className="owner-employee-bars">{sorted.map(r=><div key={r.user_id} className="owner-employee-bar"><span>{r.employee_name}</span><div className="owner-horizontal-track" role="img" aria-label={r.employee_name+": "+format(Number(r[metric]||0))}><span style={{width:(Number(r[metric]||0)/max*100)+"%"}}/></div><strong>{format(Number(r[metric]||0))}</strong></div>)}</div>:<p className="muted">Todavía no hay actividad registrada.</p>}
  {metric==="sales_cents"&&<p className="muted">Importe de compras registradas con precio. No equivale a toda la facturación del negocio.</p>}
 </section>;
}
function csvCell(v:unknown){let s=String(v??"");if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
function downloadCsv(rows:Tx[],currency:string){
 const header=["Fecha","Cliente","Empleado","Operación","Unidades","Ticket","Compra","Recompensa","Estado","Motivo"];
 const data=rows.map(t=>[fullDate(t.created_at),customerDisplayName(t.customer_name),t.employee_name,txLabel(t),t.amount_delta,t.ticket_ref,t.purchase_cents==null?"":money(t.purchase_cents,currency),t.reward_label,t.reversed?"Revertida":"Registrada",t.reversal_reason]);
 const csv="\uFEFF"+[header,...data].map(r=>r.map(csvCell).join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));const a=document.createElement("a");a.href=url;a.download="transacciones-"+localDate(new Date())+".csv";a.click();URL.revokeObjectURL(url);
}
const txLabel=(t:Tx)=>t.kind==="earn"?"Compra":t.kind==="redeem"?"Canje":"Corrección";
export function TransactionsPanel({businessId,staff,formatBalance,currency}:{businessId:string;staff:Staff[];formatBalance:(v:number)=>string;currency:string}){
 const [from,setFrom]=useState(previousDate(30)),[to,setTo]=useState(localDate(new Date())),[employee,setEmployee]=useState(""),[kind,setKind]=useState(""),[search,setSearch]=useState(""),[query,setQuery]=useState("");
 const [page,setPage]=useState(0),[rows,setRows]=useState<Tx[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState<string|null>(null);
 const pageSize=50;
 const args=useMemo(()=>({p_business:businessId,p_from:beginning(from),p_to:endExclusive(to),p_employee:employee||null,p_kind:kind||null,p_search:query.trim()||null}),[businessId,from,to,employee,kind,query]);
 useEffect(()=>{const timer=window.setTimeout(()=>{setPage(0);setQuery(search)},250);return()=>window.clearTimeout(timer)},[search]);
 useEffect(()=>{let live=true;setLoading(true);setError("");setExpanded(null);
  if(from&&to&&from>to){setRows([]);setTotal(0);setError("La fecha inicial debe ser anterior a la final.");setLoading(false);return}
  db().rpc("business_owner_transactions",{...args,p_limit:pageSize,p_offset:page*pageSize}).then(result=>{
   if(!live)return;
   if(result.error){setError(result.error.message);setRows([]);setTotal(0)}
   else{const next=(result.data||[]) as Tx[];setRows(next);if(next.length)setTotal(Number(next[0].total_count));else if(page===0)setTotal(0);else setPage(p=>Math.max(0,p-1))}
   setLoading(false);
  });return()=>{live=false}
 },[args,page,revision,from,to]);
 async function reverse(t:Tx){
  if(t.reversed||t.kind==="reversal"||busy||Date.parse(t.created_at)<Date.now()-72*3600000)return;
  const reason=window.prompt("Motivo de la corrección (8-300 caracteres). El movimiento original seguirá visible.");
  if(reason===null)return;
  if(reason.trim().length<8||reason.trim().length>300){setError("Indica un motivo de 8 a 300 caracteres.");return}
  setBusy(true);setError("");const result=await db().rpc("manager_reverse_transaction",{p_transaction:t.id,p_reason:reason.trim()});setBusy(false);
  if(result.error){setError(result.error.message);return}setRevision(n=>n+1);
 }
 async function exportAll(){
  if(!total||busy||loading)return;setBusy(true);setError("");
  try{const all:Tx[]=[];for(let offset=0;offset<Math.min(total,20000);offset+=250){const result=await db().rpc("business_owner_transactions",{...args,p_limit:250,p_offset:offset});if(result.error)throw result.error;const batch=(result.data||[]) as Tx[];all.push(...batch);if(batch.length<250)break}
   downloadCsv(all,currency);if(total>20000)setError("Se exportaron las primeras 20.000 operaciones. Acota las fechas para descargar el resto.");
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="panel-card owner-transactions"><div className="content-heading"><div><h2>Transacciones</h2><p className="muted">Historial y correcciones</p></div><button type="button" className="button button-outline button-sm" disabled={!total||busy||loading} onClick={()=>void exportAll()}><Download size={16}/> CSV</button></div>
  <div className="owner-data-filters owner-transaction-filters">
   <label>Desde<input type="date" value={from} onChange={e=>{setPage(0);setFrom(e.target.value)}}/></label>
   <label>Hasta<input type="date" value={to} onChange={e=>{setPage(0);setTo(e.target.value)}}/></label>
   <label>Empleado<select value={employee} onChange={e=>{setPage(0);setEmployee(e.target.value)}}><option value="">Todos</option>{staff.map(s=><option key={s.user_id} value={s.user_id}>{s.full_name||s.email}{s.active?"":" (inactivo)"}</option>)}</select></label>
   <label>Operación<select value={kind} onChange={e=>{setPage(0);setKind(e.target.value)}}><option value="">Todas</option><option value="earn">Compras</option><option value="redeem">Canjes</option><option value="reversal">Correcciones</option></select></label>
   <label className="owner-filter-search"><span><Search size={15}/> Cliente o ticket</span><input value={search} maxLength={120} placeholder="Ej. Carlos G. o ticket" onChange={e=>setSearch(e.target.value)}/></label>
  </div>
  {error&&<div className="alert error" role="alert">{error}</div>}
  <p className="muted" role="status">{loading?"Buscando movimientos...":count(total)+" operaciones encontradas"}</p>
  {!loading&&rows.length>0&&<div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Empleado</th><th>Operación</th><th>Unidades</th><th>Compra</th><th>Detalle</th></tr></thead><tbody>
   {rows.map(t=><TransactionRows key={t.id} t={t} expanded={expanded===t.id} toggle={()=>setExpanded(expanded===t.id?null:t.id)} formatBalance={formatBalance} currency={currency} busy={busy} reverse={()=>void reverse(t)}/>)}
  </tbody></table></div>}
  {!loading&&!rows.length&&!error&&<p className="muted">No hay movimientos que coincidan con los filtros.</p>}
  <div className="owner-data-pagination"><button type="button" className="button button-outline button-sm" disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} de {Math.max(1,Math.ceil(total/pageSize))}</span><button type="button" className="button button-outline button-sm" disabled={loading||(page+1)*pageSize>=total} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div>
  <p className="muted">Las operaciones de las últimas 72 horas pueden revertirse si el saldo lo permite. Los registros originales se conservan.</p>
 </section>;
}
function TransactionRows({t,expanded,toggle,formatBalance,currency,busy,reverse}:{t:Tx;expanded:boolean;toggle:()=>void;formatBalance:(v:number)=>string;currency:string;busy:boolean;reverse:()=>void}){
 return <><tr><td>{fullDate(t.created_at)}</td><td>{customerDisplayName(t.customer_name)}</td><td>{t.employee_name||"—"}</td><td>{txLabel(t)}{t.reversed?" · Revertida":""}</td><td><b>{t.amount_delta>0?"+":""}{formatBalance(t.amount_delta)}</b></td><td>{t.purchase_cents==null?"—":money(t.purchase_cents,currency)}</td><td><button type="button" className="inline-table-button" aria-expanded={expanded} onClick={toggle}>{expanded?"Cerrar":"Ver detalle"}</button></td></tr>
 {expanded&&<tr><td colSpan={7}><div className="owner-tx-detail">{(t.kind==="earn"||t.ticket_ref)&&<span><small>Ticket</small><strong>{t.ticket_ref||"No registrado"}</strong></span>}
 {t.kind==="redeem"&&<span><small>Recompensa</small><strong>{t.reward_label||"No especificada"}</strong></span>}
 {t.kind==="reversal"&&<span><small>Motivo de la corrección</small><strong>{t.reversal_reason||"No registrado"}</strong></span>}
 {t.reversed&&<span><small>Estado</small><strong>Movimiento revertido</strong></span>}
 {t.kind!=="reversal"&&!t.reversed&&Date.parse(t.created_at)<Date.now()-72*3600000&&<span><small>Corrección</small><strong>Plazo de 72 horas vencido</strong></span>}
 {t.kind!=="reversal"&&!t.reversed&&<button type="button" className="button button-outline button-sm" disabled={busy||Date.parse(t.created_at)<Date.now()-72*3600000} onClick={reverse}>Revertir movimiento</button>}</div></td></tr>}</>;
}
export function CustomerPanel({businessId,customers,formatBalance,privateEmail,demoStatus}:{businessId:string;customers:Customer[];formatBalance:(n:number)=>string;privateEmail:(s:string)=>string;demoStatus:(c:Customer)=>boolean|null}){
 const [days,setDays]=useState(180),[mode,setMode]=useState<"new"|"total">("total"),[activity,setActivity]=useState<CustomerActivity[]>([]),[activityError,setActivityError]=useState(""),[activityReady,setActivityReady]=useState(false);
 const [from,setFrom]=useState(""),[to,setTo]=useState(""),[visit,setVisit]=useState(""),[marketing,setMarketing]=useState(""),[page,setPage]=useState(0),[selectedBar,setSelectedBar]=useState<number|null>(null);
 useEffect(()=>{let live=true;setActivityReady(false);db().rpc("business_owner_customer_activity",{p_business:businessId}).then(r=>{if(!live)return;if(r.error)setActivityError(r.error.message);else{setActivity((r.data||[]) as CustomerActivity[]);setActivityError("");setActivityReady(true)}});return()=>{live=false}},[businessId]);
 const visits=useMemo(()=>new Map(activity.map(a=>[a.user_id,a])),[activity]);
 const recentCutoff=new Date();recentCutoff.setDate(recentCutoff.getDate()-30);
 const now=Date.now();
 const inactive=activityReady?customers.filter(c=>{const last=visits.get(c.user_id)?.last_visit;return last?Date.parse(last)<recentCutoff.getTime():Date.parse(c.joined_at)<recentCutoff.getTime()}).length:0;
 const repeat=customers.filter(c=>Number(c.visits)>=2).length;
 const newMonth=customers.filter(c=>Date.parse(c.joined_at)>=new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime()).length;
 const chart=useMemo(()=>{
  const start=new Date(previousDate(days)+"T00:00:00");const step=days===7?1:days===30?5:days===90?15:30;
  const joins=customers.map(c=>Date.parse(c.joined_at)).filter(Number.isFinite);const result=[];
  for(let i=0;i<days;i+=step){const a=new Date(start);a.setDate(a.getDate()+i);const b=new Date(start);b.setDate(b.getDate()+Math.min(i+step,days));const end=b.getTime();const value=joins.filter(t=>t<end&&(mode==="total"||t>=a.getTime())).length;result.push({label:shortDate(a.toISOString()),value})}
  return result;
 },[customers,days,mode]);
 const max=Math.max(1,...chart.map(b=>b.value));
 const filtered=customers.filter(c=>{
  const joined=Date.parse(c.joined_at);const last=visits.get(c.user_id)?.last_visit;
  const old=last?Date.parse(last)<now-30*86400000:joined<now-30*86400000;
  const displayedConsent=c.marketing_ok||(demoStatus(c)??false);
  return (!from||joined>=Date.parse(beginning(from)!))&&(!to||joined<Date.parse(endExclusive(to)!))&&
   (!visit||visit==="repeat"&&Number(c.visits)>=2||visit==="inactive"&&activityReady&&old||visit==="active"&&activityReady&&!!last&&!old||visit==="never"&&activityReady&&!last)&&(!marketing||marketing==="yes"&&displayedConsent||marketing==="no"&&!displayedConsent);
 }).sort((a,b)=>Date.parse(b.joined_at)-Date.parse(a.joined_at));
 const pageSize=25;const currentPage=Math.min(page,Math.max(0,Math.ceil(filtered.length/pageSize)-1));
 return <div className="owner-customers-panel">
  <section className="panel-card"><div className="content-heading"><div><h2><Users size={20}/> Tu comunidad</h2><p className="muted">Altas y actividad de tus clientes</p></div></div>
   <div className="owner-kpi-grid owner-customer-kpis">{[{label:"Clientes registrados",value:count(customers.length)},{label:"Altas este mes",value:count(newMonth)},{label:"Recurrentes históricos",value:count(repeat)},{label:"Sin visitas en 30 días",value:activityReady?count(inactive):"—"}].map(k=><article className="owner-kpi" key={k.label}><span>{k.label}</span><strong>{k.value}</strong></article>)}</div>
   <div className="owner-customer-chart-head"><h3>Evolución de clientes</h3><label className="owner-period-control">Periodo <select value={days} onChange={e=>{setDays(Number(e.target.value));setSelectedBar(null)}}>{[7,30,90,180].map(d=><option key={d} value={d}>{d} días</option>)}</select></label></div>
   <div className="owner-metric-switch"><button type="button" className={mode==="total"?"active":""} aria-pressed={mode==="total"} onClick={()=>{setMode("total");setSelectedBar(null)}}>Acumulados</button><button type="button" className={mode==="new"?"active":""} aria-pressed={mode==="new"} onClick={()=>{setMode("new");setSelectedBar(null)}}>Nuevas altas</button></div>
   <div className="owner-growth-chart"><div className="owner-growth-bars">{chart.map((b,i)=><div className="owner-growth-bar-col" key={i}><button type="button" className={"owner-growth-bar-track"+(selectedBar===i?" is-selected":"")} aria-label={b.label+": "+count(b.value)} aria-pressed={selectedBar===i} onClick={()=>setSelectedBar(i)} onFocus={()=>setSelectedBar(i)} onPointerEnter={()=>setSelectedBar(i)}><span className="signup" style={{height:(b.value?Math.max(6,b.value/max*100):0)+"%"}}/>{selectedBar===i&&<span className="owner-growth-bar-tooltip">{count(b.value)}</span>}</button><small>{b.label}</small></div>)}</div></div>
   <p className="muted">{mode==="total"?"Clientes registrados hasta el final de cada periodo.":"Nuevos clientes inscritos en cada periodo."}</p>
  </section>
  <section className="panel-card"><div className="content-heading"><h3>Listado de clientes</h3><span className="table-pill">{filtered.length} clientes</span></div>
   <div className="owner-data-filters">
    <label>Alta desde<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(0)}}/></label>
    <label>Alta hasta<input type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(0)}}/></label>
    <label>Actividad<select value={visit} onChange={e=>{setVisit(e.target.value);setPage(0)}}><option value="">Todos</option><option value="repeat">2 o más visitas</option><option value="active" disabled={!activityReady}>Visita en 30 días</option><option value="inactive" disabled={!activityReady}>Sin visitas en 30 días</option><option value="never" disabled={!activityReady}>Nunca ha visitado</option></select></label>
    <label>Marketing<select value={marketing} onChange={e=>{setMarketing(e.target.value);setPage(0)}}><option value="">Todos</option><option value="yes">Aceptado</option><option value="no">No aceptado</option></select></label>
   </div>
   {activityError&&<p className="alert error">{activityError}</p>}
   {customers.some(c=>demoStatus(c)!==null)&&<p className="owner-demo-consent-hint">En Café Noma, los estados de marketing de los clientes de ejemplo son simulados y no permiten enviar campañas.</p>}
   <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Email</th><th>Saldo</th><th>Visitas</th><th>Última visita</th><th>Marketing</th><th>Alta</th></tr></thead><tbody>
    {filtered.slice(currentPage*pageSize,(currentPage+1)*pageSize).map(c=>{const demo=demoStatus(c),last=visits.get(c.user_id)?.last_visit;return <tr key={c.user_id}><td><strong>{customerDisplayName(c.full_name)}</strong></td><td><code className="customer-obfuscated-email">{privateEmail(c.email)}</code></td><td><b>{formatBalance(c.balance)}</b></td><td>{c.visits}</td><td>{last?dateShort(last):"—"}</td><td>{c.marketing_ok?<span className="table-pill">Aceptado</span>:demo!==null?<span title="Estado simulado de ejemplo; no concede permiso de envío" className={"table-pill "+(demo?"demo-marketing-pill":"inactive")}>{demo?"Aceptado":"No"}</span>:<span className="table-pill inactive">No</span>}</td><td>{dateShort(c.joined_at)}</td></tr>})}
   </tbody></table></div>
   {!filtered.length&&<p className="muted">No hay clientes que coincidan con los filtros.</p>}
   <div className="owner-data-pagination"><button type="button" className="button button-outline button-sm" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Anterior</button><span>Página {currentPage+1} de {Math.max(1,Math.ceil(filtered.length/pageSize))}</span><button type="button" className="button button-outline button-sm" disabled={(currentPage+1)*pageSize>=filtered.length} onClick={()=>setPage(currentPage+1)}>Siguiente</button></div>
  </section>
 </div>;
}
