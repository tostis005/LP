"use client";
import {QRCodeSVG} from "qrcode.react";
import {StampGrid} from "@/components/StampMarks";
import {cardBackgroundUrl} from "@/lib/card-images";

type StampCardProps={
 name:string;color:string;reward:string;total:number;earned:number;
 icon?:string|null;imageUrl?:string|null;logoUrl?:string|null;
 backgroundUrl?:string|null;message?:string|null;qrValue?:string;textColor?:string|null;stampColor?:string|null;locale?:"es"|"en";
};
export function StampCard({name,color,reward,total,earned,icon,imageUrl,logoUrl,backgroundUrl,message,qrValue,textColor,stampColor,locale="es"}:StampCardProps){
 const complete=earned>=total;
 return <div className={"stamp-visual-card stamp-visual-rebalanced"+(qrValue?" has-qr":"")+(total>=21?" is-very-dense":total>12?" is-dense":"")}
  style={{backgroundColor:color,color:textColor||"#ffffff",backgroundImage:backgroundUrl?"linear-gradient(120deg,rgba(0,0,0,.44),rgba(0,0,0,.20)),url("+cardBackgroundUrl(backgroundUrl,1200)+")":undefined}}>
  <div className="stamp-visual-main">
   <span className="stamp-business-logo">{logoUrl?<img src={logoUrl} alt=""/>:name.slice(0,1).toUpperCase()}</span>
   <strong className="stamp-visual-name">{name}</strong>
   <StampGrid total={total} earned={earned} kind={icon} imageUrl={imageUrl} color={stampColor} locale={locale}/>
   <span className="stamp-visual-message">{message||(locale==="en"?"GREAT TO SEE YOU AGAIN":"QUÉ BIEN QUE HAS VUELTO")}</span>
   <div className="stamp-visual-footer">
    <strong>{complete?(locale==="en"?"Reward ready!":"¡Premio disponible!"):(locale==="en"?Math.min(earned,total)+" of "+total+" stamps":Math.min(earned,total)+" de "+total+" sellos")}</strong>
    <small className="stamp-reward-name">{reward}</small>
   </div>
  </div>
  <div className="stamp-visual-side">
   <span className="stamp-visual-pill">{locale==="en"?"REWARDS CLUB":"CLUB DE RECOMPENSAS"}</span>
   {qrValue&&<div className="stamp-qr-white" aria-label="Código QR de la tarjeta"><QRCodeSVG value={qrValue} size={240} includeMargin={false} level="M"/></div>}
  </div>
 </div>;
}
