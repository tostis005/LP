"use client";
import {Gift,TrendingDown,TrendingUp,Users} from "lucide-react";
export type MetricRow={metric:string;current_value:number;previous_value:number};
export type RankingRow={reward_label:string;redemptions:number;retail_cents:number;cost_cents:number;unpriced:number};
type Props={metrics:MetricRow[];ranking:RankingRow[];days:number;onDays:(days:number)=>void;repeatCustomers:number;totalCustomers:number};
export function BusinessAnalytics({metrics,ranking,days,onDays,repeatCustomers,totalCustomers}:Props){
 const find=(key:string)=>metrics.find(x=>x.metric===key);
 const value=(key:string,previous=false)=>Number(previous?find(key)?.previous_value:find(key)?.current_value)||0;
 const cards=[
  {name:"Clientes nuevos",key:"new_customers",display:(n:number)=>n.toLocaleString("es-MX"),hint:"Altas en el periodo"},
  {name:"Compras registradas",key:"visits",display:(n:number)=>n.toLocaleString("es-MX"),hint:"Visitas válidas"},
  {name:"Clientes activos",key:"active_customers",display:(n:number)=>n.toLocaleString("es-MX"),hint:"Clientes con compras"},
  {name:"Frecuencia de compra",key:"frequency",display:(n:number)=>n.toFixed(2),hint:"Visitas por cliente activo"},
  {name:"Premios canjeados",key:"redemptions",display:(n:number)=>n.toLocaleString("es-MX"),hint:"Canjes completados"}
 ];
 function diff(current:number,previous:number){
  if(previous===0)return {label:current===0?"0 %":"Sin periodo anterior",kind:"neutral"};
  const pct=(current-previous)/Math.abs(previous)*100;
  return {label:(pct>0?"+":"")+pct.toFixed(1)+" %",kind:pct>0?"up":pct<0?"down":"neutral"};
 }
 return <section className="lp-analytics">
  <div className="lp-insights-controls"><div><h2>Tu actividad</h2><p className="muted">Comparación con los {days} días anteriores.</p></div>
   <label>Periodo <select value={days} onChange={e=>onDays(Number(e.target.value))}><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select></label></div>
  <div className="lp-insights-grid">{cards.map(item=>{
   const current=value(item.key),previous=value(item.key,true),d=diff(current,previous);
   return <div className="lp-insight-card" key={item.key}><span>{item.name}</span>
    <strong>{item.display(current)}</strong>
    <span className={"lp-metric-delta "+d.kind}>{d.kind==="up"?<TrendingUp size={13}/>:d.kind==="down"?<TrendingDown size={13}/>:null} {d.label}</span>
    <small>{item.hint}</small>
   </div>;
  })}
   <div className="lp-insight-card"><span>Clientes recurrentes <Users size={14}/></span><strong>{repeatCustomers.toLocaleString("es-MX")}</strong>
    <span className="lp-metric-delta neutral">{totalCustomers?Math.round(repeatCustomers/totalCustomers*100)+" % de tus clientes":"Sin clientes todavía"}</span>
    <small>Clientes con 2 o más visitas, histórico total</small>
   </div>
  </div>
  <div className="panel-card"><h2><Gift size={18}/> Recompensas más canjeadas</h2>
   {ranking.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Regalo</th><th>Canjes</th></tr></thead><tbody>{ranking.map((r,i)=><tr key={r.reward_label+"-"+i}><td><strong>{r.reward_label}</strong></td><td>{r.redemptions}</td></tr>)}</tbody></table></div>:<p className="muted">Todavía no hay canjes en este periodo.</p>}
  </div>
 </section>;
}
