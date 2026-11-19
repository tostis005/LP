import {actorFromRequest,asActor,authPool,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {pushConfigured,sendWebPush,type PushDelivery} from "@/lib/server/web-push";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Necesitas iniciar sesión.",401);
  if(!pushConfigured())throw new ApiError("Push no está configurado.",503);
  const text=await request.text();
  if(text.length>250)throw new ApiError("Solicitud inválida.");
  const input=JSON.parse(text) as {campaign_id?:string};
  const id=input.campaign_id||"";
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new ApiError("Campaña inválida.");
  const allowed=await asActor(actor,async client=>{
   const r=await client.query<{allowed:boolean}>("SELECT public.business_can_send_push_campaign($1::uuid) AS allowed",[id]);
   return r.rows[0]?.allowed||false;
  });
  if(!allowed)throw new ApiError("No autorizado para enviar esta campaña.",403);
  let sent=0,failed=0;
  // Máximo 35 destinatarios por petición. La UI puede reanudar los restantes.
  for(let i=0;i<35;i++){
   const q=await authPool.query<PushDelivery>("SELECT * FROM public.claim_push_delivery($1::uuid)",[id]);
   const item=q.rows[0];
   if(!item)break;
   let ok=false,expired=false;
   try{
    await sendWebPush(item);
    ok=true;sent++;
   }catch(error){
    failed++;
    const status=(error as {statusCode?:number}).statusCode;
    expired=status===404||status===410;
    console.warn("Proveedor push rechazó una entrega",status||"error");
   }
   await authPool.query("SELECT public.finish_push_delivery($1::uuid,$2::boolean,$3::boolean)",
    [item.delivery_id,ok,expired]);
  }
  // Una llamada adicional reconcilia la campaña cuando el último lote terminó.
  await authPool.query("SELECT * FROM public.claim_push_delivery($1::uuid)",[id])
   .then(async result=>{
    const item=result.rows[0] as PushDelivery|undefined;
    // Si hay otro mensaje, no se procesa en silencio: se libera para continuar después.
    // No se llama a claim aquí: la conciliación se realiza al no encontrar pendientes.
    if(item)await authPool.query("SELECT public.release_push_delivery($1::uuid)",[item.delivery_id]);
   });
  return Response.json({sent,failed},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e);}
}
