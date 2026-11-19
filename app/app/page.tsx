"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,BellRing,Clock3,Compass,Gift,Plus,Wallet} from "lucide-react";
import {AppFrame, type Account} from "@/components/AppFrame";
import {LoyaltyCard} from "@/components/LoyaltyCard";
import {db} from "@/lib/supabase";
import type {Membership,Business,Program} from "@/lib/types";
import {dateShort,units} from "@/lib/format";
type CardRow=Membership&{businesses:Business};
type Savings={benefits:number;savings_cents:number;unpriced:number};
type Movement={id:string;amount_delta:number;kind:string;created_at:string;business_id:string;};
function CustomerHome({account}:{account:Account}){
 const [cards,setCards]=useState<CardRow[]>([]),[programs,setPrograms]=useState<Program[]>([]),[movements,setMovements]=useState<Movement[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [savings,setSavings]=useState<Savings|null>(null);
 const load=useCallback(async()=>{setLoading(true);
 const [res,summary]=await Promise.all([
   db().from("loyalty_memberships").select("*,businesses(*)").eq("customer_id",account.user.id).order("created_at",{ascending:false}),
   db().rpc("customer_reward_summary")
 ]);
 setSavings(summary.error?null:((summary.data||[])[0] as Savings||null));
 if(res.error){setError(res.error.message);setLoading(false);return}
 const data=(res.data||[]) as CardRow[];setCards(data);
 if(data.length){const ids=data.map(v=>v.business_id);
  const [p,m]=await Promise.all([db().from("loyalty_programs").select("*").in("business_id",ids),db().from("loyalty_transactions").select("id,amount_delta,kind,created_at,business_id").in("business_id",ids).order("created_at",{ascending:false}).limit(10)]);
  setPrograms((p.data||[]) as Program[]);setMovements((m.data||[]) as Movement[]);
 }
 setLoading(false)
 },[account.user.id]);
 useEffect(()=>{load()},[load]);
 const prog=(id:string)=>programs.find(x=>x.business_id===id);
 return <div className="customer-first-layout"><div className="push-home-shortcut"><div className="push-home-shortcut-main"><BellRing size={22}/><div><strong>¿Quieres recibir ofertas y avisos?</strong><span>Activa las notificaciones de tus negocios en este móvil.</span></div></div><Link className="button button-dark button-sm" href="/app/notificaciones">Activar notificaciones <ArrowUpRight size={16}/></Link></div><div className="kpi-grid three"><div className="kpi-card"><div className="kpi-symbol green"><Wallet size={21}/></div><span>Mis tarjetas</span><strong>{cards.length}</strong><small>Tus negocios favoritos</small></div><div className="kpi-card"><div className="kpi-symbol peach"><Gift size={21}/></div><span>Recompensas disponibles</span><strong>{cards.filter(c=>prog(c.business_id)&&c.balance>=(prog(c.business_id)?.reward_cost||Infinity)).length}</strong><small>Listas para canjear</small></div><div className="kpi-card"><div className="kpi-symbol purple"><Clock3 size={21}/></div><span>Movimientos recientes</span><strong>{movements.length}</strong><small>Últimas operaciones</small></div></div>
 {savings&&<section className="lp-savings"><div><span>TU HISTORIAL DE BENEFICIOS</span><strong>{Number(savings.benefits)} premios disfrutados</strong><small>Todos tus establecimientos, sin mezclar sus tarjetas.</small></div><div><span>Ahorro acumulado conocido</span><strong>{new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(savings.savings_cents)/100)}</strong><small>{Number(savings.unpriced)>0?Number(savings.unpriced)+" premios antiguos sin precio registrado. El ahorro real podría ser mayor.":"Calculado a partir del precio habitual registrado en cada canje."}</small></div></section>}
 <div className="content-heading"><div><h2>Tus tarjetas favoritas</h2><p>Todos tus lugares especiales, en un mismo sitio.</p></div><Link className="button button-dark button-sm" href="/app/descubrir">Descubrir negocios <Plus size={16}/></Link></div>
 {error&&<div className="alert error">{error}</div>}
 {loading?<div className="soft-panel">Cargando tus tarjetas...</div>:cards.length===0?<div className="empty-state"><div className="empty-symbol"><Compass size={28}/></div><h3>Tu primera tarjeta está a un paso</h3><p>Descubre negocios cerca de ti y únete a sus programas de fidelización.</p><Link className="button button-dark" href="/app/descubrir">Explorar negocios <ArrowUpRight size={17}/></Link></div>:<div className="card-grid">{cards.map(c=><LoyaltyCard key={c.id} membership={c} business={c.businesses} program={prog(c.business_id)}/>)}</div>}
 <div className="content-heading spaced"><div><h2>Actividad reciente</h2><p>Así avanzan tus recompensas.</p></div></div>
 <div className="soft-panel">{movements.length?movements.map(m=><div className="activity-row" key={m.id}><div className={"activity-icon "+(m.kind==="earn"?"positive":"negative")}>{m.kind==="earn"?<Plus size={19}/>:<Gift size={19}/>}</div><div><strong>{cards.find(c=>c.business_id===m.business_id)?.businesses.name||"Negocio"}</strong><span>{m.kind==="earn"?"Compra registrada":m.kind==="redeem"?"Recompensa canjeada":"Corrección de movimiento"} · {dateShort(m.created_at)}</span></div><b className={m.amount_delta>0?"positive-text":"negative-text"}>{m.amount_delta>0?"+":""}{units(m.amount_delta,prog(m.business_id)?.type)}</b></div>):<p className="muted no-margin">Todavía no hay movimientos.</p>}</div>
 </div>;
}
export default function CustomerPage(){return <AppFrame area="customer" title="Tus sitios favoritos ♡" subtitle="Cada visita cuenta. Aquí empieza tu próxima recompensa.">{a=><CustomerHome account={a}/>}</AppFrame>}
