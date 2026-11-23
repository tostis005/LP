"use client";
import {ArrowDownRight,ArrowUpRight,Gift,TrendingUp,Users} from "lucide-react";
export type MetricRow={metric:string;current_value:number;previous_value:number};
export type RankingRow={reward_label:string;redemptions:number;retail_cents:number;cost_cents:number;unpriced:number};
export type GrowthRow={bucket_start:string;new_customers:number;habitual_customers:number;awarded_units:number;average_units:number;verified_visits:number};
type Props={metrics:MetricRow[];summary:MetricRow[];growth:GrowthRow[];ranking:RankingRow[];days:number;
 onDays:(days:number)=>void;repeatCustomers:number;totalCustomers:number;programType?:string};
const integer=(n:number)=>n.toLocaleString("es-MX");
// PostgreSQL puede devolver DATE como "YYYY-MM-DD" o como fecha ISO completa.
// Nunca concatenar una segunda "T" sobre un timestamp (causaba "Invalid Date").
export function reportDateLabel(raw:string){
 const value=String(raw||"");
 const day=/^\d{4}-\d{2}-\d{2}/.exec(value)?.[0];
 if(!day)return "—";
 const date=new Date(day+"T12:00:00Z");
 return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("es-ES",
  {day:"numeric",month:"short",timeZone:"UTC"}).format(date);
}
function Change({value,previous}:{value:number;previous:number}){
 if(previous===0)return <small className="owner-kpi-delta neutral">{value===0?"Sin variación":"Sin periodo anterior"}</small>;
 const delta=(value-previous)/Math.abs(previous)*100;
 return <small className={"owner-kpi-delta "+(delta>0?"up":delta<0?"down":"neutral")}>
  {delta>0?<ArrowUpRight size={14}/>:delta<0?<ArrowDownRight size={14}/>:null}
  {(delta>0?"+":"")+delta.toFixed(1)+" % frente al periodo anterior"}
 </small>;
}
function MiniChart({title,description,rows,field}:{title:string;description:string;rows:GrowthRow[];field:"new_customers"|"habitual_customers"}){
 const numbers=rows.map(r=>Number(r[field]||0));
 const max=Math.max(1,...numbers);
 const sum=numbers.reduce((a,b)=>a+b,0);
 return <section className="panel-card owner-growth-chart" aria-label={title}>
  <div className="owner-growth-chart-head"><div><h3>{title}</h3><p>{description}</p></div>{field==="new_customers"&&<strong>{integer(sum)}</strong>}</div>
  <div className="owner-growth-bars" role="img" aria-label={rows.map(r=>reportDateLabel(r.bucket_start)+": "+integer(Number(r[field]||0))).join("; ")}>
   {rows.map((r,i)=><div key={r.bucket_start} className="owner-growth-bar-col">
    <div className="owner-growth-bar-track" title={reportDateLabel(r.bucket_start)+": "+integer(Number(r[field]||0))}>
     <span className={field==="new_customers"?"signup":"habitual"} style={{height:Math.max(numbers[i]?6:0,numbers[i]/max*100)+"%"}}/>
    </div>
    <small>{reportDateLabel(r.bucket_start)}</small>
   </div>)}
  </div>
  {!rows.length&&<p className="muted">Todavía no hay datos disponibles.</p>}
 </section>;
}
export function BusinessAnalytics({metrics,summary,growth,ranking,days,onDays,repeatCustomers,totalCustomers,programType}:Props){
 const lookup=(key:string,previous=false)=>Number(summary.find(x=>x.metric===key)?.[previous?"previous_value":"current_value"]||0);
 const legacy=(key:string)=>Number(metrics.find(x=>x.metric===key)?.current_value||0);
 const unit=programType==="stamps"?"sellos":programType==="points"?"puntos":"saldo";
 const kpis=[
  {key:"new_customers",label:"Nuevas tarjetas",value:integer(lookup("new_customers")),helper:"Clientes que se han inscrito"},
  {key:"habitual_customers",label:"Clientes habituales",value:integer(lookup("habitual_customers")),helper:"Con compras recurrentes en el periodo"},
  {key:"avg_units_habitual",label:unit==="sellos"?"Sellos por habitual":"Unidades por habitual",value:lookup("avg_units_habitual").toFixed(2),helper:"Media ganada por cliente habitual en el periodo"},
  {key:"avg_visits_habitual",label:"Visitas por habitual",value:lookup("avg_visits_habitual").toFixed(2),helper:"Compras medias registradas por cliente habitual"}
 ];
 return <section className="owner-data-dashboard">
  <div className="owner-data-heading">
   <div><span className="page-eyebrow">INFORMES</span><h2>Evolución del negocio</h2></div>
   <label>Periodo <select value={days} onChange={e=>onDays(Number(e.target.value))}><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select></label>
  </div>
  <div className="owner-kpi-grid">{kpis.map(card=><article key={card.key} className="owner-kpi">
   <span>{card.label}</span><strong>{card.value}</strong>
   <Change value={lookup(card.key)} previous={lookup(card.key,true)}/>
   <small>{card.helper}</small>
  </article>)}</div>
  <div className="owner-growth-grid">
   <MiniChart title="Nuevos clientes" description="Altas por periodo" rows={growth} field="new_customers"/>
   <MiniChart title="Clientes habituales activos" description="Con compras recurrentes" rows={growth} field="habitual_customers"/>
  </div>
  <div className="owner-data-secondary">
   <div className="owner-data-stat"><TrendingUp size={20}/><div><strong>{integer(legacy("visits"))}</strong><span>Compras verificadas en el periodo</span></div></div>
   <div className="owner-data-stat"><Gift size={20}/><div><strong>{integer(legacy("redemptions"))}</strong><span>Recompensas canjeadas</span></div></div>
   <div className="owner-data-stat"><Users size={20}/><div><strong>{integer(repeatCustomers)}</strong><span>Clientes recurrentes históricos: 2 o más visitas desde que se inscribieron ({totalCustomers} tarjetas)</span></div></div>
  </div>
  <section className="panel-card owner-ranking"><h3><Gift size={18}/> Recompensas canjeadas</h3>
   {ranking.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Recompensa</th><th>Canjes</th></tr></thead><tbody>{ranking.map((r,i)=><tr key={r.reward_label+"-"+i}><td><strong>{r.reward_label}</strong></td><td>{r.redemptions}</td></tr>)}</tbody></table></div>:<p className="muted">Aún no hay canjes en este periodo.</p>}
  </section>
 </section>;
}
