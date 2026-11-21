"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,BellRing,Clock3,Compass,Gift,Plus,Wallet} from "lucide-react";
import {AppFrame, type Account} from "@/components/AppFrame";
import {LoyaltyCard} from "@/components/LoyaltyCard";
import {PushWelcomePrompt} from "@/components/PushWelcomePrompt";
import {db} from "@/lib/supabase";
import type {Membership,Business,Program} from "@/lib/types";
import {dateShort,units} from "@/lib/format";
type CardRow=Membership&{businesses:Business|null};
type CompleteCard=Membership&{businesses:Business};
function completeCard(card:CardRow):card is CompleteCard {
 return !!card.businesses&&typeof card.businesses.name==="string"&&card.businesses.name.trim().length>0
  &&typeof card.card_token==="string"&&card.card_token.length>0;
}
type Movement={id:string;amount_delta:number;kind:string;created_at:string;business_id:string;};
function CustomerHome({account}:{account:Account}){
 const [cards,setCards]=useState<CompleteCard[]>([]),[programs,setPrograms]=useState<Program[]>([]),[movements,setMovements]=useState<Movement[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [offerCounts,setOfferCounts]=useState<Record<string,number>>({}),[unreadOffers,setUnreadOffers]=useState(0);
 useEffect(()=>{
  let live=true;
  fetch("/api/local/offers",{credentials:"same-origin",cache:"no-store"})
   .then(async r=>{if(!r.ok)throw Error("Novedades");return r.json()})
   .then((value:{items?:{business_id:string;seen_at:string|null}[]})=>{
    if(!live)return;
    const counts:Record<string,number>={};
    for(const item of value.items||[])counts[item.business_id]=(counts[item.business_id]||0)+1;
    setOfferCounts(counts);setUnreadOffers((value.items||[]).filter(item=>!item.seen_at).length);
   }).catch(()=>{});
  return()=>{live=false};
 },[account.user.id]);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const res=await db().from("loyalty_memberships").select("*,businesses(*)")
    .eq("customer_id",account.user.id).order("created_at",{ascending:false});
   if(res.error)throw res.error;
   let rows=(res.data||[]) as CardRow[];
   if(rows.some(card=>!card.businesses)){
    const missingIds=[...new Set(rows.filter(card=>!card.businesses).map(card=>card.business_id))];
    const fallback=await db().from("businesses").select("*").in("id",missingIds);
    if(!fallback.error){
     const byId=new Map(((fallback.data||[]) as Business[]).map(business=>[business.id,business]));
     rows=rows.map(card=>({...card,businesses:card.businesses||byId.get(card.business_id)||null}));
    }
   }
   const complete=rows.filter(completeCard);
   setCards(complete);
   if(complete.length!==rows.length){
    setError("No hemos podido mostrar algunas tarjetas. Vuelve a intentarlo.");
   }
   if(complete.length){
    const [p,m]=await Promise.all([
     db().from("loyalty_programs").select("*").in("business_id",complete.map(c=>c.business_id)),
     db().from("loyalty_transactions").select("id,amount_delta,kind,created_at,business_id")
      .in("membership_id",complete.map(c=>c.id)).order("created_at",{ascending:false}).limit(10)
    ]);
    setPrograms((p.data||[]) as Program[]);
    setMovements((m.data||[]) as Movement[]);
    if(p.error||m.error)setError("Algunas operaciones no están disponibles. Puedes actualizar para intentarlo de nuevo.");
   }else{
    setPrograms([]);setMovements([]);
   }
  }catch{
   setError("No hemos podido cargar tus tarjetas. Comprueba la conexión e inténtalo de nuevo.");
   setCards([]);setPrograms([]);setMovements([]);
  }finally{setLoading(false);}
 },[account.user.id]);
 useEffect(()=>{load()},[load]);
 const prog=(id:string)=>programs.find(x=>x.business_id===id);
 return <div className="customer-first-layout"><PushWelcomePrompt/><div className="push-home-shortcut"><div className="push-home-shortcut-main"><BellRing size={22}/><div><strong>¿Quieres recibir ofertas y avisos?</strong><span>Activa las notificaciones de tus negocios en este móvil.</span></div></div><Link className="button button-dark button-sm" href="/app/ajustes">Activar notificaciones <ArrowUpRight size={16}/></Link></div><div className="kpi-grid three"><div className="kpi-card"><div className="kpi-symbol green"><Wallet size={21}/></div><span>Mis tarjetas</span><strong>{cards.length}</strong><small>Tus negocios favoritos</small></div><div className="kpi-card"><div className="kpi-symbol peach"><Gift size={21}/></div><span>Recompensas disponibles</span><strong>{cards.filter(c=>prog(c.business_id)&&c.balance>=(prog(c.business_id)?.reward_cost||Infinity)).length}</strong><small>Listas para canjear</small></div><div className="kpi-card"><div className="kpi-symbol purple"><Clock3 size={21}/></div><span>Movimientos recientes</span><strong>{movements.length}</strong><small>Últimas operaciones</small></div></div>

 <div className="content-heading"><div><h2>Tus tarjetas favoritas</h2><p>Todos tus lugares especiales, en un mismo sitio.</p></div><div className="campaign-compose-actions"><Link className="button button-outline button-sm" href="/app/novedades">Novedades {unreadOffers>0&&<span className="kreyv-offer-count">{unreadOffers}</span>}</Link><Link className="button button-dark button-sm" href="/app/descubrir">Descubrir negocios <Plus size={16}/></Link></div></div>
 {error&&<div className="alert error" role="alert">{error} <button type="button" className="inline-action" onClick={()=>void load()}>Reintentar</button></div>}
 {loading?<div className="soft-panel">Cargando tus tarjetas...</div>:cards.length===0?<div className="empty-state"><div className="empty-symbol"><Compass size={28}/></div><h3>Tu primera tarjeta está a un paso</h3><p>Descubre negocios cerca de ti y únete a sus programas de fidelización.</p><Link className="button button-dark" href="/app/descubrir">Explorar negocios <ArrowUpRight size={17}/></Link></div>:<div className="card-grid">{cards.map(c=><LoyaltyCard key={c.id} membership={c} business={c.businesses} program={prog(c.business_id)} offersCount={offerCounts[c.business_id]||0}/>)}</div>}
 <div className="content-heading spaced"><div><h2>Actividad reciente</h2><p>Así avanzan tus recompensas.</p></div></div>
 <div className="soft-panel">{movements.length?movements.map(m=><div className="activity-row" key={m.id}><div className={"activity-icon "+(m.kind==="earn"?"positive":"negative")}>{m.kind==="earn"?<Plus size={19}/>:<Gift size={19}/>}</div><div><strong>{cards.find(c=>c.business_id===m.business_id)?.businesses.name||"Negocio"}</strong><span>{m.kind==="earn"?"Compra registrada":m.kind==="redeem"?"Recompensa canjeada":"Corrección de movimiento"} · {dateShort(m.created_at)}</span></div><b className={m.amount_delta>0?"positive-text":"negative-text"}>{m.amount_delta>0?"+":""}{units(m.amount_delta,prog(m.business_id)?.type,cards.find(c=>c.business_id===m.business_id)?.businesses.currency)}</b></div>):<p className="muted no-margin">Todavía no hay movimientos.</p>}</div>
 </div>;
}
export default function CustomerPage(){return <AppFrame area="customer" title="Tus sitios favoritos ♡" subtitle="Cada visita cuenta. Aquí empieza tu próxima recompensa.">{a=><CustomerHome account={a}/>}</AppFrame>}
