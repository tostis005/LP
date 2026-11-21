import {actorFromRequest,asActor,responseError,ApiError} from "@/lib/server/db";
import {pushConfigured} from "@/lib/server/web-push";
import {smtpReady} from "@/lib/server/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type PriceRow={contacts?:string|number;devices?:string|number;price_cents:number|null;total_cents:string|number|null;currency:string};
export async function GET(request:Request){
 try{
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Inicia sesión.",401);
  const business=new URL(request.url).searchParams.get("business")||"";
  if(!/^[a-f0-9-]{36}$/i.test(business))throw new ApiError("Negocio inválido.");
  const rows=await asActor(actor,async client=>{
   const authorized=await client.query<{allowed:boolean}>(
    "SELECT public.is_business_manager($1::uuid) AS allowed",[business]);
   if(!authorized.rows[0]?.allowed)throw new ApiError("No autorizado.",403);
   const email=await client.query<PriceRow>("SELECT * FROM public.business_mail_quote($1::uuid)",[business]);
   const whatsapp=await client.query<PriceRow>("SELECT * FROM public.business_whatsapp_quote($1::uuid)",[business]);
   const push=await client.query<PriceRow>("SELECT * FROM public.business_push_pricing($1::uuid)",[business]);
   return {email:email.rows[0],whatsapp:whatsapp.rows[0],push:push.rows[0]};
  });
  const ready={email:process.env.LP_ENABLE_MARKETING_SEND==="true"&&smtpReady()&&!!process.env.NEXT_PUBLIC_SITE_URL,
   whatsapp:process.env.LP_ENABLE_WHATSAPP_SEND==="true"&&!!process.env.WHATSAPP_ACCESS_TOKEN&&
    !!process.env.WHATSAPP_PHONE_NUMBER_ID&&!!process.env.WHATSAPP_MARKETING_TEMPLATE,
   push:pushConfigured()};
  const channels=Object.fromEntries((["email","whatsapp","push"] as const).map(ch=>{
   const r=rows[ch];const recipients=Number(r?.contacts??r?.devices??0),unit= r?.price_cents==null?null:Number(r.price_cents);
   return [ch,{recipients,unit_price_cents:unit,
    total_cents:unit===null?null:recipients*unit,currency:r?.currency||"MXN",
    enabled:ready[ch]&&unit!==null&&recipients>0}];
  }));
  return Response.json({channels},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}
