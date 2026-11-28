"use client";
import {Gift} from "lucide-react";
import {milestoneAt,type MilestoneRule} from "@/lib/milestones";
import "./stamp-milestones.css";
import type {CSSProperties,ReactNode} from "react";
import {useBalancePulse,newStampIndex} from "@/lib/client/balance-pulse";
import {STAMP_OPTIONS,DEFAULT_STAMP,resolveStampIcon,type StampKind} from "@/lib/stamp-drawings";
import {KreyvIcon} from "@/components/KreyvIcon";
import {stampImageUrl} from "@/lib/asset-images";

export {STAMP_OPTIONS,DEFAULT_STAMP};
export type {StampKind};
export function StampMark({kind=DEFAULT_STAMP,size=30,color}:{kind?:string|null;size?:number;color?:string}){
 return <KreyvIcon name={resolveStampIcon(kind)} size={size} color={color}/>;
}
export function StampGrid({total,earned,kind=DEFAULT_STAMP,imageUrl,color,className="",locale="es",milestones=[],animateEarned=false,animateFrom}:{total:number;earned:number;kind?:string|null;imageUrl?:string|null;color?:string|null;className?:string;locale?:"es"|"en";milestones?:MilestoneRule[];animateEarned?:boolean;animateFrom?:number}){
 const count=Math.min(30,Math.max(1,Math.floor(Number(total)||8)));
 const filled=Math.max(0,Math.floor(Number(earned)||0));
 const pulse=useBalancePulse(filled,animateEarned);
 const from=animateFrom??pulse?.from;
 const cols=count<=6?count:Math.min(6,Math.ceil(count/Math.ceil(count/6)));
 const rewardSlots=Array.from({length:count},(_,i)=>milestoneAt(milestones,i+1,count));
 const rewardPositions=rewardSlots.flatMap((m,i)=>m?[i+1]:[]);
 const progress=locale==="en"?Math.min(filled,count)+" of "+count+" stamps":Math.min(filled,count)+" de "+count+" sellos";
 return <div className={"stamp-grid "+className+(count>=21?" is-very-dense":count>12?" is-dense":"")} role="img" aria-label={progress+(rewardPositions.length?(locale==="en"?". Extra rewards at stamps ":". Premios intermedios en los sellos ")+rewardPositions.join(", "):"")} style={{"--stamp-columns":String(cols)} as CSSProperties}>
  {Array.from({length:count},(_,i)=>{
   const milestone=rewardSlots[i],earnedStamp=i<filled,fresh=from!==undefined&&newStampIndex(i,from,filled);
   return <div className={"stamp-slot"+(earnedStamp?" is-filled":"")+(milestone?" has-milestone":"")+(fresh?" is-newly-earned":"")} key={i} title={milestone?(locale==="en"?"Stamp ":"Sello ")+(i+1)+" · "+milestone.label:undefined} style={{...(earnedStamp&&color?{color}:{}),...(fresh?{"--stamp-arrival-delay":Math.min(7,Math.max(0,i-Math.floor(from??0)))*85+"ms"}:{})} as CSSProperties}>
    {earnedStamp&&(imageUrl?<img src={stampImageUrl(imageUrl,96)} alt="" loading="lazy" decoding="async" draggable={false}/>:<StampMark kind={kind} size={24}/>)}
    {milestone&&<span className={"stamp-milestone-mark"+(earnedStamp?" is-earned":"")} aria-hidden="true"><Gift size={21} strokeWidth={1.8}/></span>}
   </div>;
  })}
 </div>;
}

export function LiveBalanceValue({balance,animate=false,children}:{balance:number;animate?:boolean;children:ReactNode}){
 const pulse=useBalancePulse(balance,animate);
 return <span key={pulse?.key||0} className={pulse?"live-balance-pop":undefined}>{children}</span>;
}
