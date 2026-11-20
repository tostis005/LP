"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {Download, X, Wallet} from "lucide-react";
import type {Business,Program,Membership} from "@/lib/types";
import {initials,units} from "@/lib/format";
import {db} from "@/lib/supabase";
import {StampGrid} from "@/components/StampMarks";
import {WalletActions} from "@/components/WalletActions";
export function LoyaltyCard({membership,business,program}:{membership:Membership;business:Business;program?:Program}){
 const [open,setOpen]=useState(false),[wallets,setWallets]=useState({apple:false,google:false}),[consentError,setConsentError]=useState(""),[voucher,setVoucher]=useState<{token:string;reward_label:string}|null>(null);
 useEffect(()=>{if(!open)return;let active=true;
  fetch("/api/local/wallet/status",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>{if(active&&v)setWallets({apple:v.apple===true,google:v.google===true})}).catch(()=>{});
  db().from("reward_vouchers").select("token,reward_label").eq("membership_id",membership.id).eq("status","issued").maybeSingle().then(({data})=>{if(active)setVoucher(data as {token:string;reward_label:string}|null)});
  return()=>{active=false};
 },[open,membership.id]);
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
   ctx.fillStyle="#ffffff";ctx.font="bold 35px Arial,sans-serif";ctx.fillText("KREYV",118,146);
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
   ctx.font="20px Arial,sans-serif";ctx.fillText("El saldo y los sellos se consultan actualizados en Kreyv",540,1132);
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
 const origin=typeof window!=="undefined"?window.location.origin:process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000";
 const qrUrl=origin+"/t/"+membership.card_token;
 const rewardQrUrl=voucher?origin+"/p/"+voucher.token:"";
 return <><div className="loyalty-card-item"><button className={"loyalty-card"+(program?.type==="stamps"?" stamp-card-real":"")+(program?.type==="stamps"&&program.reward_cost>=21?" is-very-dense":program?.type==="stamps"&&program.reward_cost>12?" is-dense":"")} style={{backgroundColor:color,color:business.card_text_color||"#ffffff",backgroundImage:business.card_background?"linear-gradient(0deg,rgba(0,0,0,.45),rgba(0,0,0,.10)),url("+business.card_background+")":undefined}} onClick={()=>setOpen(true)}>
  <div className="lc-top"><span className="lc-logo">{business.logo_url?<img src={business.logo_url} alt=""/>:initials(business.name)}</span><span className="lc-chip">KREYV ♡</span></div>
  <div className="lc-middle"><small>{business.card_text||"GRACIAS POR VOLVER"}</small><strong>{business.name}</strong><span className="lc-reward-label">{program?.reward_label||"Tu próxima recompensa"}</span></div>
  {program?.type==="stamps"&&<StampGrid total={program.reward_cost} earned={membership.balance} kind={business.stamp_icon} imageUrl={business.stamp_image_url} color={business.stamp_color} className="lc-stamp-grid"/>}
  <div className="lc-bottom"><span>{units(membership.balance,program?.type,business.currency)}{program?.type==="stamps"?" · "+program.reward_cost+" para canjear":""}</span><span className="lc-qr-small lc-qr-live"><QRCodeSVG value={qrUrl} size={44} level="M" includeMargin/></span></div>
 </button>
 <button type="button" className="loyalty-wallet-open" onClick={()=>setOpen(true)}><Wallet size={17}/> Ver tarjeta y QR</button>
 </div>
 {open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(false)}><div className="modal-card qr-modal" onMouseDown={e=>e.stopPropagation()}>
 <button className="modal-close" aria-label="Cerrar" onClick={()=>setOpen(false)}><X size={20}/></button>
 <div className="eyebrow">MI TARJETA</div><h2>{business.name}</h2>
 <div className="loyally-modal-card-preview" style={{backgroundColor:color,color:business.card_text_color||"#ffffff"}}>
  <div className="loyally-modal-card-top"><span>{business.name}</span><span>KREYV</span></div>
  <strong>{program?.reward_label||"Mis recompensas"}</strong>
  {program?.type==="stamps"&&<StampGrid total={program.reward_cost} earned={membership.balance}
   kind={business.stamp_icon} imageUrl={business.stamp_image_url} color={business.stamp_color} className="lc-stamp-grid"/>}
  <small>{units(membership.balance,program?.type,business.currency)}{program?.type==="stamps"?" de "+program.reward_cost+" sellos":""}</small>
 </div>
 <p>Enseña este QR en el establecimiento.</p>
 <div className="qr-box" data-card-qr={membership.id}><QRCodeSVG value={qrUrl} size={220} level="M" includeMargin/></div>
 <div className="lp-wallet-intro"><h3>Guarda tu tarjeta</h3></div>
 <WalletActions cardId={membership.id} available={wallets}/>
 <button type="button" className="button button-outline download-card-action" onClick={downloadCard}><Download size={17}/> Guardar imagen con QR</button>
 <p className="tiny-note">{program?.type==="cashback"?"Puedes utilizar tu saldo en el establecimiento.":program?.reward_label||"Tu recompensa te espera."}</p>
 {voucher&&<div className="reward-claim-panel"><div className="eyebrow">¡PREMIO DESBLOQUEADO!</div><strong>{voucher.reward_label}</strong><p>Enseña este segundo QR en el comercio. Solo se puede canjear una vez.</p><div className="qr-box"><QRCodeSVG value={rewardQrUrl} size={190} level="M" includeMargin/></div></div>}
 <Link className="button button-outline button-full" href="/app/ajustes" onClick={()=>setOpen(false)}>Configurar notificaciones de esta tarjeta</Link>
 {consentError&&<div className="alert error">{consentError}</div>}
 </div></div>}
 </>;
}
