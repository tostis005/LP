"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,Compass,Gift,Plus} from "lucide-react";
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
 const readyRewards=cards.filter(c=>prog(c.business_id)&&c.balance>=(prog(c.business_id)?.reward_cost||Infinity)).length;
 return <div className="customer-first-layout">
  <PushWelcomePrompt/>
  <div className="customer-toolbar">
   <div className="customer-toolbar-summary">
    <span className="customer-card-count">{cards.length} {cards.length===1?"tarjeta":"tarjetas"}</span>
    {readyRewards>0&&<span className="customer-reward-ready"><Gift size={15}/>{readyRewards} {readyRewards===1?"recompensa disponible":"recompensas disponibles"}</span>}
   </div>
   <div className="customer-toolbar-actions">
    <Link className="button button-outline button-sm" href="/app/novedades">Avisos {unreadOffers>0&&<span className="kreyv-offer-count">{unreadOffers}</span>}</Link>
    <Link className="button button-dark button-sm" href="/app/descubrir"><Plus size={16}/> Añadir tarjeta</Link>
   </div>
  </div>
  {error&&<div className="alert error" role="alert">{error} <button type="button" className="inline-action" onClick={()=>void load()}>Reintentar</button></div>}
  {loading?<div className="soft-panel">Cargando tarjetas...</div>:cards.length===0?<div className="empty-state"><div className="empty-symbol"><Compass size={28}/></div><h3>Aún no tienes tarjetas</h3><p>Busca un negocio y añade su tarjeta para empezar a acumular recompensas.</p><Link className="button button-dark" href="/app/descubrir">Buscar negocios <ArrowUpRight size={17}/></Link></div>:<div className="card-grid">{cards.map(c=><LoyaltyCard key={c.id} membership={c} business={c.businesses} program={prog(c.business_id)} offersCount={offerCounts[c.business_id]||0}/>)}</div>}
  {movements.length>0&&<section className="customer-activity-section" aria-label="Últimos movimientos">
   <h2>Actividad reciente</h2>
   <div className="customer-activity-list">{movements.map(m=><div className="activity-row" key={m.id}><div className={"activity-icon "+(m.kind==="earn"?"positive":"negative")}>{m.kind==="earn"?<Plus size={19}/>:<Gift size={19}/>}</div><div><strong>{cards.find(c=>c.business_id===m.business_id)?.businesses.name||"Negocio"}</strong><span>{m.kind==="earn"?"Compra registrada":m.kind==="redeem"?"Recompensa canjeada":"Corrección de movimiento"} · {dateShort(m.created_at)}</span></div><b className={m.amount_delta>0?"positive-text":"negative-text"}>{m.amount_delta>0?"+":""}{units(m.amount_delta,prog(m.business_id)?.type,cards.find(c=>c.business_id===m.business_id)?.businesses.currency)}</b></div>)}</div>
  </section>}
 </div>;
}
export default function CustomerPage(){return <AppFrame area="customer" title="Mis tarjetas" subtitle="">{a=><CustomerHome account={a}/>}</AppFrame>}
