"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {Download, Maximize2, QrCode, X, Star, EyeOff, Eye} from "lucide-react";
import type {Business,Program,Membership} from "@/lib/types";
import {money,units} from "@/lib/format";
import {db} from "@/lib/supabase";
import {emptyMilestones,type MilestoneDetails} from "@/lib/milestones";
import {MerchantCard} from "@/components/StampCard";
import {deviceCardQr} from "@/lib/client/device-card-qr";
import {cacheCardDisplay} from "@/lib/client/offline";
export function LoyaltyCard({membership,business,program,offersCount=0,compact=false,autoOpen=false,modalOnly=false,onClose,milestones=emptyMilestones,transitionFrom,transitionTarget}:{membership:Membership;business:Business;program?:Program;offersCount?:number;compact?:boolean;autoOpen?:boolean;modalOnly?:boolean;onClose?:()=>void;milestones?:MilestoneDetails;transitionFrom?:DOMRect;transitionTarget?:()=>HTMLElement|null}){
 const [open,setOpen]=useState(autoOpen),[consentError,setConsentError]=useState(""),[voucher,setVoucher]=useState<{token:string;reward_label:string}|null>(null);
 const [expandedQr,setExpandedQr]=useState<"card"|"reward"|null>(null);
 const [displayBusy,setDisplayBusy]=useState(false),[confirmHide,setConfirmHide]=useState(false);
 const [favorite,setFavorite]=useState(!!membership.customer_favorite),[hidden,setHidden]=useState(!!membership.customer_hidden);
 useEffect(()=>{setFavorite(!!membership.customer_favorite);setHidden(!!membership.customer_hidden);},[membership.id,membership.customer_favorite,membership.customer_hidden]);
 async function changeDisplay(patch:Partial<Pick<Membership,"customer_favorite"|"customer_hidden">>){
  if(displayBusy)return;
  setDisplayBusy(true);setConsentError("");
  try{
   const result=await db().rpc("customer_set_card_display",{p_membership:membership.id,p_favorite:patch.customer_favorite??null,p_hidden:patch.customer_hidden??null});
   if(result.error)throw result.error;
   if(patch.customer_favorite!==undefined)setFavorite(patch.customer_favorite);
   if(patch.customer_hidden!==undefined)setHidden(patch.customer_hidden);
   setConfirmHide(false);cacheCardDisplay(membership.id,patch);
   if(patch.customer_hidden!==undefined)closeCard(true);
   window.dispatchEvent(new CustomEvent("kreyvi:card-display-changed",{detail:{id:membership.id,...patch}}));
  }catch(e){setConsentError((e as Error).message||"No se pudo guardar la preferencia.");}
  finally{setDisplayBusy(false);}
 }
 const [deviceToken,setDeviceToken]=useState<string|null>(null),[deviceQrPending,setDeviceQrPending]=useState(autoOpen);
 useEffect(()=>{
  if(!open)return;
  let live=true;
  setDeviceToken(null);setDeviceQrPending(true);
  const refresh=()=>{void deviceCardQr(membership.id).then(token=>{if(live)setDeviceToken(token);}).catch(()=>{}).finally(()=>{if(live)setDeviceQrPending(false);});};
  const timer=window.setTimeout(()=>{if(live)setDeviceQrPending(false);},2500);
  refresh();window.addEventListener("online",refresh);window.addEventListener("focus",refresh);
  return()=>{live=false;clearTimeout(timer);window.removeEventListener("online",refresh);window.removeEventListener("focus",refresh);};
 },[open,membership.id]);
 type HistoryRow={id:string;kind:string;amount_delta:number;created_at:string;reversed:boolean;reward_label:string|null;purchase_cents:number|null};
 const [visits,setVisits]=useState<HistoryRow[]>([]),[historyPage,setHistoryPage]=useState(0),[historyMore,setHistoryMore]=useState(false),[historyError,setHistoryError]=useState(""),[historyLoading,setHistoryLoading]=useState(false);
 const qrCloseRef=useRef<HTMLButtonElement>(null);
 const detailCloseRef=useRef<HTMLButtonElement>(null),previewRef=useRef<HTMLDivElement>(null),merchantRef=useRef<HTMLDivElement>(null);
 const animationRef=useRef<Animation|null>(null),closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null),closingRef=useRef(false);
 const [closing,setClosing]=useState(false);
 function cardTransform(from:DOMRect,to:DOMRect){
  return "translate("+(from.left-to.left)+"px,"+(from.top-to.top)+"px) scale("+(from.width/to.width)+","+(from.height/to.height)+")";
 }
 function source(){return transitionTarget?.()||merchantRef.current;}
 useLayoutEffect(()=>{
  if(!open)return;
  closingRef.current=false;setClosing(false);
  const preview=previewRef.current,from=transitionFrom||source()?.getBoundingClientRect();
  if(preview&&typeof preview.animate==="function"&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
   const to=preview.getBoundingClientRect();
   const transform=from&&from.width>0&&from.height>0&&to.width>0&&to.height>0?cardTransform(from,to):"translateY(24px) scale(.94)";
   animationRef.current=preview.animate([{transform,transformOrigin:"top left"},{transform:"none",transformOrigin:"top left"}],{duration:330,easing:"cubic-bezier(.22,.75,.25,1)"});
  }
  detailCloseRef.current?.focus({preventScroll:true});
  return()=>{animationRef.current?.cancel();if(closeTimer.current!==null)clearTimeout(closeTimer.current);};
 },[open,membership.id]);
 useEffect(()=>{
  if(!open||expandedQr)return;
  const onEscape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();closeCard();}};
  window.addEventListener("keydown",onEscape);return()=>window.removeEventListener("keydown",onEscape);
 },[open,expandedQr,membership.id]);
 useEffect(()=>{
  if(!open)return;
  let live=true;
  setHistoryLoading(true);setHistoryError("");
  db().rpc("customer_card_history",{p_membership:membership.id,p_limit:21,p_offset:historyPage*20})
   .then(({data,error})=>{if(!live)return;if(error){setHistoryError(error.message);setVisits([]);setHistoryMore(false)}else{const rows=(data||[]) as HistoryRow[];setVisits(rows.slice(0,20));setHistoryMore(rows.length>20)}setHistoryLoading(false)})
   .catch(()=>{if(live){setHistoryError("No se pudo cargar el historial.");setHistoryLoading(false)}});
  return()=>{live=false};
 },[open,membership.id,historyPage]);

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
 function finishClose(){
  setExpandedQr(null);setHistoryPage(0);setOpen(false);setClosing(false);onClose?.();
  const target=source();if(target instanceof HTMLElement){const focusTarget=target.matches("button")?target:target.querySelector("button");focusTarget?.focus({preventScroll:true});}
  const url=new URL(window.location.href);
  if(url.pathname==="/app"&&url.searchParams.get("card")===membership.id){
   url.searchParams.delete("card");
   window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
  }
 }
 function closeCard(immediate=false){
  if(closingRef.current&&!immediate)return;
  if(immediate||window.matchMedia("(prefers-reduced-motion: reduce)").matches){finishClose();return;}
  closingRef.current=true;setClosing(true);
  const preview=previewRef.current,target=source()?.getBoundingClientRect();
  const panel=preview?.closest<HTMLElement>(".customer-card-detail-panel");
  if(panel)panel.scrollTop=0;
  if(preview&&typeof preview.animate==="function"){
   animationRef.current?.cancel();
   const from=preview.getBoundingClientRect();
   const transform=target&&target.width>0&&target.height>0&&from.width>0&&from.height>0?cardTransform(target,from):"translateY(24px) scale(.94)";
   animationRef.current=preview.animate([{transform:"none",transformOrigin:"top left"},{transform,transformOrigin:"top left"}],{duration:240,easing:"cubic-bezier(.4,0,.6,1)",fill:"forwards"});
  }
  closeTimer.current=setTimeout(finishClose,240);
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
   ctx.fillStyle="#ffffff";rounded(249,438,582,582,5);ctx.fill();
   const svgXml=new XMLSerializer().serializeToString(qr);
   const url=URL.createObjectURL(new Blob([svgXml],{type:"image/svg+xml;charset=utf-8"}));
   try{
    const image=new Image();image.src=url;await image.decode();
    ctx.drawImage(image,249,438,582,582);
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
 const origin="https://kreyviapp.com";
 const qrUrl=origin+"/t/"+(deviceToken||membership.card_token);
 const exportQrUrl=origin+"/t/"+membership.card_token;
 const rewardQrUrl=voucher?origin+"/p/"+voucher.token:"";
 const cardVisual=<MerchantCard business={business} program={program} balance={membership.balance} qrValue={qrUrl} milestones={milestones.rules}/>;
 const detailVisual=<MerchantCard business={business} program={program} balance={membership.balance} milestones={milestones.rules}/>;
 return <>{!modalOnly&&<div className={"loyalty-card-item"+(compact?" customer-deck-item":"")}>
 <div className="merchant-card-button" ref={merchantRef}>{cardVisual}<button type="button" className="merchant-card-hitbox" onClick={()=>setOpen(true)} aria-label={"Ver tarjeta de "+business.name}/></div>
 {!compact&&<button type="button" className="loyalty-wallet-open" onClick={()=>setOpen(true)}><QrCode size={17}/> Ver tarjeta y QR</button>}
 {offersCount>0&&<Link className="kreyv-loyalty-offers" href={"/app/novedades?business="+business.id}>Ver ofertas de este negocio ({offersCount})</Link>}
 </div>}
 {open&&<div className={"modal-backdrop qr-modal-backdrop customer-card-detail-backdrop"+(closing?" is-closing":"")} onMouseDown={()=>closeCard()}><div className="modal-card qr-modal customer-card-detail-panel" role="dialog" aria-modal="true" aria-label={"Tarjeta y QR de "+business.name} onMouseDown={e=>e.stopPropagation()}>
 <div className="customer-card-detail-header"><h2>Tu tarjeta</h2><div className="customer-card-header-actions"><button type="button" className={"customer-card-favorite"+(favorite?" is-favorite":"")} disabled={displayBusy||hidden} aria-label={favorite?"Quitar de destacadas":"Destacar tarjeta"} aria-pressed={favorite} title={favorite?"Quitar de destacadas":"Destacar tarjeta"} onClick={()=>void changeDisplay({customer_favorite:!favorite})}><Star size={22} fill={favorite?"currentColor":"none"}/></button><button ref={detailCloseRef} type="button" className="modal-close" aria-label="Cerrar" onClick={()=>closeCard()}><X size={20}/></button></div></div>
 <div ref={previewRef} className="loyally-modal-card-preview merchant-card-detail">{detailVisual}</div>
 <div className="customer-card-detail-body">
 <section className="customer-card-qr-section" aria-label="QR personal">
  <button type="button" className="qr-enlarge-button" disabled={deviceQrPending} onClick={()=>setExpandedQr("card")} aria-label={"Ampliar QR de "+business.name}>
   <span className="qr-box">{deviceQrPending?<span role="status" style={{display:"grid",placeItems:"center",aspectRatio:"1",padding:12}}>Preparando QR…</span>:<QRCodeSVG value={qrUrl} size={200} level="M" marginSize={2}/>}</span>
   <span className="qr-enlarge-hint"><Maximize2 size={16}/> Mostrar mi QR en caja</span>
  </button>
 {/* The export uses a separate standards-compliant QR, not the compact preview. */}
 <span hidden data-card-qr={membership.id}><QRCodeSVG value={exportQrUrl} size={582} level="M" marginSize={4}/></span>
 <button type="button" className="button button-outline download-card-action" onClick={downloadCard}><Download size={17}/> Guardar imagen con QR</button>

 </section>
 {(milestones.rules.length>0||milestones.grants.length>0)&&<details className="customer-card-milestones" open={milestones.grants.some(g=>g.available)||undefined}><summary>Premios intermedios</summary>{milestones.rules.map(r=><p key={r.position}>Sello {r.position} · {r.label}</p>)}{milestones.grants.filter(g=>g.available).map(g=><div key={g.id} className="reward-claim-panel"><strong>{g.label}</strong><p>Premio disponible. Muestra tu QR personal en caja para canjearlo.</p></div>)}{milestones.grants.some(g=>g.redeemed)&&<p className="muted">{milestones.grants.filter(g=>g.redeemed).length} premios intermedios canjeados</p>}</details>}
 {voucher&&<div className="reward-claim-panel"><div className="eyebrow">¡PREMIO DESBLOQUEADO!</div><strong>{voucher.reward_label}</strong><p>Enseña este segundo QR en el comercio. Solo se puede canjear una vez.</p><button type="button" className="qr-enlarge-button" onClick={()=>setExpandedQr("reward")} aria-label="Ampliar QR del premio">
  <span className="qr-box"><QRCodeSVG value={rewardQrUrl} size={180} level="M" marginSize={2}/></span>
  <span className="qr-enlarge-hint"><Maximize2 size={16}/> Ampliar QR del premio</span>
 </button></div>}
 <section className="customer-card-visits"><h3>Historial de movimientos</h3>
  {historyLoading?<p role="status">Cargando historial…</p>:historyError?<p role="alert">{historyError}</p>:visits.length===0?<p className="muted">Aún no hay movimientos.</p>:<div>{visits.map(visit=><div key={visit.id} className="customer-card-visit">
   <span><strong>{visit.kind==="earn"?"Compra registrada":visit.kind==="redeem"?"Recompensa canjeada":"Corrección"}{visit.reversed?" · Revertida":""}</strong><br/>{visit.amount_delta>0?"+":""}{units(visit.amount_delta,program?.type,business.currency)}{visit.reward_label?" · "+visit.reward_label:""}{visit.purchase_cents!=null?" · "+money(visit.purchase_cents,business.currency):""}</span>
   <span>{new Date(visit.created_at).toLocaleString("es-ES",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
  </div>)}</div>}
  {(historyPage>0||historyMore)&&<div className="owner-data-pagination"><button type="button" className="button button-outline button-sm" disabled={historyPage===0||historyLoading} onClick={()=>setHistoryPage(n=>n-1)}>Anterior</button><span>Página {historyPage+1}</span><button type="button" className="button button-outline button-sm" disabled={!historyMore||historyLoading} onClick={()=>setHistoryPage(n=>n+1)}>Siguiente</button></div>}
 </section>
 <Link className="button button-outline button-full" href={"/app/ajustes?business="+encodeURIComponent(business.id)} onClick={()=>closeCard(true)}>Gestionar notificaciones de esta tarjeta</Link>
 <div className="customer-card-visibility">
  {hidden?<button className="button button-outline button-full" disabled={displayBusy} type="button" onClick={()=>void changeDisplay({customer_hidden:false})}><Eye size={18}/> Volver a añadir tarjeta</button>:
   confirmHide?<div className="customer-card-hide-confirm" role="group" aria-label="Confirmar retirar tarjeta"><strong>¿Quitar esta tarjeta de Mis tarjetas?</strong><p>Conservarás tus sellos, puntos, cashback, premios e historial. Puedes recuperarla cuando quieras.</p><div><button type="button" className="button button-outline" disabled={displayBusy} onClick={()=>setConfirmHide(false)}>Cancelar</button><button type="button" className="button button-dark" disabled={displayBusy} onClick={()=>void changeDisplay({customer_hidden:true})}>Quitar tarjeta</button></div></div>:
   <button type="button" className="customer-card-hide-action" disabled={displayBusy} onClick={()=>setConfirmHide(true)}><EyeOff size={18}/> Quitar de Mis tarjetas</button>}
 </div>
 {consentError&&<div className="alert error">{consentError}</div>}
 </div></div></div>}
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
    <QRCodeSVG value={expandedQr==="reward"?rewardQrUrl:qrUrl} size={480} level="M" marginSize={4}/>
   </div>
   <p className="qr-fullscreen-help">Muestra este QR al personal para escanearlo.</p>
  </section>
 </div>}
 </>;
}
