"use client";
import type {CSSProperties} from "react";
import {STAMP_OPTIONS,DEFAULT_STAMP,resolveStampIcon,type StampKind} from "@/lib/stamp-drawings";
import {KreyvIcon} from "@/components/KreyvIcon";

export {STAMP_OPTIONS,DEFAULT_STAMP};
export type {StampKind};
export function StampMark({kind=DEFAULT_STAMP,size=30,color}:{kind?:string|null;size?:number;color?:string}){
 return <KreyvIcon name={resolveStampIcon(kind)} size={size} color={color}/>;
}
export function StampGrid({total,earned,kind=DEFAULT_STAMP,imageUrl,color,className="",locale="es"}:{total:number;earned:number;kind?:string|null;imageUrl?:string|null;color?:string|null;className?:string;locale?:"es"|"en"}){
 const count=Math.min(30,Math.max(1,Math.floor(Number(total)||8)));
 const filled=Math.max(0,Math.floor(Number(earned)||0));
 const cols=count<=6?count:Math.min(6,Math.ceil(count/Math.ceil(count/6)));
 return <div className={"stamp-grid "+className+(count>=21?" is-very-dense":count>12?" is-dense":"")} role="img" aria-label={locale==="en"?Math.min(filled,count)+" of "+count+" stamps":Math.min(filled,count)+" de "+count+" sellos"} style={{"--stamp-columns":String(cols)} as CSSProperties}>
  {Array.from({length:count},(_,i)=><div className={"stamp-slot"+(i<filled?" is-filled":"")} key={i} style={i<filled&&color?{color}:undefined}>
   {i<filled&&(imageUrl?<img src={imageUrl} alt="" loading="lazy"/>:<StampMark kind={kind} size={24}/>)}
  </div>)}
 </div>;
}
