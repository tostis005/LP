import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {trustedPushEndpoint} from "@/lib/server/web-push";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);
  const raw=await request.text();if(raw.length>4000)throw new ApiError("Solicitud demasiado larga.",413);
  const input=JSON.parse(raw) as {action?:string;endpoint?:string;membership?:string;enabled?:boolean};
  if(typeof input.endpoint!=="string"||!trustedPushEndpoint(input.endpoint))throw new ApiError("Suscripción inválida.");
  const data=await asActor(actor,async c=>{
   if(input.action==="qr"&&uuid.test(input.membership||"")){
    const r=await c.query("SELECT public.customer_device_card_qr($1::uuid,$2::text) AS token",[input.membership,input.endpoint]);
    return {token:r.rows[0]?.token||null};
   }
   if(input.action==="preference"&&(input.enabled===undefined||typeof input.enabled==="boolean")){
    const r=await c.query("SELECT public.customer_transaction_push_preference($1::text,$2::boolean) AS enabled",[input.endpoint,input.enabled??null]);
    return {enabled:r.rows[0]?.enabled??null};
   }
   throw new ApiError("Acción inválida.");
  });
  return Response.json(data,{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e);}
}
