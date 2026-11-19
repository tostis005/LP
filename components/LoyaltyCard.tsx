"use client";
import {useEffect,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {Download, X, Smartphone, Wallet, CheckCircle2} from "lucide-react";
import type {Business,Program,Membership} from "@/lib/types";
import {initials,units} from "@/lib/format";
import {db} from "@/lib/supabase";
import {StampGrid} from "@/components/StampMarks";
import {STAMP_DRAWINGS,DEFAULT_STAMP,type StampKind} from "@/lib/stamp-drawings";
export function LoyaltyCard({membership,business,program}:{membership:Membership;business:Business;program?:Program}){
 const [open,setOpen]=useState(false),[waConsent,setWaConsent]=useState(false),[wallets,setWallets]=useState({apple:false,google:false}),[consent,setConsent]=useState(false),[consentBusy,setConsentBusy]=useState(false),[consentError,setConsentError]=useState(""),[voucher,setVoucher]=useState<{token:string;reward_label:string}|null>(null);
 useEffect(()=>{if(!open)return;let active=true;
  fetch("/api/local/wallet/status",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>{if(active&&v)setWallets({apple:v.apple===true,google:v.google===true})}).catch(()=>{});
  db().from("reward_vouchers").select("token,reward_label").eq("membership_id",membership.id).eq("status","issued").maybeSingle().then(({data})=>{if(active)setVoucher(data as {token:string;reward_label:string}|null)});
  db().from("marketing_consents").select("opted_in,whatsapp_opted_in").eq("customer_id",membership.customer_id).eq("business_id",membership.business_id).maybeSingle()
   .then(({data})=>{if(active){setConsent(!!data?.opted_in);setWaConsent(!!data?.whatsapp_opted_in)}});
  return()=>{active=false};
 },[open,membership.customer_id,membership.business_id]);
 async function changeConsent(checked:boolean){setConsentBusy(true);setConsentError("");
  const {error}=await db().rpc("business_upsert_consent",{p_business:membership.business_id,p_opted_in:checked});
  setConsentBusy(false);if(error)setConsentError(error.message);else setConsent(checked)
 }
 async function changeWaConsent(checked:boolean){
  setConsentBusy(true);setConsentError("");
  const {error}=await db().rpc("business_upsert_whatsapp_consent",{p_business:membership.business_id,p_opted_in:checked});
  setConsentBusy(false);
  if(error)setConsentError(error.message);else setWaConsent(checked);
 }
 function downloadCard(){
  const qr=document.querySelector('[data-card-qr="'+membership.id+'"] svg');
  if(!qr)return;
  const escaped=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const bg=/^#[a-fA-F0-9]{6}$/.test(business.accent_color)?business.accent_color:"#571c32";
  const stampInk=/^#[a-fA-F0-9]{6}$/.test(business.stamp_color||"")?business.stamp_color!:"#571c32";
  const name=escaped(business.name.slice(0,70));
  const reward=escaped((program?.reward_label||"Tu próxima recompensa").slice(0,90));
  const balance=escaped(units(membership.balance,program?.type));
  const progress=program?.type==="stamps"?" / "+Math.max(1,program.reward_cost)+" sellos":"";
  const qrSvg=new XMLSerializer().serializeToString(qr);
  const key=(business.stamp_icon&&Object.prototype.hasOwnProperty.call(STAMP_DRAWINGS,business.stamp_icon)?business.stamp_icon:DEFAULT_STAMP) as StampKind;
  const stampCount=program?.type==="stamps"?Math.min(30,Math.max(1,program.reward_cost)):0;
  const filledCount=Math.min(stampCount,Math.max(0,membership.balance));
  const slots=Array.from({length:stampCount},(_,i)=>{
   const x=55+(i%9)*49,y=320+Math.floor(i/9)*34;
   return '<circle cx="'+(x+15)+'" cy="'+(y+15)+'" r="15" stroke="#ffffff" stroke-opacity=".8" stroke-width="1.6" fill="'+(i<filledCount?"#ffffff":"none")+'"/>'+
    (i<filledCount?'<svg xmlns="http://www.w3.org/2000/svg" x="'+(x+3)+'" y="'+(y+3)+'" width="24" height="24" viewBox="0 0 64 64" fill="none" stroke="'+stampInk+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+STAMP_DRAWINGS[key]+'</svg>':"");
  }).join("");
  const graphic='<svg xmlns="http://www.w3.org/2000/svg" width="860" height="500" viewBox="0 0 860 500">'+
   '<rect width="860" height="500" rx="28" fill="'+bg+'"/>'+
   '<circle cx="820" cy="-20" r="260" fill="#ffffff" opacity=".07"/>'+
   '<text x="55" y="84" font-size="22" font-family="Arial,sans-serif" fill="#ffffff" opacity=".85">LOYALLY · MI TARJETA</text>'+
   '<text x="55" y="164" font-size="43" font-weight="bold" font-family="Arial,sans-serif" fill="#ffffff">'+name+'</text>'+
   '<text x="55" y="222" font-size="24" font-family="Arial,sans-serif" fill="#ffffff">'+reward+'</text>'+
   '<text x="55" y="300" font-size="29" font-weight="bold" font-family="Arial,sans-serif" fill="#ffffff">'+balance+progress+'</text>'+
   slots+'<text x="55" y="472" font-size="18" font-family="Arial,sans-serif" fill="#ffffff">Enséñala en tu próxima visita</text>'+
   '<rect x="565" y="167" width="249" height="249" rx="14" fill="#ffffff"/>'+
   '<g transform="translate(579 181)">'+qrSvg+'</g></svg>';
  const url=URL.createObjectURL(new Blob([graphic],{type:"image/svg+xml;charset=utf-8"}));
  const link=document.createElement("a");
  link.href=url;link.download="tarjeta-"+(business.slug||"loyally").replace(/[^a-z0-9-]/gi,"-")+".svg";
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1200);
 }
 const color=business.accent_color||"#571c32";
 const origin=typeof window!=="undefined"?window.location.origin:process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000";
 const qrUrl=origin+"/t/"+membership.card_token;
 const rewardQrUrl=voucher?origin+"/p/"+voucher.token:"";
 return <><button className={"loyalty-card"+(program?.type==="stamps"?" stamp-card-real":"")+(program?.type==="stamps"&&program.reward_cost>=21?" is-very-dense":program?.type==="stamps"&&program.reward_cost>12?" is-dense":"")} style={{backgroundColor:color,color:business.card_text_color||"#ffffff",backgroundImage:business.card_background?"linear-gradient(0deg,rgba(0,0,0,.45),rgba(0,0,0,.10)),url("+business.card_background+")":undefined}} onClick={()=>setOpen(true)}>
  <div className="lc-top"><span className="lc-logo">{business.logo_url?<img src={business.logo_url} alt=""/>:initials(business.name)}</span><span className="lc-chip">LOYALTY CLUB ♡</span></div>
  <div className="lc-middle"><small>{business.card_text||"GRACIAS POR VOLVER"}</small><strong>{business.name}</strong><span className="lc-reward-label">{program?.reward_label||"Tu próxima recompensa"}</span></div>
  {program?.type==="stamps"&&<StampGrid total={program.reward_cost} earned={membership.balance} kind={business.stamp_icon} imageUrl={business.stamp_image_url} color={business.stamp_color} className="lc-stamp-grid"/>}
  <div className="lc-bottom"><span>{units(membership.balance,program?.type)}{program?.type==="stamps"?" · "+program.reward_cost+" para canjear":""}</span><span className="lc-qr-small lc-qr-live"><QRCodeSVG value={qrUrl} size={44} level="M" includeMargin/></span></div>
 </button>
 {open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(false)}><div className="modal-card qr-modal" onMouseDown={e=>e.stopPropagation()}>
 <button className="modal-close" aria-label="Cerrar" onClick={()=>setOpen(false)}><X size={20}/></button>
 <div className="eyebrow">TU TARJETA PERSONAL</div><h2>{business.name}</h2><p>Enseña este código al empleado cuando compres.</p>
 <div className="qr-box" data-card-qr={membership.id}><QRCodeSVG value={qrUrl} size={220} level="M" includeMargin/></div>
 <button type="button" className="button button-outline download-card-action" onClick={downloadCard}><Download size={17}/> Descargar mi tarjeta</button>
 {(wallets.apple||wallets.google)&&<div className="wallet-actions" aria-label="Guardar tarjeta en Wallet">
  {wallets.apple&&<a className="wallet-action-button apple" href={"/api/local/wallet/apple?card="+encodeURIComponent(membership.id)}><Wallet size={19}/> Añadir a Apple Wallet</a>}
  {wallets.google&&<a className="wallet-action-button google" href={"/api/local/wallet/google?card="+encodeURIComponent(membership.id)}><Wallet size={19}/> Añadir a Google Wallet</a>}
 </div>}
 {!wallets.apple&&!wallets.google&&<p className="wallet-unavailable"><Smartphone size={15}/> Puedes llevar tu tarjeta en la app de Loyally. La incorporación a Apple Wallet y Google Wallet se habilitará próximamente.</p>}<strong className="modal-balance">{units(membership.balance,program?.type)}</strong>
 <p className="tiny-note">{program?.type==="cashback"?"Puedes utilizar tu saldo en el establecimiento.":program?.reward_label||"Tu recompensa te espera."}</p>
 {voucher&&<div className="reward-claim-panel"><div className="eyebrow">¡PREMIO DESBLOQUEADO!</div><strong>{voucher.reward_label}</strong><p>Enseña este segundo QR en el comercio. Solo se puede canjear una vez.</p><div className="qr-box"><QRCodeSVG value={rewardQrUrl} size={190} level="M" includeMargin/></div></div>}
 <details className="loyalty-card-preferences"><summary>Preferencias de mensajes de este negocio</summary>
 <div className="check-control modal-consent"><input type="checkbox" id={"business-marketing-"+membership.id} checked={consent} disabled={consentBusy} onChange={e=>changeConsent(e.target.checked)}/>
 <label htmlFor={"business-marketing-"+membership.id}><strong>Quiero recibir ofertas y novedades de {business.name}</strong><small>Es opcional, y puedes cambiarlo cuando quieras. Los avisos relacionados con tus premios son distintos de la publicidad.</small></label></div>
 <div className="check-control modal-consent"><input type="checkbox" id={"whatsapp-marketing-"+membership.id} checked={waConsent} disabled={consentBusy} onChange={e=>changeWaConsent(e.target.checked)}/>
 <label htmlFor={"whatsapp-marketing-"+membership.id}><strong>Quiero recibir ofertas por WhatsApp de {business.name}</strong><small>Opcional e independiente del correo. Necesitas añadir tu teléfono en Mi perfil. Puedes retirar el permiso en cualquier momento.</small></label></div>
 </details>
 {consentError&&<div className="alert error">{consentError}</div>}
 </div></div>}
 </>;
}
