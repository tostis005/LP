"use client";
import {useEffect,useRef,useState} from "react";
import {ChevronDown,ChevronUp,Gift} from "lucide-react";
import {LoyaltyCard} from "@/components/LoyaltyCard";
import {MerchantCard} from "@/components/StampCard";
import {emptyMilestones,type MilestoneDetails} from "@/lib/milestones";
import type {Business,Membership,Program} from "@/lib/types";
type Card=Membership&{businesses:Business};
export function CustomerCardDeck({cards,programs,milestones,offerCounts}:{cards:Card[];programs:Program[];milestones:Record<string,MilestoneDetails>;offerCounts:Record<string,number>}){
 const [index,setIndex]=useState(0),[openId,setOpenId]=useState<string|null>(null);
 const start=useRef<{x:number;y:number}|null>(null),lastSwipe=useRef(0);
 const move=(delta:number)=>setIndex(i=>(i+delta+cards.length)%cards.length);
 const current=((index%cards.length)+cards.length)%cards.length;
 const active=cards[current];
 const program=(card:Card)=>programs.find(p=>p.business_id===card.business_id);
 const details=(card:Card)=>milestones[card.id]||emptyMilestones;
 useEffect(()=>{
  const open=(id:string)=>{const i=cards.findIndex(c=>c.id===id);if(i>=0){setIndex(i);setOpenId(id);}};
  const id=new URLSearchParams(window.location.search).get("card");if(id)open(id);
  const listener=(e:Event)=>open((e as CustomEvent<string>).detail);
  window.addEventListener("kreyv:open-card",listener);return()=>window.removeEventListener("kreyv:open-card",listener);
 },[cards]);
 const selected=cards.find(c=>c.id===openId);
 const previews=Array.from({length:Math.min(cards.length-1,4)},(_,i)=>cards[(current+i+1)%cards.length]);
 function open(card:Card){if(Date.now()-lastSwipe.current<400)return;setIndex(cards.findIndex(c=>c.id===card.id));setOpenId(card.id);}
 return <section className="customer-wallet-deck" aria-label="Carrusel vertical de tarjetas" onKeyDown={e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();move(e.key==="ArrowDown"?1:-1);}}}>
  <div className="customer-wallet-controls"><span aria-live="polite">{current+1} de {cards.length} tarjetas</span><div><button type="button" aria-label="Tarjeta anterior" onClick={()=>move(-1)} disabled={cards.length<2}><ChevronUp size={21}/></button><button type="button" aria-label="Siguiente tarjeta" onClick={()=>move(1)} disabled={cards.length<2}><ChevronDown size={21}/></button></div></div>
  <div className="customer-wallet-stack" onTouchStart={e=>{const t=e.touches[0];start.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{const t=e.changedTouches[0],s=start.current;start.current=null;if(!s||cards.length<2)return;const dy=t.clientY-s.y,dx=t.clientX-s.x;if(Math.abs(dy)>48&&Math.abs(dy)>Math.abs(dx)){lastSwipe.current=Date.now();move(dy<0?1:-1);}}}>
   {previews.map((c,i)=><button type="button" className="customer-wallet-tab" key={c.id} style={{backgroundColor:c.businesses.accent_color||"#5e1a2b",color:c.businesses.card_text_color||"#fff",zIndex:i+1}} onClick={()=>open(c)} aria-label={"Abrir tarjeta de "+c.businesses.name}><span className="customer-wallet-logo">{c.businesses.logo_url?<img src={c.businesses.logo_url} alt=""/>:<Gift size={19}/>}</span><strong>{c.businesses.name}</strong><ChevronDown size={19}/></button>)}
   <div className="customer-wallet-front" style={{zIndex:previews.length+1}}><button type="button" className="customer-wallet-full" onClick={()=>open(active)} aria-label={"Abrir tarjeta de "+active.businesses.name}><MerchantCard business={active.businesses} program={program(active)} balance={active.balance} milestones={details(active).rules}/></button></div>
  </div>
  {selected&&<LoyaltyCard key={selected.id} membership={selected} business={selected.businesses} program={program(selected)} offersCount={offerCounts[selected.business_id]||0} milestones={details(selected)} modalOnly autoOpen onClose={()=>setOpenId(null)}/>}
 </section>;
}
