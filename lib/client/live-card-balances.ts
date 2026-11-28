"use client";
import {useEffect,useRef} from "react";
import {db} from "@/lib/supabase";
import type {Membership} from "@/lib/types";
export type LiveCardState=Pick<Membership,"id"|"balance"|"total_earned"|"customer_favorite"|"customer_hidden">;
export function cardStateChanged(current:readonly LiveCardState[],latest:readonly LiveCardState[]){
 if(current.length!==latest.length)return true;
 const byId=new Map(current.map(c=>[c.id,c]));
 return latest.some(c=>{const old=byId.get(c.id);return !old||old.balance!==c.balance||old.total_earned!==c.total_earned||!!old.customer_favorite!==!!c.customer_favorite||!!old.customer_hidden!==!!c.customer_hidden;});
}
// One narrow authenticated read per foreground wallet; no dependency on push permission.
// The worker only sends an invalidation hint, never trusted balance data.
export function useLiveCardBalances(userId:string,enabled:boolean,onRows:(rows:LiveCardState[])=>void|Promise<void>){
 const callback=useRef(onRows);callback.current=onRows;
 useEffect(()=>{
  if(!enabled||!userId)return;
  let active=true,running=false,again=false,timer:ReturnType<typeof setTimeout>|null=null;
  const schedule=(delay=3000)=>{if(timer)clearTimeout(timer);if(active&&document.visibilityState!=="hidden"&&navigator.onLine)timer=setTimeout(()=>void check(),delay);};
  async function check(){
   if(!active||document.visibilityState==="hidden"||!navigator.onLine)return;
   if(running){again=true;return;}
   if(timer)clearTimeout(timer);
   running=true;
   try{
    const r=await db().from("loyalty_memberships").select("id,balance,total_earned,customer_favorite,customer_hidden").eq("customer_id",userId).order("created_at",{ascending:false}).limit(500);
    if(active&&!r.error)await callback.current((r.data||[]) as LiveCardState[]);
   }catch{/* Keep the current display; retry without resetting the QR or carousel. */}
   finally{running=false;if(active){const delay=again?0:3000;again=false;schedule(delay);}}
  }
  const refresh=()=>{if(document.visibilityState==="hidden"||!navigator.onLine){if(timer)clearTimeout(timer);return;}void check();};
  const message=(e:MessageEvent)=>{if(e.data?.type==="KREYVI_CARD_CHANGED")refresh();};
  window.addEventListener("focus",refresh);window.addEventListener("online",refresh);window.addEventListener("pageshow",refresh);window.addEventListener("offline",refresh);
  document.addEventListener("visibilitychange",refresh);
  navigator.serviceWorker?.addEventListener("message",message);
  refresh();
  return()=>{active=false;if(timer)clearTimeout(timer);window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);window.removeEventListener("pageshow",refresh);window.removeEventListener("offline",refresh);document.removeEventListener("visibilitychange",refresh);navigator.serviceWorker?.removeEventListener("message",message);};
 },[userId,enabled]);
}
