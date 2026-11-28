"use client";
import {KreyviLoading} from "@/components/KreyviLoading";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,Compass,Gift,Plus,Eye,EyeOff} from "lucide-react";
import {AppFrame, type Account} from "@/components/AppFrame";
import {CustomerCardDeck} from "@/components/CustomerCardDeck";
import {LoyaltyCard} from "@/components/LoyaltyCard";
import {visibleWalletCards} from "@/lib/customer-card-order";
import {cardStateChanged,useLiveCardBalances} from "@/lib/client/live-card-balances";
import "../customer-deck.css";
import {db} from "@/lib/supabase";
import type {MilestoneDetails} from "@/lib/milestones";
import {offlineCards,saveCards} from "@/lib/client/offline";
import {CachedCustomerSpace} from "@/components/CachedCustomerSpace";
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
 const [cached,setCached]=useState(false);
 const [restoring,setRestoring]=useState<string|null>(null),[hiddenOpen,setHiddenOpen]=useState<string|null>(null),[notice,setNotice]=useState("");
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
 const loadingRef=useRef(false);
 const load=useCallback(async(quiet=false)=>{
  if(loadingRef.current)return;
  loadingRef.current=true;
  const saved=offlineCards();
  if(!quiet&&saved?.id===account.user.id){setCards(saved.cards);setPrograms(saved.programs);setMilestones(saved.milestones||{});setMovements(saved.movements||[]);setLoading(false);if(!navigator.onLine){setCached(true);loadingRef.current=false;return;}}
  else if(!quiet)setLoading(true);if(!quiet)setError("");
  try{
   const res=await db().from("loyalty_memberships").select("*,businesses(*)")
    .eq("customer_id",account.user.id).order("created_at",{ascending:false}).limit(500);
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
   if(complete.length!==rows.length&&saved?.id===account.user.id)throw Error("Tarjetas incompletas");
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
    if((p.error||m.error||ms.error)&&saved?.id===account.user.id)throw Error("Tarjetas no actualizadas");
    setPrograms((p.data||[]) as Program[]);
    setMovements((m.data||[]) as Movement[]);
    const md:Record<string,MilestoneDetails>=Object.fromEntries(((ms.data||[]) as {membership_id:string;details:MilestoneDetails}[]).map(x=>[x.membership_id,x.details]));setMilestones(md);
    if(!p.error&&!m.error&&!ms.error&&complete.length===rows.length)saveCards({id:account.user.id,at:Date.now(),cards:complete,programs:(p.data||[]) as Program[],milestones:md,movements:(m.data||[]) as Movement[]});
    if(p.error||m.error)setError("Algunas operaciones no están disponibles. Puedes actualizar para intentarlo de nuevo.");
   }else{
    setPrograms([]);setMovements([]);setMilestones({});if(!rows.length)saveCards({id:account.user.id,at:Date.now(),cards:[],programs:[]});
   }
   setCached(false);
  }catch{
   if(quiet)return;
   if(saved?.id===account.user.id){setCards(saved.cards);setPrograms(saved.programs);setMilestones(saved.milestones||{});setMovements(saved.movements||[]);setCached(true);return;}
   setError("No hemos podido cargar tus tarjetas. Comprueba la conexión e inténtalo de nuevo.");
   setCards([]);setPrograms([]);setMovements([]);
  }finally{loadingRef.current=false;setLoading(false);}
 },[account.user.id]);
 useEffect(()=>{load();const refresh=()=>{void load()};window.addEventListener("online",refresh);window.addEventListener("offline",refresh);return()=>{window.removeEventListener("online",refresh);window.removeEventListener("offline",refresh)}},[load]);
 useEffect(()=>{if(!cached)return;const timer=window.setInterval(()=>{if(navigator.onLine&&document.visibilityState!=="hidden")void load()},15000);return()=>window.clearInterval(timer)},[cached,load]);
 useLiveCardBalances(account.user.id,!loading&&!cached,async rows=>{if(cardStateChanged(cards,rows))await load(true);});
 const updateDisplay=useCallback((id:string,patch:Partial<Pick<Membership,"customer_favorite"|"customer_hidden">>)=>{
  setCards(prev=>prev.map(c=>c.id===id?{...c,...patch}:c));
  const saved=offlineCards();if(saved?.id===account.user.id)saveCards({...saved,cards:saved.cards.map(c=>c.id===id?{...c,...patch}:c)});
  if(patch.customer_hidden!==undefined)setNotice(patch.customer_hidden?"Tarjeta retirada. Tu saldo y premios se conservan.":"Tarjeta recuperada. Tu saldo y premios siguen intactos.");
 },[account.user.id]);
 useEffect(()=>{const listener=(event:Event)=>{const {id,...patch}=(event as CustomEvent<{id:string;customer_favorite?:boolean;customer_hidden?:boolean}>).detail;updateDisplay(id,patch);};window.addEventListener("kreyvi:card-display-changed",listener);return()=>window.removeEventListener("kreyvi:card-display-changed",listener);},[updateDisplay]);
 useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(""),3500);return()=>clearTimeout(timer);},[notice]);
 const visibleCards=visibleWalletCards(cards),hiddenCards=cards.filter(c=>c.customer_hidden);
 const hiddenMembership=hiddenCards.find(c=>c.id===hiddenOpen);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get("card");if(id&&cards.some(c=>c.id===id&&c.customer_hidden))setHiddenOpen(id);},[cards]);
 async function restore(id:string){
  if(restoring)return;setRestoring(id);setError("");setNotice("");
  try{const r=await db().rpc("customer_set_card_display",{p_membership:id,p_favorite:null,p_hidden:false});if(r.error)throw r.error;updateDisplay(id,{customer_hidden:false});}
  catch(e){setError((e as Error).message);}finally{setRestoring(null);}
 }
 const prog=(id:string)=>programs.find(x=>x.business_id===id);
 const readyRewards=visibleCards.filter(c=>prog(c.business_id)&&c.balance>=(prog(c.business_id)?.reward_cost||Infinity)).length;
 const firstName=String(account.user.user_metadata?.full_name||"").trim().split(/\s+/)[0];
 // La recompensa destacada sólo aparece cuando existe progreso real y relevante.
 const rewardCards=visibleCards.filter(c=>{const p=prog(c.business_id);return p?.type==="stamps"&&p.reward_cost>0&&c.balance>0&&(c.balance>=Math.ceil(p.reward_cost*.7)||Number(c.total_earned||0)>=p.reward_cost);});
 const closest=rewardCards.sort((a,b)=>{
  const pa=prog(a.business_id)!,pb=prog(b.business_id)!;
  return Math.max(0,pa.reward_cost-a.balance)-Math.max(0,pb.reward_cost-b.balance);
 })[0];
 const closestProgram=closest?prog(closest.business_id):undefined;
 const remaining=closest&&closestProgram?Math.max(0,closestProgram.reward_cost-closest.balance):0;
 if(cached)return <CachedCustomerSpace embedded/>;
 return <div className="customer-first-layout">
  <div className="customer-home-greeting customer-list-heading customer-home-compact">
   <div><h2>Hola{firstName?", "+firstName:""}<span className="customer-greeting-dot">.</span></h2>{readyRewards>0&&<p>{readyRewards} {readyRewards===1?"premio disponible":"premios disponibles"}</p>}</div>
   <Link href="/app/descubrir"><Plus size={16}/> Explorar</Link>
  </div>
  {error&&<div className="alert error" role="alert">{error} <button type="button" className="inline-action" onClick={()=>void load()}>Reintentar</button> · <a href="/offline">Ver tarjetas guardadas</a></div>}
  {notice&&<p className="customer-display-notice" role="status">{notice}</p>}
  {loading?<KreyviLoading compact label="Cargando tus tarjetas"/>:visibleCards.length===0?<div className="empty-state"><div className="empty-symbol"><Compass size={28}/></div><h3>{hiddenCards.length?"No tienes tarjetas visibles":"Aún no tienes tarjetas"}</h3><p>{hiddenCards.length?"Puedes recuperar tus tarjetas más abajo, sin perder tu saldo.":"Busca un negocio y añade su tarjeta para empezar a acumular recompensas."}</p><Link className="button button-dark" href="/app/descubrir">Buscar negocios <ArrowUpRight size={17}/></Link></div>:<CustomerCardDeck cards={visibleCards} programs={programs} milestones={milestones} offerCounts={offerCounts}/>}
  {!loading&&hiddenCards.length>0&&<details className="customer-hidden-cards"><summary><EyeOff size={16}/> Tarjetas retiradas ({hiddenCards.length})</summary><p>Tu saldo, premios e historial se conservan.</p>{hiddenCards.map(c=><div className="customer-hidden-row" key={c.id}><div><strong>{c.businesses.name}</strong><small>{units(c.balance,prog(c.business_id)?.type,c.businesses.currency)}</small></div><button type="button" className="button button-outline button-sm" disabled={restoring!==null} onClick={()=>void restore(c.id)}><Eye size={16}/> Recuperar</button></div>)}</details>}

  {closest&&closestProgram&&<section className="customer-spotlight" aria-label="Tu próxima recompensa">
   <div className="customer-spotlight-head"><span>{remaining===0?"PREMIO LISTO":remaining===1?"CASI LO TIENES":"SIGUE SUMANDO"}</span><Gift size={21}/></div>
   <h3>{remaining===0?"¡Ya puedes canjear tu premio!":remaining===1?"Te falta solo 1 sello":"Te faltan "+remaining+" sellos"} en {closest.businesses.name}</h3>
   <p>{closestProgram.reward_label}</p>
   <div className="customer-spotlight-foot"><span>{Math.min(closest.balance,closestProgram.reward_cost)}/{closestProgram.reward_cost} sellos</span><Link href={"/app?card="+encodeURIComponent(closest.id)} onClick={()=>window.dispatchEvent(new CustomEvent("kreyv:open-card",{detail:closest.id}))}>Ver tarjeta <ArrowUpRight size={17}/></Link></div>
  </section>}
  {movements.some(m=>visibleCards.some(c=>c.business_id===m.business_id))&&<section className="customer-activity-section" aria-label="Últimos movimientos">
   <h2>Actividad reciente</h2>
   <div className="customer-activity-list">{movements.filter(m=>visibleCards.some(c=>c.business_id===m.business_id)).map(m=><div className="activity-row" key={m.id}><div className={"activity-icon "+(m.kind==="earn"?"positive":"negative")}>{m.kind==="earn"?<Plus size={19}/>:<Gift size={19}/>}</div><div><strong>{cards.find(c=>c.business_id===m.business_id)?.businesses.name||"Negocio"}</strong><span>{m.kind==="earn"?"Compra registrada":m.kind==="redeem"?"Recompensa canjeada":"Corrección de movimiento"} · {dateShort(m.created_at)}</span></div><b className={m.amount_delta>0?"positive-text":"negative-text"}>{m.amount_delta>0?"+":""}{units(m.amount_delta,prog(m.business_id)?.type,cards.find(c=>c.business_id===m.business_id)?.businesses.currency)}</b></div>)}</div>
  </section>}
  {hiddenMembership&&<LoyaltyCard key={hiddenMembership.id} membership={hiddenMembership} business={hiddenMembership.businesses} program={prog(hiddenMembership.business_id)} milestones={milestones[hiddenMembership.id]} autoOpen modalOnly onClose={()=>setHiddenOpen(null)}/>}
 </div>;
}
export default function CustomerPage(){return <AppFrame area="customer" title="Mis tarjetas" subtitle="">{a=><CustomerHome account={a}/>}</AppFrame>}
