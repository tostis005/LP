"use client";
import {useState} from "react";
import {ArrowDownRight,ArrowUpRight,Gift,Users,UserRoundCheck,Percent} from "lucide-react";
import {reportDateLabel} from "@/lib/report-date";
export type MetricRow={metric:string;current_value:number;previous_value:number};
export type RankingRow={reward_label:string;redemptions:number;retail_cents:number;cost_cents:number;unpriced:number};
export type GrowthRow={bucket_start:string;new_customers:number;habitual_customers:number;awarded_units:number;average_units:number;verified_visits:number};
type Props={currency:string;showMoney:boolean;metrics:MetricRow[];summary:MetricRow[];growth:GrowthRow[];ranking:RankingRow[];days:number;
 onDays:(days:number)=>void;repeatCustomers:number;totalCustomers:number;programType?:string;maxStampsPerAction?:number};
const integer=(n:number)=>n.toLocaleString("es-MX");
function Change({value,previous}:{value:number;previous:number}){
 if(previous===0)return <small className="owner-kpi-delta neutral">{value===0?"Sin variación":"Sin periodo anterior"}</small>;
 const delta=(value-previous)/Math.abs(previous)*100;
 return <small className={"owner-kpi-delta "+(delta>0?"up":delta<0?"down":"neutral")}>
  {delta>0?<ArrowUpRight size={14}/>:delta<0?<ArrowDownRight size={14}/>:null}
  {(delta>0?"+":"")+delta.toFixed(1)+" % frente al periodo anterior"}
 </small>;
}
function MiniChart({title,description,rows,field}:{title:string;description:string;rows:GrowthRow[];field:"new_customers"|"habitual_customers"}){
 const [selectedIndex,setSelectedIndex]=useState<number|null>(null);
 const numbers=rows.map(r=>Number(r[field]||0));
 const max=Math.max(1,...numbers);
 const sum=numbers.reduce((a,b)=>a+b,0);
 const chosen=selectedIndex===null?null:rows[selectedIndex]||null;
 const chosenValue=chosen?Number(chosen[field]||0):0;
 return <section className="panel-card owner-growth-chart" aria-label={title}>
  <div className="owner-growth-chart-head">
   <div><h3>{title}</h3><p>{description}</p>
   </div>
   {field==="new_customers"&&<strong>{integer(sum)}</strong>}
  </div>
  <div className="owner-growth-picked" role="status" aria-live="polite">
   {chosen?<><span>{reportDateLabel(chosen.bucket_start)}</span><strong>{integer(chosenValue)} {field==="new_customers"?"altas":"clientes"}</strong></>:<span className="owner-growth-hint">Selecciona una barra para ver el dato</span>}
  </div>
  <div className="owner-growth-bars" aria-label={"Selecciona una barra para ver el valor de "+title.toLowerCase()}>
   {rows.map((r,i)=><div key={r.bucket_start} className="owner-growth-bar-col">
    <button type="button" className={"owner-growth-bar-track"+(selectedIndex===i?" is-selected":"")}
     aria-label={reportDateLabel(r.bucket_start)+": "+integer(numbers[i])+" "+(field==="new_customers"?"altas":"clientes")}
     aria-pressed={selectedIndex===i}
     onClick={()=>setSelectedIndex(i)}
     onPointerEnter={()=>setSelectedIndex(i)}
     onFocus={()=>setSelectedIndex(i)}>
     <span className={field==="new_customers"?"signup":"habitual"} style={{height:Math.max(numbers[i]?6:0,numbers[i]/max*100)+"%"}}/>
     {selectedIndex===i&&<span className="owner-growth-bar-tooltip" aria-hidden="true">{integer(numbers[i])}</span>}
    </button>
    <small>{reportDateLabel(r.bucket_start)}</small>
   </div>)}
  </div>
  {!rows.length&&<p className="muted">Todavía no hay datos disponibles.</p>}
 </section>;
}
export function BusinessAnalytics({currency,showMoney,metrics,summary,growth,ranking,days,onDays,repeatCustomers,totalCustomers,programType,maxStampsPerAction}:Props){
 const lookup=(key:string,previous=false)=>Number(summary.find(x=>x.metric===key)?.[previous?"previous_value":"current_value"]||0);
 const legacy=(key:string)=>Number(metrics.find(x=>x.metric===key)?.current_value||0);
 const unit=programType==="stamps"?"sellos":programType==="points"?"puntos":"saldo";
 const singleStamp=programType==="stamps"&&maxStampsPerAction===1;
 const sales=legacy("sales_cents"),cost=legacy("reward_cost_cents"),visits=legacy("visits"),redeems=legacy("redemptions"),missingSales=legacy("unpriced_purchases"),missingCosts=legacy("unpriced_rewards");
 const money=(n:number)=>new Intl.NumberFormat("es-MX",{style:"currency",currency}).format(n/100);
 const complete=visits>0&&missingSales===0&&missingCosts===0;
 const kpis=[
  {key:"new_customers",label:"Nuevas tarjetas",value:integer(lookup("new_customers")),helper:"Clientes que se han inscrito"},
  {key:"habitual_customers",label:"Clientes habituales",value:integer(lookup("habitual_customers")),helper:"Con compras recurrentes en el periodo"},
  ...(programType==="stamps"?[{key:"awarded_units",label:"Sellos",value:integer(legacy("awarded_units")),helper:"Sellos de compras no revertidas"}]:[]),
  ...(!singleStamp?[{key:"visits",label:"Ventas",value:integer(legacy("visits")),helper:"Compras verificadas"}]:[]),
  {key:"redemptions",label:"Recompensas canjeadas",value:integer(legacy("redemptions")),helper:"Canjes no revertidos"},
  {key:"avg_units_habitual",label:unit==="sellos"?"Sellos por habitual":"Unidades por habitual",value:lookup("avg_units_habitual").toFixed(2),helper:"Media ganada por cliente habitual en el periodo"},
  {key:"avg_visits_habitual",label:"Ventas por habitual",value:lookup("avg_visits_habitual").toFixed(2),helper:"Compras medias registradas por cliente habitual"}
 ].filter(card=>!singleStamp||card.key!=="avg_visits_habitual");
 return <section className="owner-data-dashboard">
  <div className="owner-data-heading">
   <div><span className="page-eyebrow">INFORMES</span><h2>Evolución del negocio</h2></div>
   <label className="owner-period-control">Periodo <select value={days} onChange={e=>onDays(Number(e.target.value))}><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select></label>
  </div>
  <div className="owner-kpi-grid">{kpis.map(card=><article key={card.key} className="owner-kpi">
   <span>{card.label}</span><strong>{card.value}</strong>
   <Change value={["visits","redemptions","awarded_units"].includes(card.key)?legacy(card.key):lookup(card.key)} previous={["visits","redemptions","awarded_units"].includes(card.key)?Number(metrics.find(m=>m.metric===card.key)?.previous_value||0):lookup(card.key,true)}/>
   <small>{card.helper}</small>
  </article>)}</div>
  {showMoney&&<section className="panel-card"><h3>Rendimiento económico</h3><p className="muted">Compras vinculadas a la fidelización · últimos {days} días</p><div className="owner-kpi-grid">
   <article className="owner-kpi"><span>Importe registrado</span><strong>{visits>missingSales?money(sales):"—"}</strong><small>{integer(visits-missingSales)} de {integer(visits)} compras con importe</small></article>
   <article className="owner-kpi"><span>Ticket medio registrado</span><strong>{visits>missingSales?money(sales/(visits-missingSales)):"—"}</strong><small>Solo compras con importe</small></article>
   <article className="owner-kpi"><span>Coste de regalos</span><strong>{redeems===0||redeems>missingCosts?money(cost):"—"}</strong><small>{integer(redeems-missingCosts)} de {integer(redeems)} canjes con coste</small></article>
   <article className="owner-kpi"><span>Coste / ventas registradas</span><strong>{complete&&sales>0?(cost/sales*100).toFixed(1)+" %":"—"}</strong><small>Solo con datos completos</small></article>
   <article className="owner-kpi"><span>Ventas por cada {currency} invertido en premios</span><strong>{complete&&cost>0?(sales/cost).toFixed(2)+"×":"—"}</strong><small>Ratio descriptivo, no ROI incremental</small></article>
   </div>{(missingSales>0||missingCosts>0)&&<p className="muted">Histórico incompleto: {integer(missingSales)} compras sin importe y {integer(missingCosts)} premios sin coste. No se estiman valores desconocidos.</p>}
   <p className="muted">No representa facturación total, beneficio ni retorno causal: faltan margen comercial, otros costes y ventas que habrían ocurrido sin el programa.</p></section>}
  <div className="owner-growth-grid">
   <MiniChart title="Nuevos clientes" description="Altas por periodo" rows={growth} field="new_customers"/>
   <MiniChart title="Clientes habituales activos" description="Con compras recurrentes" rows={growth} field="habitual_customers"/>
  </div>
  <div className="owner-data-secondary" aria-label="Indicadores históricos de clientes">
   <div className="owner-data-stat"><Users size={22}/><div><strong>{integer(totalCustomers)}</strong><span>Clientes registrados</span><small>Total histórico de tarjetas</small></div></div>
   <div className="owner-data-stat"><UserRoundCheck size={22}/><div><strong>{integer(repeatCustomers)}</strong><span>Clientes recurrentes</span><small>2 o más visitas · Histórico</small></div></div>
   <div className="owner-data-stat"><Percent size={22}/><div><strong>{totalCustomers?new Intl.NumberFormat("es-ES",{style:"percent",maximumFractionDigits:1}).format(repeatCustomers/totalCustomers):"—"}</strong><span>Tasa de recurrencia</span><small>Clientes recurrentes / registrados</small></div></div>
  </div>
  <section className="panel-card owner-ranking"><h3><Gift size={18}/> Recompensas canjeadas</h3>
   <RewardDonut ranking={ranking}/>
   {showMoney&&ranking.length>0&&<div className="table-wrap"><table className="data-table"><thead><tr><th>Regalo</th><th>Canjes</th><th>Coste registrado</th></tr></thead><tbody>{ranking.map(r=><tr key={r.reward_label}><td>{r.reward_label}</td><td>{integer(Number(r.redemptions))}</td><td>{Number(r.cost_cents)>0?money(Number(r.cost_cents)):"—"}</td></tr>)}</tbody></table><small className="muted">Los costes históricos desconocidos no se imputan.</small></div>}

  </section>
 </section>;
}

const rewardColors=["#67263e","#187b83","#cf8b22","#5264b3","#a44585","#55813c","#cb5c44","#657585"];
function RewardDonut({ranking}:{ranking:RankingRow[]}){
 const [active,setActive]=useState<string|null>(null);
 const sorted=ranking.filter(r=>Number(r.redemptions)>0).sort((a,b)=>Number(b.redemptions)-Number(a.redemptions));
 const rows=sorted.length>7?[...sorted.slice(0,7),{reward_label:"Otros",redemptions:sorted.slice(7).reduce((n,r)=>n+Number(r.redemptions),0)}]:sorted;
 const total=rows.reduce((n,r)=>n+Number(r.redemptions),0);
 if(!total)return <p className="muted">Aún no hay canjes en este periodo.</p>;
 let offset=0;const circumference=2*Math.PI*73;
 const chosen=rows.find(r=>r.reward_label===active);
 return <div className="owner-reward-donut">
  <svg viewBox="0 0 200 200" role="img" aria-label={total+" canjes; consulta la leyenda para el desglose"}>
   {rows.map((r,i)=>{const length=Number(r.redemptions)/total*circumference;const start=offset;offset+=length;
    return <circle key={r.reward_label} cx="100" cy="100" r="73" fill="none" stroke={rewardColors[i]} strokeWidth={active===r.reward_label?30:25}
     strokeDasharray={length+" "+Math.max(0,circumference-length)} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{r.reward_label}: {r.redemptions}</title></circle>})}
   <text x="100" y="99" textAnchor="middle" className="owner-donut-total">{integer(chosen?Number(chosen.redemptions):total)}</text>
   <text x="100" y="119" textAnchor="middle" className="owner-donut-caption">{chosen?"Canjes seleccionados":"Canjes totales"}</text>
  </svg>
  <div className="owner-reward-legend">{rows.map((r,i)=><button type="button" key={r.reward_label} aria-pressed={active===r.reward_label}
   onClick={()=>setActive(active===r.reward_label?null:r.reward_label)} onFocus={()=>setActive(r.reward_label)}
   className="owner-legend-row"><span style={{background:rewardColors[i]}}/><span>{r.reward_label}</span><strong>{integer(Number(r.redemptions))}</strong><small>{(Number(r.redemptions)/total*100).toFixed(1)}%</small></button>)}</div>
 </div>;
}
