"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {Download, Maximize2, QrCode, X} from "lucide-react";
import type {Business,Program,Membership} from "@/lib/types";
import {dateShort,initials,units} from "@/lib/format";
import {db} from "@/lib/supabase";
import {StampGrid} from "@/components/StampMarks";
import {readableCardText} from "@/lib/customer-card-contrast";
import {cardBackgroundUrl} from "@/lib/card-images";
import {logoImageUrl} from "@/lib/asset-images";
export function LoyaltyCard({membership,business,program,offersCount=0,compact=false,autoOpen=false,modalOnly=false,onClose}:{membership:Membership;business:Business;program?:Program;offersCount?:number;compact?:boolean;autoOpen?:boolean;modalOnly?:boolean;onClose?:()=>void}){
 const [open,setOpen]=useState(autoOpen),[consentError,setConsentError]=useState(""),[voucher,setVoucher]=useState<{token:string;reward_label:string}|null>(null);
 const [expandedQr,setExpandedQr]=useState<"card"|"reward"|null>(null);
 const [visits,setVisits]=useState<{id:string;kind:string;amount_delta:number;created_at:string}[]>([]);
 const qrCloseRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  let live=true;
  db().from("loyalty_transactions").select("id,kind,amount_delta,created_at")
   .eq("membership_id",membership.id).order("created_at",{ascending:false}).limit(8)
   .then(({data})=>{if(live)setVisits((data||[]) as {id:string;kind:string;amount_delta:number;created_at:string}[])})
   .catch(()=>{if(live)setVisits([])});
  return()=>{live=false};
 },[open,membership.id]);

 useEffect(()=>{
  // Solo se abre la tarjeta cuya membresía pertenece al usuario y aparece en su listado.
  if(new URLSearchParams(window.location.search).get("card")===membership.id)setOpen(true);
 },[membership.id]);
 useEffect(()=>{
  const onOpen=(event:Event)=>{if((event as CustomEvent<string>).detail===membership.id)setOpen(true)};
  window.addEventListener("kreyv:open-card",onOpen);
  return()=>window.removeEventListener("kreyv:open-card",onOpen);
 },[membership.id]);
 useEffect(()=>{if(!open)return;let active=true;
  db().from("reward_vouchers").select("token,reward_label").eq("membership_id",membership.id).eq("status","issued").maybeSingle().then(({data})=>{if(active)setVoucher(data as {token:string;reward_label:string}|null)});
  return()=>{active=false};
 },[open,membership.id]);
 useEffect(()=>{
  if(!expandedQr)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  qrCloseRef.current?.focus();
  const onEscape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();setExpandedQr(null)}};
  window.addEventListener("keydown",onEscape);
  return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener("keydown",onEscape)};
 },[expandedQr]);
 function closeCard(){
  setExpandedQr(null);setOpen(false);onClose?.();
  const url=new URL(window.location.href);
  if(url.pathname==="/app"&&url.searchParams.get("card")===membership.id){
   url.searchParams.delete("card");
   window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
  }
 }
 async function downloadCard(){
  const qr=document.querySelector('[data-card-qr="'+membership.id+'"] svg');
  if(!qr){setConsentError("No se pudo preparar el QR de esta tarjeta.");return}
  const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1270;
  const context=canvas.getContext("2d");if(!context){setConsentError("El navegador no puede crear la imagen.");return}
  const ctx=context,bg=/^#[a-fA-F0-9]{6}$/.test(business.accent_color)?business.accent_color:"#571c32";
  const rounded=(x:number,y:number,w:number,h:number,r:number)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r)};
  try{
   ctx.fillStyle="#fbf6fa";ctx.fillRect(0,0,1080,1270);
   ctx.fillStyle=bg;rounded(64,62,952,1140,40);ctx.fill();
   ctx.fillStyle="rgba(255,255,255,.08)";ctx.beginPath();ctx.arc(960,135,270,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#ffffff";ctx.font="bold 35px Arial,sans-serif";ctx.fillText("KREYVI",118,146);
   ctx.fillStyle="rgba(255,255,255,.80)";ctx.font="bold 20px Arial,sans-serif";ctx.fillText("MI TARJETA DE FIDELIZACIÓN",118,212);
   ctx.fillStyle="#ffffff";ctx.font="bold 59px Arial,sans-serif";ctx.fillText(business.name.slice(0,45),118,316,840);
   ctx.font="29px Arial,sans-serif";ctx.fillText((program?.reward_label||"Mis próximos premios").slice(0,85),118,383,840);
   ctx.fillStyle="#ffffff";rounded(249,438,582,582,24);ctx.fill();
   const svgXml=new XMLSerializer().serializeToString(qr);
   const url=URL.createObjectURL(new Blob([svgXml],{type:"image/svg+xml;charset=utf-8"}));
   try{
    const image=new Image();image.src=url;await image.decode();
    ctx.drawImage(image,282,471,516,516);
   }finally{URL.revokeObjectURL(url)}
   ctx.fillStyle="#ffffff";ctx.textAlign="center";
   ctx.font="bold 27px Arial,sans-serif";ctx.fillText("Enseña tu QR en el establecimiento",540,1091);
   ctx.font="20px Arial,sans-serif";ctx.fillText("El saldo y los sellos se consultan actualizados en KREYVI",540,1132);
   ctx.textAlign="start";
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));
   if(!blob)throw new Error("No se pudo crear la imagen");
   const link=document.createElement("a"),downloadUrl=URL.createObjectURL(blob);
   link.href=downloadUrl;link.download="kreyv-"+(business.slug||"tarjeta").replace(/[^a-z0-9-]/gi,"-")+".png";
   document.body.appendChild(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(downloadUrl),1500);
  }catch{setConsentError("No se pudo guardar la imagen. Puedes seguir utilizando el QR desde la app.");}
 }
 const color=business.accent_color||"#571c32";
 const cardInk=readableCardText(color,business.card_text_color,!!business.card_background);
 const previewInk=readableCardText(color,business.card_text_color);
 const origin=typeof window!=="undefined"?window.location.origin:process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000";
 const qrUrl=origin+"/t/"+membership.card_token;
 const rewardQrUrl=voucher?origin+"/p/"+voucher.token:"";
 return <>{!modalOnly&&<div className={"loyalty-card-item"+(compact?" customer-deck-item":"")}>
 {compact?<button type="button" className="customer-deck-card"
  onClick={()=>setOpen(true)} aria-label={"Ver tarjeta de "+business.name}
  style={{backgroundColor:color,color:cardInk,backgroundImage:business.card_background?"linear-gradient(180deg,rgba(0,0,0,.56),rgba(0,0,0,.54) 55%,rgba(0,0,0,.66)),url("+cardBackgroundUrl(business.card_background,720)+")":undefined}}>
  <span className="customer-deck-top">
   <span className="customer-deck-brand">{business.logo_url?<img src={logoImageUrl(business.logo_url,96)} alt="" loading="lazy" decoding="async"/>:<span>{initials(business.name)}</span>}</span>
   <span className="customer-deck-type">{business.category||"Fidelización"}</span>
   <span className="customer-deck-counter">{program?.type==="stamps"&&program.reward_cost>0?Math.min(membership.balance,program.reward_cost)+"/"+program.reward_cost:units(membership.balance,program?.type,business.currency)}</span>
  </span>
  <span className="customer-deck-name">{business.name}</span>
  <span className="customer-deck-reward">{program?.reward_label||"Tu próxima recompensa"}</span>
  {program?.type==="stamps"&&program.reward_cost>0&&program.reward_cost<=12&&<span className="customer-deck-stamps" aria-hidden="true">{Array.from({length:program.reward_cost},(_,index)=><i key={index} className={index<membership.balance?"earned":""}/>)}</span>}
  {program?.type==="stamps"&&program.reward_cost>0&&<span className="customer-deck-progress"><span style={{width:Math.min(100,Math.max(0,membership.balance/program.reward_cost*100))+"%"}}/></span>}
  <span className="customer-deck-bottom">{program?.type==="stamps"&&program.reward_cost>membership.balance?"Te faltan "+(program.reward_cost-membership.balance)+" sellos":"Ver tarjeta y QR"} <QrCode size={18}/></span>
 </button>:<button className={"loyalty-card loyalty-card-rebalanced"+(program?.type==="stamps"?" stamp-card-real":"")+(program?.type==="stamps"&&program.reward_cost>=21?" is-very-dense":program?.type==="stamps"&&program.reward_cost>12?" is-dense":"")}
  style={{backgroundColor:color,color:cardInk,backgroundImage:business.card_background?"linear-gradient(120deg,rgba(0,0,0,.44),rgba(0,0,0,.20)),url("+cardBackgroundUrl(business.card_background,1200)+")":undefined}}
  type="button" onClick={()=>setOpen(true)} aria-label={"Abrir tarjeta y QR de "+business.name}>
  <div className="lc-card-content">
   <span className="lc-logo">{business.logo_url?<img src={logoImageUrl(business.logo_url,192)} alt="" decoding="async"/>:initials(business.name)}</span>
   <strong className="lc-card-name">{business.name}</strong>
   {program?.type==="stamps"&&<StampGrid total={program.reward_cost} earned={membership.balance}
    kind={business.stamp_icon} imageUrl={business.stamp_image_url} color={business.stamp_color} className="lc-stamp-grid"/>}
   <span className="lc-card-message">{business.card_text||"TARJETA DE FIDELIZACIÓN"}</span>
   <span className="lc-card-balance">{units(membership.balance,program?.type,business.currency)}{program?.type==="stamps"?" de "+program.reward_cost+" sellos":""}</span>
   <span className="lc-card-reward">{program?.reward_label||"Tu próxima recompensa"}</span>
  </div>
  <div className="lc-card-aside">
   <span className="lc-chip">KREYVI</span>
   <span className="lc-qr-large"><QRCodeSVG value={qrUrl} size={240} level="M" includeMargin/></span>
  </div>
 </button>}
 {!compact&&<button type="button" className="loyalty-wallet-open" onClick={()=>setOpen(true)}><QrCode size={17}/> Ver tarjeta y QR</button>}
 {offersCount>0&&<Link className="kreyv-loyalty-offers" href={"/app/novedades?business="+business.id}>Ver ofertas de este negocio ({offersCount})</Link>}
 </div>}
 {open&&<div className="modal-backdrop qr-modal-backdrop" onMouseDown={closeCard}><div className="modal-card qr-modal" role="dialog" aria-modal="true" aria-label={"Tarjeta y QR de "+business.name} onMouseDown={e=>e.stopPropagation()}>
 <button className="modal-close" aria-label="Cerrar" onClick={closeCard}><X size={20}/></button>
 <div className="eyebrow">MI TARJETA</div><h2>{business.name}</h2>
 <div className="loyally-modal-card-preview" style={{backgroundColor:color,color:previewInk}}>
  <div className="loyally-modal-card-top"><span>{business.name}</span><span>KREYVI</span></div>
  <strong>{program?.reward_label||"Mis recompensas"}</strong>
  {program?.type==="stamps"&&<StampGrid total={program.reward_cost} earned={membership.balance}
   kind={business.stamp_icon} imageUrl={business.stamp_image_url} color={business.stamp_color} className="lc-stamp-grid"/>}
  <small>{units(membership.balance,program?.type,business.currency)}{program?.type==="stamps"?" de "+program.reward_cost+" sellos":""}</small>
 </div>
 <div className="customer-card-detail-stats">
  <div><small>Premio</small><strong>{program?.reward_label||"Recompensa"}</strong></div>
  <div><small>Saldo</small><strong>{units(membership.balance,program?.type,business.currency)}</strong></div>
  <div><small>Regla</small><strong>{program?.type==="stamps"?program.reward_cost+" sellos":program?.type==="points"?"Puntos":"Cashback"}</strong></div>
 </div>
 <button type="button" className="customer-show-qr" onClick={()=>setExpandedQr("card")}><QrCode size={20}/> Mostrar mi QR en caja</button>
 <div className="customer-detail-secondary">
  <p>También puedes guardar el QR como imagen.</p>
 </div>
 <button type="button" className="qr-enlarge-button" onClick={()=>setExpandedQr("card")} aria-label={"Ampliar QR de "+business.name}>
  <span className="qr-box" data-card-qr={membership.id}><QRCodeSVG value={qrUrl} size={200} level="M" includeMargin/></span>
  <span className="qr-enlarge-hint"><Maximize2 size={16}/> Toca el QR para ampliarlo</span>
 </button>
 <button type="button" className="button button-outline download-card-action" onClick={downloadCard}><Download size={17}/> Guardar imagen con QR</button>
 <p className="tiny-note">{program?.type==="cashback"?"Puedes utilizar tu saldo en el establecimiento.":program?.reward_label||"Tu recompensa te espera."}</p>
 {voucher&&<div className="reward-claim-panel"><div className="eyebrow">¡PREMIO DESBLOQUEADO!</div><strong>{voucher.reward_label}</strong><p>Enseña este segundo QR en el comercio. Solo se puede canjear una vez.</p><button type="button" className="qr-enlarge-button" onClick={()=>setExpandedQr("reward")} aria-label="Ampliar QR del premio">
  <span className="qr-box"><QRCodeSVG value={rewardQrUrl} size={180} level="M" includeMargin/></span>
  <span className="qr-enlarge-hint"><Maximize2 size={16}/> Ampliar QR del premio</span>
 </button></div>}
 {visits.length>0&&<section className="customer-card-visits"><h3>Tus visitas</h3>
  <div>{visits.map(visit=><div key={visit.id} className="customer-card-visit">
   <span>{visit.kind==="earn"?"Sello o saldo añadido":visit.kind==="redeem"?"Recompensa canjeada":"Movimiento"}</span>
   <span>{dateShort(visit.created_at)}</span>
  </div>)}</div>
 </section>}
 <Link className="button button-outline button-full" href={"/app/ajustes?business="+encodeURIComponent(business.id)} onClick={closeCard}>Gestionar notificaciones de esta tarjeta</Link>
 {consentError&&<div className="alert error">{consentError}</div>}
 </div></div>}
 {open&&expandedQr&&<div className="qr-fullscreen-overlay" onMouseDown={()=>setExpandedQr(null)}>
  <section className="qr-fullscreen-content" role="dialog" aria-modal="true"
   aria-label={expandedQr==="reward"?"QR de canje de "+business.name:"QR de la tarjeta de "+business.name}
   onMouseDown={e=>e.stopPropagation()}>
   <button ref={qrCloseRef} type="button" className="qr-fullscreen-close" onClick={()=>setExpandedQr(null)}>
    <X size={21}/> Cerrar
   </button>
   <div className="qr-fullscreen-heading">
    <span>{expandedQr==="reward"?"TU PREMIO":"TU TARJETA"}</span>
    <strong>{business.name}</strong>
   </div>
   <div className="qr-fullscreen-image">
    <QRCodeSVG value={expandedQr==="reward"?rewardQrUrl:qrUrl} size={480} level="M" includeMargin/>
   </div>
   <p className="qr-fullscreen-help">Muestra este QR al personal para escanearlo.</p>
  </section>
 </div>}
 </>;
}
