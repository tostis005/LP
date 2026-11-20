import {actorFromRequest,asActor,authPool,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {sendMail,smtpReady} from "@/lib/server/auth";
import {campaignPlainText,campaignEmailHtml,campaignWhatsAppText} from "@/lib/marketing-rich";
export const runtime="nodejs";
type EmailDelivery={delivery_id:string;email:string;subject:string;body_text:string;business_name:string;unsubscribe_token:string};
type WhatsappDelivery={delivery_id:string;phone:string;body_text:string;template_name:string;template_language:string};
type Channel="email"|"whatsapp";
function whatsappReady(){
 return process.env.LP_ENABLE_WHATSAPP_SEND==="true"&&!!process.env.WHATSAPP_ACCESS_TOKEN&&
  /^\d{5,30}$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID||"")&&!!process.env.WHATSAPP_MARKETING_TEMPLATE;
}
async function sendWhatsapp(item:WhatsappDelivery){
 const token=process.env.WHATSAPP_ACCESS_TOKEN||"";
 const number=process.env.WHATSAPP_PHONE_NUMBER_ID||"";
 // Una plantilla Marketing aprobada en Meta: “Hola, {{1}}” (una variable de texto).
 if(item.template_name!==process.env.WHATSAPP_MARKETING_TEMPLATE||
  item.template_language!==(process.env.WHATSAPP_TEMPLATE_LANGUAGE||"es_MX"))
  throw new ApiError("La plantilla aún no está activada por Kreyv.",503);
 if(!/^\+[1-9][0-9]{7,14}$/.test(item.phone))throw new Error("Teléfono no válido");
 const message=campaignWhatsAppText(item.body_text);
 if(message.length<3||message.length>900)throw new Error("La plantilla excede el tamaño permitido");
 const response=await fetch("https://graph.facebook.com/v26.0/"+number+"/messages",{
  method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
  body:JSON.stringify({
   messaging_product:"whatsapp",recipient_type:"individual",to:item.phone.slice(1),type:"template",
   template:{name:item.template_name,language:{code:item.template_language},
    components:[{type:"body",parameters:[{type:"text",text:message}]}]}
  }),cache:"no-store",signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw new Error("Meta rechazó el envío");
 const json=await response.json() as {messages?:{id?:string}[]};
 if(!json.messages?.[0]?.id)throw new Error("La API no confirmó la aceptación del mensaje");
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Necesitas iniciar sesión.",401);
  const raw=await request.text();if(raw.length>1500)throw new ApiError("Solicitud demasiado larga.");
  const input=JSON.parse(raw) as {campaign_id?:string;expected_total_cents?:number};
  const id=String(input.campaign_id||"");
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new ApiError("Campaña inválida.");
  const meta=await asActor(actor,async client=>{
   const result=await client.query<{status:string;channel:Channel;template_name:string|null;template_language:string|null;authorized:boolean}>(
    "SELECT status,channel,template_name,template_language,(public.is_business_manager(business_id) OR public.is_platform_admin()) AS authorized FROM public.marketing_campaigns WHERE id=$1",[id]);
   if(!result.rowCount||!result.rows[0].authorized)throw new ApiError("No autorizado.",403);
   return result.rows[0];
  });
  if(meta.channel==="whatsapp"){
   if(!whatsappReady())throw new ApiError("WhatsApp aún no está activado. Consulta al equipo de Kreyv.",503);
   if(meta.template_name!==process.env.WHATSAPP_MARKETING_TEMPLATE||
    meta.template_language!==(process.env.WHATSAPP_TEMPLATE_LANGUAGE||"es_MX"))
    throw new ApiError("El mensaje debe utilizar la plantilla aprobada de Kreyv.",503);
  }else if(process.env.LP_ENABLE_MARKETING_SEND!=="true"||!smtpReady()||!process.env.NEXT_PUBLIC_SITE_URL)
   throw new ApiError("El envío de correos aún no está activado. Consulta al equipo de Kreyv.",503);
  if(["sent","partial","failed"].includes(meta.status))
   return Response.json({sent:0,failed:0,remaining:0,status:meta.status});
  if(meta.status==="draft"){
   if(!Number.isSafeInteger(input.expected_total_cents)||Number(input.expected_total_cents)<0)
    throw new ApiError("Confirma el presupuesto de esta campaña.");
   await asActor(actor,async client=>{
    await client.query("SELECT public.queue_business_campaign($1::uuid,$2::bigint)",[id,input.expected_total_cents]);
   });
  }
  const site=(process.env.NEXT_PUBLIC_SITE_URL||"").replace(/\/$/,"");
  let sent=0,failed=0;
  for(let i=0;i<10;i++){
   const sql=meta.channel==="email"?"SELECT * FROM public.claim_campaign_delivery($1::uuid)":
    "SELECT * FROM public.claim_whatsapp_delivery($1::uuid)";
   const reserved=await authPool.query<EmailDelivery|WhatsappDelivery>(sql,[id]);
   const item=reserved.rows[0];if(!item)break;
   let ok=false;
   try{
    if(meta.channel==="email"){
     const d=item as EmailDelivery;
     const unsubscribe=site+"/baja/"+d.unsubscribe_token;
     const text=campaignPlainText(d.body_text)+"\n\n---\nRecibes este mensaje porque aceptaste recibir campañas de "+d.business_name+
      ". Para dejar de recibirlas: "+unsubscribe;
     await sendMail(d.email,d.subject,text,campaignEmailHtml(d.body_text,d.business_name,unsubscribe));
    }else await sendWhatsapp(item as WhatsappDelivery);
    ok=true;sent++;
   }catch(e){
    failed++;console.warn("Envío rechazado por el proveedor",e instanceof Error?e.message:"provider");
   }
   await authPool.query("SELECT public.finish_campaign_delivery($1::uuid,$2::boolean)",[item.delivery_id,ok]);
  }
  const result=await asActor(actor,async client=>{
   const r=await client.query<{recipient_count:number;sent_count:number;failed_count:number;status:string;currency:string}>(
    "SELECT recipient_count,sent_count,failed_count,status,currency FROM public.marketing_campaigns WHERE id=$1",[id]);
   return r.rows[0]||null;
  });
  return Response.json({sent,failed,remaining:result?result.recipient_count-result.sent_count-result.failed_count:0,
   status:result?.status||"unknown",total_sent:result?.sent_count||0},{
   headers:{"Cache-Control":"no-store"}
  });
 }catch(e){return responseError(e);}
}
