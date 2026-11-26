"use client";
import {KreyviLoading} from "@/components/KreyviLoading";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,Compass,Gift,Plus} from "lucide-react";
import {AppFrame, type Account} from "@/components/AppFrame";
import {LoyaltyCard} from "@/components/LoyaltyCard";
import {PushWelcomePrompt} from "@/components/PushWelcomePrompt";
import {db} from "@/lib/supabase";
import type {MilestoneDetails} from "@/lib/milestones";
import {saveCards} from "@/lib/client/offline";
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
 const [milestones,setMilestones]=useState<Record<string,MilestoneDetails>>({});
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
    const [p,m,ms]=await Promise.all([
     db().from("loyalty_programs").select("*").in("business_id",complete.map(c=>c.business_id)),
     db().from("loyalty_transactions").select("id,amount_delta,kind,created_at,business_id")
      .in("membership_id",complete.map(c=>c.id)).order("created_at",{ascending:false}).limit(10),db().rpc("customer_stamp_milestones")
    ]);
    setPrograms((p.data||[]) as Program[]);
    setMovements((m.data||[]) as Movement[]);
    const md:Record<string,MilestoneDetails>=Object.fromEntries(((ms.data||[]) as {membership_id:string;details:MilestoneDetails}[]).map(x=>[x.membership_id,x.details]));setMilestones(md);
    if(!p.error&&complete.length===rows.length)saveCards({id:account.user.id,at:Date.now(),cards:complete,programs:(p.data||[]) as Program[],milestones:md});
    if(p.error||m.error)setError("Algunas operaciones no están disponibles. Puedes actualizar para intentarlo de nuevo.");
   }else{
    setPrograms([]);setMovements([]);setMilestones({});if(!rows.length)saveCards({id:account.user.id,at:Date.now(),cards:[],programs:[]});
   }
  }catch{
   setError("No hemos podido cargar tus tarjetas. Comprueba la conexión e inténtalo de nuevo.");
   setCards([]);setPrograms([]);setMovements([]);
  }finally{setLoading(false);}
 },[account.user.id]);
 useEffect(()=>{load()},[load]);
 const prog=(id:string)=>programs.find(x=>x.business_id===id);
 const readyRewards=cards.filter(c=>prog(c.business_id)&&c.balance>=(prog(c.business_id)?.reward_cost||Infinity)).length;
 const firstName=String(account.user.user_metadata?.full_name||"").trim().split(/\s+/)[0];
 // La recompensa destacada sólo aparece cuando existe progreso real y relevante.
 const rewardCards=cards.filter(c=>{const p=prog(c.business_id);return p?.type==="stamps"&&p.reward_cost>0&&c.balance>0&&(c.balance>=Math.ceil(p.reward_cost*.7)||Number(c.total_earned||0)>=p.reward_cost);});
 const closest=rewardCards.sort((a,b)=>{
  const pa=prog(a.business_id)!,pb=prog(b.business_id)!;
  return Math.max(0,pa.reward_cost-a.balance)-Math.max(0,pb.reward_cost-b.balance);
 })[0];
 const closestProgram=closest?prog(closest.business_id):undefined;
 const remaining=closest&&closestProgram?Math.max(0,closestProgram.reward_cost-closest.balance):0;
 return <div className="customer-first-layout">
  <PushWelcomePrompt/>
  <div className="customer-home-greeting">
   <span className="customer-overline">TUS RECOMPENSAS</span>
   <h2>Hola{firstName?", "+firstName:""}<span className="customer-greeting-dot">.</span></h2>
   <p>{cards.length} {cards.length===1?"tarjeta":"tarjetas"}{readyRewards>0?" · "+readyRewards+" "+(readyRewards===1?"premio disponible":"premios disponibles"):""}</p>
  </div>
  {closest&&closestProgram&&<section className="customer-spotlight" aria-label="Tu próxima recompensa">
   <div className="customer-spotlight-head"><span>{remaining===0?"PREMIO LISTO":remaining===1?"CASI LO TIENES":"SIGUE SUMANDO"}</span><Gift size={21}/></div>
   <h3>{remaining===0?"¡Ya puedes canjear tu premio!":remaining===1?"Te falta solo 1 sello":"Te faltan "+remaining+" sellos"} en {closest.businesses.name}</h3>
   <p>{closestProgram.reward_label}</p>
   <div className="customer-spotlight-foot"><span>{Math.min(closest.balance,closestProgram.reward_cost)}/{closestProgram.reward_cost} sellos</span><Link href={"/app?card="+encodeURIComponent(closest.id)} onClick={()=>window.dispatchEvent(new CustomEvent("kreyv:open-card",{detail:closest.id}))}>Ver tarjeta <ArrowUpRight size={17}/></Link></div>
  </section>}
  <div className="customer-list-heading"><div><h2>Mis tarjetas</h2><span className="customer-swipe-hint">Desliza para verlas</span></div><Link href="/app/descubrir"><Plus size={16}/> Explorar</Link></div>
  {error&&<div className="alert error" role="alert">{error} <button type="button" className="inline-action" onClick={()=>void load()}>Reintentar</button> · <a href="/offline">Ver tarjetas guardadas</a></div>}
  {loading?<KreyviLoading compact label="Cargando tus tarjetas"/>:cards.length===0?<div className="empty-state"><div className="empty-symbol"><Compass size={28}/></div><h3>Aún no tienes tarjetas</h3><p>Busca un negocio y añade su tarjeta para empezar a acumular recompensas.</p><Link className="button button-dark" href="/app/descubrir">Buscar negocios <ArrowUpRight size={17}/></Link></div>:<div className="card-grid" role="region" aria-label="Tus tarjetas, desliza horizontalmente para verlas" tabIndex={0}>{cards.map(c=><LoyaltyCard key={c.id} membership={c} business={c.businesses} program={prog(c.business_id)} offersCount={offerCounts[c.business_id]||0} milestones={milestones[c.id]} compact/>)}</div>}

  {movements.length>0&&<section className="customer-activity-section" aria-label="Últimos movimientos">
   <h2>Actividad reciente</h2>
   <div className="customer-activity-list">{movements.map(m=><div className="activity-row" key={m.id}><div className={"activity-icon "+(m.kind==="earn"?"positive":"negative")}>{m.kind==="earn"?<Plus size={19}/>:<Gift size={19}/>}</div><div><strong>{cards.find(c=>c.business_id===m.business_id)?.businesses.name||"Negocio"}</strong><span>{m.kind==="earn"?"Compra registrada":m.kind==="redeem"?"Recompensa canjeada":"Corrección de movimiento"} · {dateShort(m.created_at)}</span></div><b className={m.amount_delta>0?"positive-text":"negative-text"}>{m.amount_delta>0?"+":""}{units(m.amount_delta,prog(m.business_id)?.type,cards.find(c=>c.business_id===m.business_id)?.businesses.currency)}</b></div>)}</div>
  </section>}
 </div>;
}
export default function CustomerPage(){return <AppFrame area="customer" title="Mis tarjetas" subtitle="">{a=><CustomerHome account={a}/>}</AppFrame>}
