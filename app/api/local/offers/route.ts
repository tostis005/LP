import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {smtpReady} from "@/lib/server/auth";
import {pushConfigured} from "@/lib/server/web-push";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Channel="email"|"whatsapp"|"push";
type NewOffer={action?:string;business_id?:string;title?:string;preview?:string;details?:string;
 terms?:string;image_url?:string|null;valid_until?:string|null;valid_from?:string|null;kind?:"offer"|"news"|"notice";channels?:Channel[];offer_id?:string;expected_total_cents?:number};
function imagePath(raw:string|null|undefined,origin:string,business:string){
 if(!raw)return null;
 let url:URL;
 try{url=new URL(raw,origin)}catch{throw new ApiError("La imagen no es válida.");}
 if(url.origin!==origin||url.search||url.hash||
  !new RegExp("^/api/assets/business-assets/"+business+"/[a-z0-9][a-z0-9._-]{0,140}\\.(?:png|jpe?g|webp)$","i").test(url.pathname))
  throw new ApiError("Selecciona una imagen subida a este negocio.");
 return url.pathname;
}
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){
 try{
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Inicia sesión para consultar tus ofertas.",401);
  const url=new URL(request.url),business=url.searchParams.get("business"),id=url.searchParams.get("id");
  if(business){
   if(!uuid.test(business))throw new ApiError("Negocio inválido.");
   const offers=await asActor(actor,async client=>{
    const ok=await client.query<{allowed:boolean}>("SELECT (public.is_business_manager($1::uuid) OR public.is_platform_admin()) AS allowed",[business]);
    if(!ok.rows[0]?.allowed)throw new ApiError("No autorizado.",403);
    return (await client.query(
     "SELECT o.id,o.title,o.preview,o.details,o.terms,o.image_url,o.kind,to_char(o.valid_from,'YYYY-MM-DD') AS valid_from,to_char(o.valid_until,'YYYY-MM-DD') AS valid_until,o.created_at,o.push_campaign_id, "+
     "(SELECT count(*)::int FROM public.offer_receipts r WHERE r.offer_id=o.id) AS delivered, "+
     "(SELECT coalesce(json_agg(json_build_object('id',q.id,'channel',q.channel,'status',q.status,"+
     "'recipient_count',q.recipient_count,'sent_count',q.sent_count,'failed_count',q.failed_count)), '[]'::json) "+
     "FROM (SELECT c.id,c.channel,c.status,c.recipient_count,c.sent_count,c.failed_count "+
     "FROM public.marketing_campaigns c WHERE c.offer_id=o.id UNION ALL "+
     "SELECT p.id,'push'::text,p.status,p.recipient_count,p.sent_count,p.failed_count "+
     "FROM public.push_campaigns p WHERE p.id=o.push_campaign_id) q) AS campaigns, "+
     "(SELECT count(*)::int FROM public.offer_campaign_charges x WHERE x.offer_id=o.id) AS charged_channels, "+
     "(SELECT coalesce(sum(x.amount_cents),0)::bigint FROM public.offer_campaign_charges x WHERE x.offer_id=o.id) AS confirmed_cents, "+
     "(SELECT min(x.currency) FROM public.offer_campaign_charges x WHERE x.offer_id=o.id) AS confirmed_currency "+
     "FROM public.business_offers o WHERE o.business_id=$1::uuid AND NOT EXISTS ("+
     "SELECT 1 FROM public.automation_rules a WHERE a.offer_id=o.id) ORDER BY o.created_at DESC LIMIT 100",[business])).rows;
   });
   return Response.json({offers},{headers});
  }
  if(id&&!uuid.test(id))throw new ApiError("Oferta inválida.");
  const rows=await asActor(actor,async client=>{
   return (await client.query(
    "SELECT o.id,o.business_id,o.title,o.preview,o.details,o.terms,o.image_url,o.kind,to_char(o.valid_from,'YYYY-MM-DD') AS valid_from,to_char(o.valid_until,'YYYY-MM-DD') AS valid_until,o.created_at, "+
    "r.received_at,r.seen_at,b.name AS business_name,b.logo_url AS business_logo "+
    "FROM public.offer_receipts r JOIN public.business_offers o ON o.id=r.offer_id "+
    "JOIN public.businesses b ON b.id=o.business_id "+
    "WHERE r.customer_id=$1::uuid "+(id?"AND o.id=$2::uuid ":"")+
    "ORDER BY r.received_at DESC LIMIT 100",id?[actor.id,id]:[actor.id])).rows;
  });
  if(id&&!rows.length)throw new ApiError("Esta oferta no está disponible en tus novedades.",404);
  return Response.json(id?{offer:rows[0]}:{items:rows,unread:rows.filter(x=>!x.seen_at).length},{headers});
 }catch(error){return responseError(error);}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Inicia sesión para continuar.",401);
  const raw=await request.text();
  if(raw.length>13000)throw new ApiError("El contenido es demasiado largo.",413);
  const input=JSON.parse(raw) as NewOffer;
  if(input.action==="read"){
   if(!uuid.test(input.offer_id||""))throw new ApiError("Oferta inválida.");
   await asActor(actor,async client=>client.query(
    "UPDATE public.offer_receipts SET seen_at=coalesce(seen_at,now()) WHERE customer_id=$1::uuid AND offer_id=$2::uuid",
    [actor.id,input.offer_id]));
   return Response.json({ok:true},{headers});
  }
  const sendNow=input.action==="create_send";
  if((input.action!=="create"&&!sendNow)||!uuid.test(input.business_id||""))throw new ApiError("Negocio inválido.");
  if(sendNow&&(!Number.isSafeInteger(input.expected_total_cents)||Number(input.expected_total_cents)<0))
   throw new ApiError("No se ha podido confirmar el precio de la campaña.");
  if(sendNow){
   for(const channel of input.channels||[]){
    if(channel==="push"&&!pushConfigured())throw new ApiError("Las notificaciones push no están disponibles.",503);
    if(channel==="email"&&!(process.env.LP_ENABLE_MARKETING_SEND==="true"&&smtpReady()&&process.env.NEXT_PUBLIC_SITE_URL))
     throw new ApiError("El correo no está disponible.",503);
    if(channel==="whatsapp"&&!(process.env.LP_ENABLE_WHATSAPP_SEND==="true"&&
      process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID&&process.env.WHATSAPP_MARKETING_TEMPLATE))
     throw new ApiError("WhatsApp no está disponible.",503);
   }
  }
  const title=input.title?.trim()||"",preview=input.preview?.trim()||"",details=input.details?.trim()||"";
  const terms=input.terms?.trim()||"";const kind=input.kind||"offer";
  const channels=[...new Set(input.channels||[])];
  if(title.length<3||title.length>50||preview.length<3||preview.length>120||
    details.length<3||details.length>6000||terms.length>1500||
    channels.length<1||channels.length>3||channels.some(ch=>!["email","whatsapp","push"].includes(ch)))
    throw new ApiError("Revisa el título (50), resumen (120), descripción (6000) y canales.");
  if(!["offer","news","notice"].includes(kind))throw new ApiError("Tipo de campaña inválido.");
  const beginning=input.valid_from||null,expiry=input.valid_until||null;
  const dateValid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&
   !Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(beginning&&!dateValid(beginning))throw new ApiError("La fecha de inicio no es válida.");
  if(beginning&&expiry&&beginning>expiry)throw new ApiError("El inicio no puede ser posterior al fin.");
  if(expiry){
   if(!dateValid(expiry)||expiry<new Date().toISOString().slice(0,10))
    throw new ApiError("La fecha de caducidad no es válida.");
  }
  const image=imagePath(input.image_url,new URL(request.url).origin,input.business_id!);
  const created=await asActor(actor,async client=>{
   const can=await client.query<{allowed:boolean}>(
    "SELECT public.is_business_manager($1::uuid) AS allowed",[input.business_id]);
   if(!can.rows[0]?.allowed)throw new ApiError("No tienes permiso para crear ofertas de este negocio.",403);
   const o=await client.query<{id:string}>(
    "INSERT INTO public.business_offers(business_id,created_by,title,preview,details,terms,image_url,valid_from,valid_until,kind) "+
    "VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::date,$9::date,$10) RETURNING id",
    [input.business_id,actor.id,title,preview,details,terms,image,beginning,expiry,kind]);
   const id=o.rows[0].id;
   const prepared:Channel[]=[];
   for(const channel of channels){
    if(channel==="push"){
     const p=await client.query<{value:string}>(
      "SELECT public.business_save_push_campaign($1::uuid,$2::text,$3::text,NULL::uuid) AS value",
      [input.business_id,title,preview]);
     await client.query("UPDATE public.business_offers SET push_campaign_id=$1::uuid WHERE id=$2::uuid",
      [p.rows[0].value,id]);
    }else{
     const body=channel==="email"?(details+(terms?"\n\nCondiciones: "+terms:"")):preview;
     await client.query(
      "INSERT INTO public.marketing_campaigns(business_id,created_by,subject,body_text,channel,status,template_name,template_language,offer_id) "+
      "VALUES($1::uuid,$2::uuid,$3,$4,$5,'draft',$6,$7,$8::uuid)",
      [input.business_id,actor.id,title,body,channel,
       channel==="whatsapp"?(process.env.WHATSAPP_MARKETING_TEMPLATE||null):null,
       channel==="whatsapp"?(process.env.WHATSAPP_TEMPLATE_LANGUAGE||"es_MX"):null,id]);
    }
    prepared.push(channel);
   }
   if(sendNow){
    // Crear y confirmar en la misma transacción: si el precio cambia, no queda
    // un borrador que requiera una segunda confirmación.
    await client.query("SELECT public.confirm_offer_campaign($1::uuid,$2::bigint)",[id,input.expected_total_cents]);
    const marketing=await client.query<{id:string;channel:Channel;status:string;recipient_count:number;sent_count:number;failed_count:number}>(
     "SELECT id,channel,status,recipient_count,sent_count,failed_count FROM public.marketing_campaigns WHERE offer_id=$1::uuid",[id]);
    const push=await client.query<{id:string;channel:Channel;status:string;recipient_count:number;sent_count:number;failed_count:number}>(
     "SELECT p.id,'push'::text AS channel,p.status,p.recipient_count,p.sent_count,p.failed_count FROM public.push_campaigns p JOIN public.business_offers o ON o.push_campaign_id=p.id WHERE o.id=$1::uuid",[id]);
    return {id,channels:prepared,campaigns:[...marketing.rows,...push.rows],confirmed:true};
   }
   return {id,channels:prepared};
  });
  return Response.json(created,{status:201,headers});
 }catch(error){return responseError(error);}
}
