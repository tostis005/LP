"use client";
import {QRCodeSVG} from "qrcode.react";
import {StampGrid} from "@/components/StampMarks";
import {cardBackgroundUrl} from "@/lib/card-images";
import {logoImageUrl} from "@/lib/asset-images";
import {units} from "@/lib/format";
import type {Business,Program} from "@/lib/types";

type StampCardProps={
 name:string;color:string;reward:string;total:number;earned:number;
 balanceLabel?:string;
 icon?:string|null;imageUrl?:string|null;logoUrl?:string|null;logoScale?:number;logoX?:number;logoY?:number;
 backgroundUrl?:string|null;message?:string|null;qrValue?:string;textColor?:string|null;stampColor?:string|null;locale?:"es"|"en";
};
export function StampCard({name,color,reward,total,earned,icon,imageUrl,logoUrl,logoScale=100,logoX=0,logoY=0,backgroundUrl,message,qrValue,textColor,stampColor,balanceLabel,locale="es"}:StampCardProps){
 const complete=earned>=total;
 return <div className={"stamp-visual-card stamp-visual-rebalanced"+(qrValue?" has-qr":"")+(total>=21?" is-very-dense":total>12?" is-dense":"")}
  style={{backgroundColor:color,color:textColor||"#ffffff",backgroundImage:backgroundUrl?"linear-gradient(120deg,rgba(0,0,0,.44),rgba(0,0,0,.20)),url("+cardBackgroundUrl(backgroundUrl,1200)+")":undefined}}>
  <div className="stamp-visual-main">
   <span className="stamp-business-logo">{logoUrl?<img src={logoImageUrl(logoUrl,512)} alt="" decoding="async" style={{transform:`translate(${logoX}%, ${logoY}%) scale(${logoScale/100})`,transformOrigin:"center"}}/>:name.slice(0,1).toUpperCase()}</span>
   <strong className="stamp-visual-name">{name}</strong>
   {balanceLabel===undefined?<StampGrid total={total} earned={earned} kind={icon} imageUrl={imageUrl} color={stampColor} locale={locale}/>:<strong className="merchant-balance">{balanceLabel}</strong>}
   <span className="stamp-visual-message">{message||(locale==="en"?"GREAT TO SEE YOU AGAIN":"QUÉ BIEN QUE HAS VUELTO")}</span>
   <div className="stamp-visual-footer">
    <strong>{balanceLabel!==undefined?(locale==="en"?"Your rewards":"Tus recompensas"):complete?(locale==="en"?"Reward ready!":"¡Premio disponible!"):(locale==="en"?Math.min(earned,total)+" of "+total+" stamps":Math.min(earned,total)+" de "+total+" sellos")}</strong>
    <small className="stamp-reward-name">{reward}</small>
   </div>
  </div>
  <div className="stamp-visual-side">
   <span className="stamp-visual-pill">{locale==="en"?"REWARDS CLUB":"CLUB DE RECOMPENSAS"}</span>
   {qrValue&&<div className="stamp-qr-white" aria-label="Código QR de la tarjeta"><QRCodeSVG value={qrValue} size={240} includeMargin level="M"/></div>}
  </div>
 </div>;
}

/** All business-facing and customer-facing cards use the same saved appearance. */
export function MerchantCard({business,program,balance,qrValue}:{business:Business;program?:Pick<Program,"type"|"reward_label"|"reward_cost">;balance:number;qrValue?:string}){
 const isStamps=program?.type==="stamps";
 return <StampCard name={business.name} color={business.accent_color||"#571c32"} reward={program?.reward_label||"Tu próxima recompensa"} total={isStamps?program.reward_cost:0} earned={balance}
  balanceLabel={isStamps?undefined:units(balance,program?.type,business.currency)} icon={business.stamp_icon} imageUrl={business.stamp_image_url} logoUrl={business.logo_url} logoScale={business.card_logo_scale} logoX={business.card_logo_x} logoY={business.card_logo_y}
  backgroundUrl={business.card_background} message={business.card_text} textColor={business.card_text_color} stampColor={business.stamp_color} qrValue={qrValue}/>;
}
