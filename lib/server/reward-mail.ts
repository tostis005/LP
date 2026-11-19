import {authPool} from "@/lib/server/db";
import {sendMail,smtpReady} from "@/lib/server/auth";
/** Envía avisos transaccionales después de una operación confirmada.
 * El correo nunca pasa por el navegador del negocio. Un fallo SMTP no revierte la compra.
 */
export async function notifyReward(cardToken:string):Promise<void>{
 if(!smtpReady()||!process.env.NEXT_PUBLIC_SITE_URL)return;
 if(!/^[a-f0-9-]{36}$/i.test(cardToken))return;
 const claim=await authPool.query<{token:string;email:string;business_name:string;reward_label:string}>(
  "SELECT * FROM public.claim_reward_notification($1::uuid)",[cardToken]);
 const reward=claim.rows[0];
 if(!reward)return;
 let delivered=false;
 try{
  const link=process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/,"")+"/p/"+reward.token;
  await sendMail(reward.email,"¡Tu premio de "+reward.business_name+" ya está disponible!",
   "¡Enhorabuena!\n\nHas conseguido: "+reward.reward_label+"\n\nNegocio: "+reward.business_name+
   "\n\nAquí tienes tu QR de un solo uso:\n"+link+
   "\n\nMuéstralo en el establecimiento. El personal autorizado lo validará para entregarte el premio.\n\nLoyally");
  delivered=true;
 }finally{
  await authPool.query("SELECT public.finish_reward_notification($1::uuid,$2::boolean)",[reward.token,delivered]);
 }
}
