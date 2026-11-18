"use client";
import {useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {Check, X, Wallet} from "lucide-react";
import type {Business,Program,Membership} from "@/lib/types";
import {initials,units} from "@/lib/format";
export function LoyaltyCard({membership,business,program}:{membership:Membership;business:Business;program?:Program}){
 const [open,setOpen]=useState(false);
 const color=business.accent_color||"#264d3e";
 const qrUrl=(typeof window!=="undefined"?window.location.origin:process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000")+"/t/"+membership.card_token;
 return <><button className="loyalty-card" style={{backgroundColor:color,backgroundImage:business.card_background?"linear-gradient(0deg,rgba(0,0,0,.45),rgba(0,0,0,.10)),url("+business.card_background+")":undefined}} onClick={()=>setOpen(true)}>
  <div className="lc-top"><span className="lc-logo">{business.logo_url?<img src={business.logo_url} alt=""/>:initials(business.name)}</span><span className="lc-chip">LOYALTY CLUB ♡</span></div>
  <div className="lc-middle"><small>{business.card_text||"GRACIAS POR VOLVER"}</small><strong>{business.name}</strong></div>
  <div className="lc-bottom"><span>{units(membership.balance,program?.type)}</span><span className="lc-qr-small">▦</span></div>
 </button>
 {open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(false)}><div className="modal-card qr-modal" onMouseDown={e=>e.stopPropagation()}>
 <button className="modal-close" aria-label="Cerrar" onClick={()=>setOpen(false)}><X size={20}/></button>
 <div className="eyebrow">TU TARJETA PERSONAL</div><h2>{business.name}</h2><p>Enseña este código al empleado cuando compres.</p>
 <div className="qr-box"><QRCodeSVG value={qrUrl} size={220} level="M" includeMargin/></div><strong className="modal-balance">{units(membership.balance,program?.type)}</strong>
 <p className="tiny-note">{program?.type==="cashback"?"Puedes utilizar tu saldo en el establecimiento.":program?.reward_label||"Tu recompensa te espera."}</p>
 <div className="wallet-notice"><Wallet size={18}/> Apple Wallet y Google Wallet estarán disponibles al configurar la emisión oficial de pases.</div>
 </div></div>}
 </>;
}
