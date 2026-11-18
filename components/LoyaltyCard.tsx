"use client";
import {useEffect,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {Check, X, Wallet} from "lucide-react";
import type {Business,Program,Membership} from "@/lib/types";
import {initials,units} from "@/lib/format";
import {db} from "@/lib/supabase";
import {StampGrid} from "@/components/StampMarks";
export function LoyaltyCard({membership,business,program}:{membership:Membership;business:Business;program?:Program}){
 const [open,setOpen]=useState(false),[consent,setConsent]=useState(false),[consentBusy,setConsentBusy]=useState(false),[consentError,setConsentError]=useState("");
 useEffect(()=>{if(!open)return;let active=true;
  db().from("marketing_consents").select("opted_in").eq("customer_id",membership.customer_id).eq("business_id",membership.business_id).maybeSingle()
   .then(({data})=>{if(active)setConsent(!!data?.opted_in)});
  return()=>{active=false};
 },[open,membership.customer_id,membership.business_id]);
 async function changeConsent(checked:boolean){setConsentBusy(true);setConsentError("");
  const {error}=await db().rpc("business_upsert_consent",{p_business:membership.business_id,p_opted_in:checked});
  setConsentBusy(false);if(error)setConsentError(error.message);else setConsent(checked)
 }
 const color=business.accent_color||"#264d3e";
 const qrUrl=(typeof window!=="undefined"?window.location.origin:process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000")+"/t/"+membership.card_token;
 return <><button className={"loyalty-card"+(program?.type==="stamps"?" stamp-card-real":"")} style={{backgroundColor:color,backgroundImage:business.card_background?"linear-gradient(0deg,rgba(0,0,0,.45),rgba(0,0,0,.10)),url("+business.card_background+")":undefined}} onClick={()=>setOpen(true)}>
  <div className="lc-top"><span className="lc-logo">{business.logo_url?<img src={business.logo_url} alt=""/>:initials(business.name)}</span><span className="lc-chip">LOYALTY CLUB ♡</span></div>
  <div className="lc-middle"><small>{business.card_text||"GRACIAS POR VOLVER"}</small><strong>{business.name}</strong></div>
  {program?.type==="stamps"&&<StampGrid total={program.reward_cost} earned={membership.balance} kind={business.stamp_icon} imageUrl={business.stamp_image_url} className="lc-stamp-grid"/>}
  <div className="lc-bottom"><span>{units(membership.balance,program?.type)}{program?.type==="stamps"?" · "+program.reward_cost+" para canjear":""}</span><span className="lc-qr-small">▦</span></div>
 </button>
 {open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(false)}><div className="modal-card qr-modal" onMouseDown={e=>e.stopPropagation()}>
 <button className="modal-close" aria-label="Cerrar" onClick={()=>setOpen(false)}><X size={20}/></button>
 <div className="eyebrow">TU TARJETA PERSONAL</div><h2>{business.name}</h2><p>Enseña este código al empleado cuando compres.</p>
 <div className="qr-box"><QRCodeSVG value={qrUrl} size={220} level="M" includeMargin/></div><strong className="modal-balance">{units(membership.balance,program?.type)}</strong>
 <p className="tiny-note">{program?.type==="cashback"?"Puedes utilizar tu saldo en el establecimiento.":program?.reward_label||"Tu recompensa te espera."}</p>
 <div className="wallet-notice"><Wallet size={18}/> Apple Wallet y Google Wallet estarán disponibles al configurar la emisión oficial de pases.</div>
 <div className="check-control modal-consent"><input type="checkbox" id={"business-marketing-"+membership.id} checked={consent} disabled={consentBusy} onChange={e=>changeConsent(e.target.checked)}/>
 <label htmlFor={"business-marketing-"+membership.id}><strong>Quiero recibir novedades de {business.name}</strong><small>Consentimiento independiente y revocable en cualquier momento. Por ahora no se envían campañas.</small></label></div>
 {consentError&&<div className="alert error">{consentError}</div>}
 </div></div>}
 </>;
}
