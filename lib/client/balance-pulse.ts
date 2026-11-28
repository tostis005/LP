"use client";
import {useEffect,useRef,useState} from "react";
export type BalancePulse={from:number;to:number;key:number};
export function earnedIncrease(previous:number,next:number){return Number.isFinite(previous)&&Number.isFinite(next)&&next>previous?next-previous:0;}
export function newStampIndex(index:number,from:number,to:number){return index>=Math.max(0,Math.floor(from))&&index<Math.floor(to);}
export function useBalancePulse(balance:number,enabled=true,identity=""){
 const previous=useRef({balance,identity}),sequence=useRef(0);
 const [pulse,setPulse]=useState<BalancePulse|null>(null);
 useEffect(()=>{
  const old=previous.current;previous.current={balance,identity};
  if(!enabled||old.identity!==identity||!earnedIncrease(old.balance,balance)){setPulse(null);return;}
  const next={from:old.balance,to:balance,key:++sequence.current};setPulse(next);
  const timer=setTimeout(()=>setPulse(current=>current?.key===next.key?null:current),4200);
  return()=>clearTimeout(timer);
 },[balance,enabled,identity]);
 return pulse?.to===balance?pulse:null;
}
