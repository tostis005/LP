"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {Bell} from "lucide-react";
function useUnread(){
 const [count,setCount]=useState(0);
 const update=useCallback(async()=>{
  try{
   const res=await fetch("/api/local/offers",{credentials:"same-origin",cache:"no-store"});
   if(!res.ok)return;
   const result=await res.json() as {unread?:number};
   setCount(Math.max(0,Number(result.unread||0)));
  }catch{/* Los avisos siguen disponibles aunque el contador no conecte. */}
 },[]);
 useEffect(()=>{
  void update();
  const focus=()=>void update();
  const visible=()=>{if(document.visibilityState==="visible")void update()};
  window.addEventListener("focus",focus);
  window.addEventListener("kreyv:inbox-read",focus);
  document.addEventListener("visibilitychange",visible);
  return()=>{
   window.removeEventListener("focus",focus);
   window.removeEventListener("kreyv:inbox-read",focus);
   document.removeEventListener("visibilitychange",visible);
  };
 },[update]);
 return count;
}
export function CustomerInboxBell(){
 const count=useUnread();
 return <Link href="/app/novedades" className="kreyv-header-bell" aria-label={"Ver avisos"+(count?" ("+count+" sin leer)":"")}>
  <Bell size={19} strokeWidth={1.9}/>{count>0&&<span className="kreyv-unread-badge">{count>99?"99+":count}</span>}
 </Link>;
}
export function CustomerInboxNavCount(){
 const count=useUnread();
 return count>0?<span className="kreyv-nav-unread">{count>99?"99+":count}</span>:null;
}
