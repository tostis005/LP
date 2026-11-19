"use client";
import {Gift,Info,TrendingDown,TrendingUp} from "lucide-react";
export type MetricRow={metric:string;current_value:number;previous_value:number};
export type RankingRow={reward_label:string;redemptions:number;retail_cents:number;cost_cents:number;unpriced:number};
type Props={metrics:MetricRow[];ranking:RankingRow[];days:number;onDays:(days:number)=>void};
const money=(cents:number)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(cents/100);
export function BusinessAnalytics({metrics,ranking,days,onDays}:Props){
 const find=(key:string)=>metrics.find(x=>x.metric===key);
 const value=(key:string,previous=false)=>Number(previous?find(key)?.previous_value:find(key)?.current_value)||0;
 const ratio=(previous=false)=>{const sales=value("sales_cents",previous),cost=value("reward_cost_cents",previous);return sales?100*cost/sales:null};
 const cards=[
  {name:"Clientes nuevos",key:"new_customers",display:(n:number)=>n.toLocaleString("es-MX"),hint:"Altas en el periodo"},
  {name:"Compras registradas",key:"visits",display:(n:number)=>n.toLocaleString("es-MX"),hint:"Operaciones no revertidas"},
  {name:"Frecuencia por cliente",key:"frequency",display:(n:number)=>n.toFixed(2),hint:"Compras por cliente comprador"},
  {name:"Clientes que compraron",key:"active_customers",display:(n:number)=>n.toLocaleString("es-MX"),hint:"Clientes únicos activos"},
  {name:"Premios canjeados",key:"redemptions",display:(n:number)=>n.toLocaleString("es-MX"),hint:"Canjes no revertidos"},
  {name:"Ventas registradas",key:"sales_cents",display:money,hint:"Solo tickets con importe"},
  {name:"Coste de recompensas",key:"reward_cost_cents",display:money,hint:"Coste real declarado"},
  {name:"Coste de premios / ventas",key:"cost_ratio",display:(n:number)=>n.toFixed(1)+"%",hint:"No es beneficio incremental"}
 ];
 function diff(current:number,previous:number){
  if(previous===0)return {label:current===0?"0 %":"Sin base previa",kind:"neutral"};
  const pct=(current-previous)/Math.abs(previous)*100;
  return {label:(pct>0?"+":"")+pct.toFixed(1)+" %",kind:pct>0?"up":pct<0?"down":"neutral"};
 }
 return <section className="lp-analytics">
  <div className="lp-insights-controls"><div><h2>Resultados de tu sucursal</h2><p className="muted">Comparación con los {days} días inmediatamente anteriores. Sin mezclar datos de otros locales.</p></div>
   <label>Periodo <select value={days} onChange={e=>onDays(Number(e.target.value))}><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select></label></div>
  <div className="lp-insights-grid">{cards.map(item=>{
   const current=item.key==="cost_ratio"?ratio():value(item.key);
   const previous=item.key==="cost_ratio"?ratio(true):value(item.key,true);
   const d=current===null||previous===null?null:diff(current,previous);
   return <div className="lp-insight-card" key={item.key}><span>{item.name}</span>
    <strong>{current===null?"—":item.display(current)}</strong>
    {d?<span className={"lp-metric-delta "+d.kind}>{d.kind==="up"?<TrendingUp size={13}/>:d.kind==="down"?<TrendingDown size={13}/>:null} {d.label}</span>:<small>Sin ventas registradas</small>}
    <small>{item.hint}</small>
   </div>
  })}</div>
  {(value("unpriced_purchases")>0||value("unpriced_rewards")>0)&&<p className="tiny-note"><Info size={14}/> Datos incompletos: {value("unpriced_purchases")} compras sin importe y {value("unpriced_rewards")} canjes sin coste declarado. Los importes y ratios no incluyen valores desconocidos.</p>}
  <div className="panel-card"><h2><Gift size={18}/> Recompensas más elegidas</h2><p className="muted">Ranking de productos canjeados en esta sucursal durante el periodo seleccionado.</p>
   {ranking.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Recompensa</th><th>Canjes</th><th>Valor regalado conocido</th><th>Coste conocido</th></tr></thead><tbody>{ranking.map((r,i)=><tr key={r.reward_label+"-"+i}><td><strong>{r.reward_label}</strong></td><td>{r.redemptions}</td><td>{money(Number(r.retail_cents))}{Number(r.unpriced)>0?"*":""}</td><td>{money(Number(r.cost_cents))}{Number(r.unpriced)>0?"*":""}</td></tr>)}</tbody></table></div>:<p className="muted">Todavía no hay canjes para este periodo.</p>}
   {ranking.some(r=>Number(r.unpriced)>0)&&<p className="tiny-note">* Hay canjes históricos cuyo valor o coste no se registró. No se les ha asignado un precio ficticio.</p>}
  </div>
 </section>;
}
