import {randomUUID} from "node:crypto";
import {actorFromRequest,asActor,authPool,checkOrigin,hashToken,responseError,ApiError} from "@/lib/server/db";
import {rateLimit} from "@/lib/server/auth";
import {pushConfigured,sendWebPush,trustedPushEndpoint} from "@/lib/server/web-push";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Device={endpoint:string;p256dh:string;auth:string};
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Inicia sesión para probar las notificaciones.",401);
  if(!pushConfigured())throw new ApiError("El servicio push no está disponible.",503);
  const raw=await request.text();
  if(raw.length>3000)throw new ApiError("Solicitud demasiado grande.",413);
  const input=JSON.parse(raw) as {endpoint?:string};
  const endpoint=input.endpoint||"";
  if(!trustedPushEndpoint(endpoint))throw new ApiError("Este dispositivo no tiene una suscripción push válida.",400);
  const device=await asActor(actor,async client=>(await client.query<Device>(
   "SELECT * FROM public.customer_push_subscription($1::text)",[endpoint])).rows[0]);
  if(!device)throw new ApiError("Este móvil no está vinculado a tu cuenta. Repara las notificaciones en Ajustes.",409);
  await rateLimit("push-self-test:"+hashToken(actor.id).slice(0,24),3,10);
  try{
   await sendWebPush({...device,delivery_id:randomUUID(),business_name:"Kreyv",
    title:"Notificación de prueba",body_text:"Si ves este aviso, Kreyv puede enviar notificaciones a tu teléfono.",
    offer_id:null});
  }catch(e){
   const status=(e as {statusCode?:number}).statusCode;
   if(status===404||status===410){
    await authPool.query(
     "UPDATE public.web_push_subscriptions SET active=false,updated_at=now() "+
     "WHERE customer_id=$1::uuid AND endpoint=$2",[actor.id,endpoint]);
   }
   if(status===403||status===404||status===410)
    throw new ApiError("La suscripción está desactualizada. Pulsa «Reparar notificaciones» y repite la prueba.",409);
   throw new ApiError("No se ha podido entregar la prueba al proveedor push. Comprueba la conexión e inténtalo de nuevo.",502);
  }
  return Response.json({accepted:true,message:"El proveedor ha aceptado la prueba. Comprueba si el teléfono muestra el aviso."},
   {headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}
