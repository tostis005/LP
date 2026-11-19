"use client";
import {QRCodeSVG} from "qrcode.react";
import {StampGrid} from "@/components/StampMarks";

type StampCardProps={
 name:string;color:string;reward:string;total:number;earned:number;
 icon?:string|null;imageUrl?:string|null;logoUrl?:string|null;
 backgroundUrl?:string|null;message?:string|null;qrValue?:string;textColor?:string|null;stampColor?:string|null;locale?:"es"|"en";
};
export function StampCard({name,color,reward,total,earned,icon,imageUrl,logoUrl,backgroundUrl,message,qrValue,textColor,stampColor,locale="es"}:StampCardProps){
 const complete=earned>=total;
 return <div className="stamp-visual-card" style={{backgroundColor:color,color:textColor||"#ffffff",backgroundImage:backgroundUrl?"linear-gradient(120deg,rgba(0,0,0,.3),rgba(0,0,0,.12)),url("+backgroundUrl+")":undefined}}>
  <div className="stamp-visual-head"><span className="stamp-business-logo">{logoUrl?<img src={logoUrl} alt=""/>:name.slice(0,1).toUpperCase()}</span><span className="stamp-visual-pill">{locale==="en"?"REWARDS CLUB":"CLUB DE RECOMPENSAS"}</span></div>
  <div className="stamp-visual-title"><span>{message||(locale==="en"?"GREAT TO SEE YOU AGAIN":"QUÉ BIEN QUE HAS VUELTO")}</span><strong>{name}</strong></div>
  <StampGrid total={total} earned={earned} kind={icon} imageUrl={imageUrl} color={stampColor} locale={locale}/>
  <div className="stamp-visual-footer"><div><strong>{complete?(locale==="en"?"Reward ready!":"¡Premio disponible!"):(locale==="en"?Math.min(earned,total)+" of "+total+" stamps":Math.min(earned,total)+" de "+total+" sellos")}</strong><small className="stamp-reward-name">{reward}</small></div>{qrValue&&<div className="stamp-qr-white" aria-label="Código QR de la tarjeta"><QRCodeSVG value={qrValue} size={69} includeMargin level="M"/></div>}</div>
 </div>;
}
