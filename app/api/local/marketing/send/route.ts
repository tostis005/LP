import {actorFromRequest,asActor,authPool,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {sendMail,smtpReady} from "@/lib/server/auth";
export const runtime="nodejs";

type Delivery={delivery_id:string;email:string;subject:string;body_text:string;business_name:string;unsubscribe_token:string};
export async function POST(request:Request){
 try{
  checkOrigin(request);
  if(process.env.LP_ENABLE_MARKETING_SEND!=="true"||!smtpReady()||!process.env.NEXT_PUBLIC_SITE_URL)
   throw new ApiError("El envío de campañas no está activado. Configura SMTP y LP_ENABLE_MARKETING_SEND.",503);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Necesitas iniciar sesión.",401);
  const raw=await request.text();if(raw.length>1500)throw new ApiError("Solicitud demasiado larga.");
  const input=JSON.parse(raw) as {campaign_id?:string;expected_total_cents?:number};
  const id=String(input.campaign_id||"");
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new ApiError("Campaña inválida.");
  const scope=await asActor(actor,async client=>{
   const c=await client.query<{status:string;authorized:boolean}>(
    "SELECT status,(public.is_business_manager(business_id) OR public.is_platform_admin()) AS authorized FROM public.marketing_campaigns WHERE id=$1",[id]);
   if(!c.rowCount||!c.rows[0].authorized)throw new ApiError("No autorizado.",403);
   if(c.rows[0].status==="draft"){
    if(!Number.isSafeInteger(input.expected_total_cents)||Number(input.expected_total_cents)<0)
     throw new ApiError("Confirma el presupuesto de esta campaña.");
    await client.query("SELECT public.queue_business_campaign($1::uuid,$2::bigint)",[id,input.expected_total_cents]);
   }
   return c.rows[0].status;
  });
  if(["sent","partial","failed"].includes(scope))return Response.json({sent:0,failed:0,remaining:0,status:scope});
  const site=process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/,"");
  let sent=0,failed=0;
  // Lote deliberadamente acotado para evitar timeouts y duplicados de facturación.
  for(let i=0;i<10;i++){
   const reserved=await authPool.query<Delivery>("SELECT * FROM public.claim_campaign_delivery($1::uuid)",[id]);
   const d=reserved.rows[0];if(!d)break;
   let ok=false;
   try{
    await sendMail(d.email,d.subject,
     d.body_text+"\n\n---\nRecibes este mensaje porque aceptaste recibir campañas de "+d.business_name+
     ". Para dejar de recibirlas: "+site+"/baja/"+d.unsubscribe_token);
    ok=true;sent++;
   }catch(e){failed++;console.warn("Entrega de campaña fallida",e instanceof Error?e.message:"SMTP");}
   await authPool.query("SELECT public.finish_campaign_delivery($1::uuid,$2::boolean)",[d.delivery_id,ok]);
  }
  const result=await asActor(actor,async client=>{
   const r=await client.query<{recipient_count:number;sent_count:number;failed_count:number;status:string;currency:string}>(
    "SELECT recipient_count,sent_count,failed_count,status,currency FROM public.marketing_campaigns WHERE id=$1",[id]);
   return r.rows[0]||null;
  });
  return Response.json({sent,failed,remaining:result?result.recipient_count-result.sent_count-result.failed_count:0,status:result?.status||"unknown",total_sent:result?.sent_count||0},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}
