"use client";
import type {MilestoneDetails} from "@/lib/milestones";
import type {Business,Membership,Program} from "@/lib/types";
export type OfflineCard=Membership&{businesses:Business};
export type OfflineAccount={id:string;area:"customer"|"staff";at:number;businesses:{id:string;name:string;program?:Program;currency?:string}[]};
export type Snapshot={id:string;at:number;cards:OfflineCard[];programs:Program[];milestones?:Record<string,MilestoneDetails>};
export type Award={id:string;actor:string;business:string;token:string;at:number;amount:number;stamps:number;ticket:string|null;error?:string};
const prefix="kreyvi-offline-v1:", accountKey=prefix+"account",snapshotKey=prefix+"cards",queuePrefix=prefix+"award:";
export function read<T>(key:string):T|null{try{return JSON.parse(localStorage.getItem(key)||"null") as T|null}catch{return null}}
export function offlineAccount(){const a=read<OfflineAccount>(accountKey);return a&&Date.now()-a.at<24*60*60*1000?a:null}
export function clearOfflineAccount(){try{localStorage.removeItem(accountKey);localStorage.removeItem(snapshotKey)}catch{}}
export function saveAccount(a:OfflineAccount){try{const old=read<OfflineAccount>(accountKey);if(old?.id!==a.id||old?.area!==a.area)localStorage.removeItem(snapshotKey);localStorage.setItem(accountKey,JSON.stringify(a))}catch{}}
export function saveCards(s:Snapshot){try{if(offlineAccount()?.id===s.id)localStorage.setItem(snapshotKey,JSON.stringify(s))}catch{}}
export function offlineCards(){const a=offlineAccount(),s=read<Snapshot>(snapshotKey);return a?.area==="customer"&&s?.id===a.id?s:null}
export function awards(actor:string):Award[]{try{return Object.keys(localStorage).filter(k=>k.startsWith(queuePrefix)).map(k=>read<Award>(k)).filter((a):a is Award=>!!a&&a.actor===actor).sort((a,b)=>a.at-b.at)}catch{return []}}
export function queueAward(input:Omit<Award,"id"|"at"|"error">){const a=offlineAccount();if(!a||a.area!=="staff"||a.id!==input.actor||!a.businesses.some(b=>b.id===input.business))throw Error("Conecta y verifica tu sesión antes de registrar compras.");
 if(awards(input.actor).length>=50)throw Error("Hay 50 compras pendientes. Sincroniza antes de continuar.");
 const award:Award={...input,id:crypto.randomUUID(),at:Date.now()};localStorage.setItem(queuePrefix+award.id,JSON.stringify(award));return award}
export function removeAward(a:Award){localStorage.removeItem(queuePrefix+a.id)}
export async function submitAward(a:Award):Promise<{state:"confirmed"|"pending"|"rejected";balance?:number;message?:string}>{
 try{const response=await fetch("/api/local/rpc",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"staff_sync_award",args:{p_operation:a.id,p_actor:a.actor,p_business:a.business,p_token:a.token,p_purchase_cents:a.amount,p_stamps:a.stamps,p_ticket_ref:a.ticket,p_captured_at:new Date(a.at).toISOString()}})});
 if(response.status>=500||response.status===401||response.status===429)return {state:"pending"};
 const result=await response.json();
 if(!response.ok||result.error){const message=String(result.error||"Operación rechazada");localStorage.setItem(queuePrefix+a.id,JSON.stringify({...a,error:message}));return {state:"rejected",message}}
 removeAward(a);return {state:"confirmed",balance:Number(result.data)};
 }catch{return {state:"pending"}}
}
let syncing=false;
export async function syncAwards(actor:string){if(syncing||!navigator.onLine)return;syncing=true;try{for(const a of awards(actor)){if(a.error)continue;const r=await submitAward(a);if(r.state==="pending")break}}finally{syncing=false}}
