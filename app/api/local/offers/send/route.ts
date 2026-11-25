import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {smtpReady} from "@/lib/server/auth";
import {pushConfigured} from "@/lib/server/web-push";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=/^[a-f0-9-]{36}$/i;
type Channel="email"|"whatsapp"|"push";
type Campaign={id:string;channel:Channel;status:string;recipient_count:number;sent_count:number;failed_count:number};
function available(channel:Channel){
 if(channel==="push")return pushConfigured();
 if(channel==="email")return process.env.LP_ENABLE_MARKETING_SEND==="true"&&smtpReady()&&!!process.env.NEXT_PUBLIC_SITE_URL;
 return process.env.LP_ENABLE_WHATSAPP_SEND==="true"&&!!process.env.WHATSAPP_ACCESS_TOKEN&&
  !!process.env.WHATSAPP_PHONE_NUMBER_ID&&!!process.env.WHATSAPP_MARKETING_TEMPLATE;
}
async function snapshot(actor:NonNullable<Awaited<ReturnType<typeof actorFromRequest>>>,id:string){
 return asActor(actor,async client=>{
  const o=await client.query<{id:string;business_id:string;push_campaign_id:string|null}>(
   "SELECT id,business_id,push_campaign_id FROM public.business_offers WHERE id=$1::uuid AND archived_at IS NULL",[id]);
  if(!o.rows[0])throw new ApiError("Campaña no encontrada.",404);
  const owner=await client.query<{allowed:boolean}>("SELECT public.is_business_manager($1::uuid) AS allowed",[o.rows[0].business_id]);
  if(!owner.rows[0]?.allowed)throw new ApiError("No autorizado.",403);
  const m=await client.query<Campaign>(
   "SELECT id,channel,status,recipient_count,sent_count,failed_count FROM public.marketing_campaigns WHERE offer_id=$1::uuid ORDER BY channel",[id]);
  const p=o.rows[0].push_campaign_id?await client.query<Campaign>(
   "SELECT id,'push'::text AS channel,status,recipient_count,sent_count,failed_count FROM public.push_campaigns WHERE id=$1::uuid",[o.rows[0].push_campaign_id]):null;
  const charges=await client.query<{channel:Channel;recipients:number;unit_price_cents:number;amount_cents:string;currency:string;confirmed_at:string;invoiced_at:string|null}>(
   "SELECT channel,recipients,unit_price_cents,amount_cents,currency,confirmed_at,invoiced_at FROM public.offer_campaign_charges WHERE offer_id=$1::uuid ORDER BY channel",[id]);
  return {campaigns:[...m.rows,...(p?.rows||[])],charges:charges.rows,confirmed:charges.rows.length>0,
   total_cents:charges.rows.reduce((sum,r)=>sum+Number(r.amount_cents),0),
   currency:charges.rows[0]?.currency||"MXN"};
 });
}
export async function GET(request:Request){
 try{
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Necesitas iniciar sesión.",401);
  const id=new URL(request.url).searchParams.get("offer_id")||"";
  if(!uuid.test(id))throw new ApiError("Campaña inválida.");
  return Response.json(await snapshot(actor,id),{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Necesitas iniciar sesión.",401);
  const raw=await request.text();
  if(raw.length>500)throw new ApiError("Solicitud demasiado grande.",413);
  const input=JSON.parse(raw) as {offer_id?:string;action?:"confirm"|"resume";expected_total_cents?:number};
  const id=input.offer_id||"";
  if(!uuid.test(id)||!["confirm","resume"].includes(input.action||""))throw new ApiError("Solicitud inválida.");
  const before=await snapshot(actor,id);
  if(input.action==="confirm"){
   if(before.confirmed)throw new ApiError("La campaña ya fue confirmada. Usa «Continuar envío».");
   if(!Number.isSafeInteger(input.expected_total_cents)||Number(input.expected_total_cents)<0)
    throw new ApiError("Comprueba el importe de la campaña.");
   for(const campaign of before.campaigns){
    if(!available(campaign.channel))throw new ApiError("El canal "+campaign.channel+" no está configurado.",503);
    if(campaign.status!=="draft")throw new ApiError("Esta campaña ya no admite confirmación.");
   }
   if(!before.campaigns.length)throw new ApiError("No hay canales de envío.");
   await asActor(actor,async client=>client.query("SELECT public.confirm_offer_campaign($1::uuid,$2::bigint)",[id,input.expected_total_cents]));
  }else if(!before.confirmed){
   throw new ApiError("Confirma el precio antes del primer envío.");
  }
  const after=await snapshot(actor,id);
  return Response.json(after,{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}
