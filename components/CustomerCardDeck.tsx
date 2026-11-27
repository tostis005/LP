"use client";
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {ChevronDown,ChevronUp,Gift,ArrowUpRight} from "lucide-react";
import {LoyaltyCard} from "@/components/LoyaltyCard";
import {readableCardText} from "@/lib/customer-card-contrast";
import {logoImageUrl} from "@/lib/asset-images";
import {cardBackgroundUrl} from "@/lib/card-images";
import {emptyMilestones,type MilestoneDetails} from "@/lib/milestones";
import {StampGrid} from "@/components/StampMarks";
import {units} from "@/lib/format";
import {wheelStep,wrapIndex,wheelSlots,wheelTransform,wheelDestination} from "@/lib/customer-wheel";
import type {Business,Membership,Program} from "@/lib/types";
type Card=Membership&{businesses:Business};
type Drag={capture:HTMLElement;id:number;y:number;x:number;start:number;last:number;time:number;velocity:number;moved:boolean};
export function CustomerCardDeck({cards,programs,milestones,offerCounts}:{cards:Card[];programs:Program[];milestones:Record<string,MilestoneDetails>;offerCounts:Record<string,number>}){
 const [position,setPosition]=useState(0),[openId,setOpenId]=useState<string|null>(null),[dragging,setDragging]=useState(false);
 const pos=useRef(0),frame=useRef(0),wheelTimer=useRef<ReturnType<typeof setTimeout>|null>(null),drag=useRef<Drag|null>(null),suppress=useRef(0),stage=useRef<HTMLDivElement>(null),count=cards.length;
 const update=(value:number)=>{pos.current=value;setPosition(value);};
 function cancel(){cancelAnimationFrame(frame.current);if(wheelTimer.current){clearTimeout(wheelTimer.current);wheelTimer.current=null;}}
 function settle(target:number){
  cancel();
  const from=pos.current,delta=target-from;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||Math.abs(delta)<.005){update(wrapIndex(target,count));return;}
  const start=performance.now(),duration=Math.min(950,240+Math.abs(delta)*95);
  const tick=(now:number)=>{const t=Math.min(1,(now-start)/duration);update(from+delta*(1-Math.pow(1-t,3)));if(t<1)frame.current=requestAnimationFrame(tick);else update(wrapIndex(target,count));};
  frame.current=requestAnimationFrame(tick);
 }
 const move=(delta:number)=>{if(count>1)settle(Math.round(pos.current)+delta);};
 const current=count?wrapIndex(Math.round(position),count):0;
 const program=(card:Card)=>programs.find(p=>p.business_id===card.business_id);
 const details=(card:Card)=>milestones[card.id]||emptyMilestones;
 const lastDeepLink=useRef("");
 useEffect(()=>{
  const open=(id:string)=>{const i=cards.findIndex(c=>c.id===id);if(i>=0){cancel();update(i);setOpenId(id);}};
  const id=new URLSearchParams(window.location.search).get("card");if(id&&id!==lastDeepLink.current){lastDeepLink.current=id;open(id);}
  const listener=(e:Event)=>open((e as CustomEvent<string>).detail);
  window.addEventListener("kreyv:open-card",listener);return()=>window.removeEventListener("kreyv:open-card",listener);
 },[cards]);
 useEffect(()=>{
  const node=stage.current;if(!node||count<2)return;
  function onWheel(e:WheelEvent){if(Math.abs(e.deltaY)<Math.abs(e.deltaX))return;e.preventDefault();cancel();const delta=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*node!.clientHeight:e.deltaY;update(pos.current+delta/wheelStep);wheelTimer.current=setTimeout(()=>settle(Math.round(pos.current)),120);}
  node.addEventListener("wheel",onWheel,{passive:false});
  return()=>{node.removeEventListener("wheel",onWheel);cancel();};
 },[count]);
 function pointerDown(e:ReactPointerEvent<HTMLDivElement>){
  if(count<2||!e.isPrimary||(e.pointerType==="mouse"&&e.button!==0))return;
  cancel();suppress.current=0;
  // Capture on the pressed card (not the stage) so taps still activate the button.
  const capture=(e.target instanceof Element?e.target.closest<HTMLButtonElement>(".customer-wallet-tab"):null)||e.currentTarget;
  drag.current={capture,id:e.pointerId,x:e.clientX,y:e.clientY,start:pos.current,last:e.clientY,time:performance.now(),velocity:0,moved:false};
  capture.setPointerCapture(e.pointerId);
 }
 function pointerMove(e:ReactPointerEvent<HTMLDivElement>){
  const d=drag.current;if(!d||d.id!==e.pointerId)return;
  const dy=e.clientY-d.y,dx=e.clientX-d.x;
  if(!d.moved){if(Math.abs(dy)<5||Math.abs(dy)<Math.abs(dx))return;d.moved=true;setDragging(true);
   // The pressed card can leave the rendered wheel during a long drag.
   if(d.capture!==e.currentTarget){d.capture=e.currentTarget;d.capture.setPointerCapture(e.pointerId);}}
  if(e.cancelable)e.preventDefault();
  const now=performance.now(),elapsed=Math.max(8,now-d.time),v=-(e.clientY-d.last)/wheelStep/elapsed;
  d.velocity=d.velocity*.55+v*.45;d.last=e.clientY;d.time=now;
  update(d.start-dy/wheelStep);
 }
 function pointerEnd(e:ReactPointerEvent<HTMLDivElement>,cancelled=false){
  const d=drag.current;if(!d||d.id!==e.pointerId)return;
  drag.current=null;setDragging(false);
  if(d.capture.hasPointerCapture(e.pointerId))d.capture.releasePointerCapture(e.pointerId);
  if(d.moved){suppress.current=Date.now()+350;const velocity=cancelled||performance.now()-d.time>110?0:d.velocity;settle(wheelDestination(pos.current,velocity));}
 }
 function open(card:Card){cancel();update(cards.findIndex(c=>c.id===card.id));setOpenId(card.id);}
 const selected=cards.find(c=>c.id===openId);
 return <section className="customer-wallet-deck" aria-label="Rueda vertical de tarjetas">
  <div className="customer-wallet-controls"><span aria-live={dragging?"off":"polite"}>{current+1} de {count} tarjetas</span><div><button type="button" aria-label="Tarjeta anterior" onClick={()=>move(-1)} disabled={count<2}><ChevronUp size={21}/></button><button type="button" aria-label="Siguiente tarjeta" onClick={()=>move(1)} disabled={count<2}><ChevronDown size={21}/></button></div></div>
  <div ref={stage} className={"customer-wallet-stack"+(dragging?" is-dragging":"")+(count===1?" is-single":"")} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={e=>pointerEnd(e)} onPointerCancel={e=>pointerEnd(e,true)} onLostPointerCapture={e=>{if(drag.current?.capture===e.target)pointerEnd(e,true);}} onDragStart={e=>e.preventDefault()} onClickCapture={e=>{if(e.detail!==0&&Date.now()<suppress.current){e.preventDefault();e.stopPropagation();}}} onKeyDown={e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();move(e.key==="ArrowDown"?1:-1);}}}>
   {wheelSlots(position,count).map(({index,offset})=>{
    const card=cards[index],b=card.businesses,p=program(card),g=wheelTransform(offset),color=b.accent_color||"#5e1a2b",photo=cardBackgroundUrl(b.card_background);
    const text=readableCardText(color,b.card_text_color||"#fff",!!photo),stamps=p?.type==="stamps";
    return <button type="button" key={card.id} className={"customer-wallet-tab"+(index===current?" is-front":"")+(offset>.55?" is-below":"")} style={{backgroundColor:color,color:text,backgroundImage:photo?(/^\/brand\/card-designs\/(showcase|gallery)-/.test(photo)?"linear-gradient(135deg,#0002,#0001)":"linear-gradient(135deg,#0007,#0004)")+",url("+photo+")":undefined,transform:"translate3d(0,calc(-50% + "+g.y+"px),"+g.z+"px) rotateX("+g.rotate+"deg) scale("+g.scale+")",zIndex:g.layer,opacity:g.opacity}} onClick={()=>open(card)} tabIndex={index===current?0:-1} aria-label={"Abrir tarjeta de "+b.name}>
     <span className="customer-wallet-card-head"><span className="customer-wallet-logo">{b.logo_url?<img src={logoImageUrl(b.logo_url,192)} alt="" draggable={false}/>:<Gift size={22}/>}</span><strong>{b.name}</strong><ArrowUpRight size={19}/></span>
     <div className="customer-wallet-card-body">{stamps&&(p.reward_cost<=12||(p.reward_cost<=30&&details(card).rules.length>0))?<StampGrid total={p.reward_cost} earned={card.balance} kind={b.stamp_icon} imageUrl={b.stamp_image_url} color={b.stamp_color} milestones={details(card).rules}/>:<strong className="customer-wallet-balance">{stamps?Math.min(card.balance,p.reward_cost)+" / "+p.reward_cost+" sellos":units(card.balance,p?.type,b.currency)}</strong>}</div>
     <span className="customer-wallet-card-foot"><span>{p?.reward_label||"Tu próxima recompensa"}</span><img src="/brand/kreyv-pegada-vino-mostaza-claro.svg" alt="Kreyvi" draggable={false}/></span>
     <span className="customer-wallet-lower-label"><span className="customer-wallet-logo">{b.logo_url?<img src={logoImageUrl(b.logo_url,192)} alt="" draggable={false}/>:<Gift size={18}/>}</span><strong>{b.name}</strong><ArrowUpRight size={16}/></span>
    </button>;
   })}
  </div>
  {selected&&<LoyaltyCard key={selected.id} membership={selected} business={selected.businesses} program={program(selected)} offersCount={offerCounts[selected.business_id]||0} milestones={details(selected)} modalOnly autoOpen onClose={()=>setOpenId(null)}/>}
 </section>;
}
