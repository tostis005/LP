import webpush from "web-push";
import {ApiError} from "@/lib/server/db";

export type PushDelivery={
 delivery_id:string;endpoint:string;p256dh:string;auth:string;
 title:string;body_text:string;business_name:string;offer_id?:string|null;membership_id?:string|null;
};

export function pushConfigured(){
 return process.env.LP_ENABLE_PUSH_SEND==="true"
  && /^[A-Za-z0-9_-]{80,100}$/.test(process.env.VAPID_PUBLIC_KEY||"")
  && /^[A-Za-z0-9_-]{40,60}$/.test(process.env.VAPID_PRIVATE_KEY||"")
  && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$|^https:\/\/[^\s]+$/i.test(process.env.VAPID_SUBJECT||"");
}
export function pushPublicKey(){return pushConfigured()?process.env.VAPID_PUBLIC_KEY||"":"";}

export function trustedPushEndpoint(value:string){
 try{
  if(value.length>2048)return false;
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.port||u.hash)return false;
  const host=u.hostname.toLowerCase();
  return host==="fcm.googleapis.com"
    ||host==="updates.push.services.mozilla.com"
    ||host==="push.services.mozilla.com"
    ||host==="web.push.apple.com"
    ||(host.endsWith(".push.apple.com")&&host.length>15)
    ||host==="wns.notify.windows.com";
 }catch{return false;}
}

export async function sendWebPush(item:PushDelivery){
 if(!pushConfigured())throw new ApiError("Web Push aún no está configurado.",503);
 if(!trustedPushEndpoint(item.endpoint))throw new Error("Proveedor push no permitido.");
 webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
 const payload=JSON.stringify({
  title:item.business_name+" · "+item.title,
  body:item.body_text,
  icon:"/kreyv-notification-icon-v2-192.png",
  badge:"/kreyv-notification-badge-v2-96.png",
  url:item.offer_id?"/app/novedades/"+item.offer_id:item.membership_id?"/app?card="+encodeURIComponent(item.membership_id):"/app",
  tag:"loyally-"+item.delivery_id
 });
 await webpush.sendNotification({endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth}},
  // Mantener el aviso hasta 24 h si Android retrasa la entrega por ahorro de batería.
  payload,{TTL:86400,urgency:item.membership_id?"high":"normal",timeout:5000});
}
