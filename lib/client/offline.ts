"use client";
import {cardBackgroundUrl} from "@/lib/card-images";
import {logoImageUrl,stampImageUrl} from "@/lib/asset-images";
import type {MilestoneDetails} from "@/lib/milestones";
import type {Business,Membership,Program} from "@/lib/types";
export type OfflineCard=Membership&{businesses:Business};
export type OfflineAccount={id:string;area:"customer"|"staff";at:number;businesses:{id:string;name:string;program?:Program;currency?:string;revision?:string}[]};
export type Snapshot={id:string;at:number;cards:OfflineCard[];programs:Program[];milestones?:Record<string,MilestoneDetails>;movements?:{id:string;business_id:string;kind:string;amount_delta:number;created_at:string}[]};
export type Award={id:string;actor:string;business:string;token:string;at:number;amount:number;stamps:number;ticket:string|null;revision:string;error?:string};
const prefix="kreyvi-offline-v1:", accountKey=prefix+"account",snapshotKey=prefix+"cards",queuePrefix=prefix+"award:",confirmedPrefix=prefix+"confirmed:";
export function read<T>(key:string):T|null{try{return JSON.parse(localStorage.getItem(key)||"null") as T|null}catch{return null}}
export function offlineAccount(){const a=read<OfflineAccount>(accountKey);return a||null}
export function clearOfflineAccount(){try{localStorage.removeItem(accountKey);localStorage.removeItem(snapshotKey)}catch{}}
export function saveAccount(a:OfflineAccount){try{const old=read<OfflineAccount>(accountKey);if(old?.id!==a.id||old?.area!==a.area)localStorage.removeItem(snapshotKey);localStorage.setItem(accountKey,JSON.stringify(a))}catch{}}
export function saveCards(s:Snapshot){try{if(offlineAccount()?.id===s.id){localStorage.setItem(snapshotKey,JSON.stringify(s));if("serviceWorker" in navigator){const urls=s.cards.flatMap(c=>[cardBackgroundUrl(c.businesses.card_background,1200),logoImageUrl(c.businesses.logo_url,512),stampImageUrl(c.businesses.stamp_image_url,96)]).filter(Boolean);void navigator.serviceWorker.ready.then(r=>r.active?.postMessage({type:"WARM_CARD_ASSETS",urls})).catch(()=>{})}}}catch{}}
export function offlineCards(){const a=offlineAccount(),s=read<Snapshot>(snapshotKey);return a?.area==="customer"&&s?.id===a.id?s:null}
export function awards(actor:string):Award[]{try{return Object.keys(localStorage).filter(k=>k.startsWith(queuePrefix)).map(k=>read<Award>(k)).filter((a):a is Award=>!!a&&a.actor===actor).sort((a,b)=>a.at-b.at)}catch{return []}}
export function queueAward(input:Omit<Award,"id"|"at"|"error"|"revision">){const a=offlineAccount();if(!a||a.area!=="staff"||a.id!==input.actor||!a.businesses.some(b=>b.id===input.business))throw Error("Conecta y verifica tu sesión antes de registrar compras.");
 const b=a.businesses.find(b=>b.id===input.business),p=b?.program;
 if(!b?.revision||!p)throw Error("Conecta para verificar permisos y reglas del establecimiento.");
 const now=Date.now(),ticket=input.ticket?.trim()||null;
 if(!Number.isInteger(input.stamps)||input.stamps<1||(p.type==="stamps"&&input.stamps>p.max_stamps_per_action))throw Error("Sellos fuera del límite.");
 if(!Number.isInteger(input.amount)||input.amount<0||input.amount>p.max_ticket_cents||((p.type!=="stamps"||p.require_purchase_amount)&&input.amount<1))throw Error("Importe no válido.");
 if(p.require_ticket_reference&&!ticket)throw Error("Introduce la referencia del ticket.");
 const pending=awards(input.actor).filter(x=>!x.error);
 const confirmed=Object.keys(localStorage).filter(k=>k.startsWith(confirmedPrefix)).map(k=>read<Award>(k)).filter((x):x is Award=>!!x);
 const all=[...pending,...confirmed].filter(x=>x.business===input.business);
 if(ticket&&all.some(x=>x.ticket===ticket))throw Error("El ticket ya se ha registrado en este dispositivo.");
 if(p.min_seconds_between_awards>0&&all.some(x=>x.token.toLowerCase()===input.token.toLowerCase()&&Math.abs(now-x.at)<p.min_seconds_between_awards*1000))throw Error("Espera antes de registrar otra compra en esta tarjeta.");
 if(all.filter(x=>x.actor===input.actor&&new Date(x.at).toISOString().slice(0,10)===new Date(now).toISOString().slice(0,10)).length>=p.max_daily_awards_per_employee)throw Error("Límite diario de compras alcanzado.");
 const award:Award={...input,ticket,revision:b.revision,id:crypto.randomUUID(),at:now};localStorage.setItem(queuePrefix+award.id,JSON.stringify(award));return award}
export function removeAward(a:Award){localStorage.removeItem(queuePrefix+a.id)}
export async function submitAward(a:Award):Promise<{state:"confirmed"|"pending"|"rejected";balance?:number;message?:string}>{
 try{const response=await fetch("/api/local/rpc",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"staff_sync_award",args:{p_operation:a.id,p_actor:a.actor,p_business:a.business,p_token:a.token,p_purchase_cents:a.amount,p_stamps:a.stamps,p_ticket_ref:a.ticket,p_captured_at:new Date(a.at).toISOString(),p_revision:a.revision}})});
 if(response.status>=500||response.status===401||response.status===429)return {state:"pending"};
 const result=await response.json();
 if(!response.ok||result.error){const message=String(result.error||"Operación rechazada");localStorage.setItem(queuePrefix+a.id,JSON.stringify({...a,error:message}));return {state:"rejected",message}}
 try{localStorage.setItem(confirmedPrefix+a.id,JSON.stringify(a));for(const k of Object.keys(localStorage).filter(k=>k.startsWith(confirmedPrefix))){const old=read<Award>(k);if(old&&Date.now()-old.at>2*86400000)localStorage.removeItem(k)}}catch{}
 removeAward(a);return {state:"confirmed",balance:Number(result.data)};
 }catch{return {state:"pending"}}
}
let syncing=false;
export async function syncAwards(actor:string){if(syncing||!navigator.onLine)return;syncing=true;try{for(const a of awards(actor)){if(a.error)continue;const r=await submitAward(a);if(r.state==="pending")break}}finally{syncing=false}}
