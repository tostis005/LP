import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {callRpc} from "@/lib/server/data-api";
import {notifyReward} from "@/lib/server/reward-mail";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const body=await request.text();
  if(body.length>10000)throw new ApiError("Solicitud demasiado larga.",413);
  const input=JSON.parse(body) as {name:string;args:Record<string,unknown>};
  const actor=await actorFromRequest(request);
  if(input.name==="staff_sync_award"&&!actor)throw new ApiError("Vuelve a iniciar sesión para sincronizar las compras pendientes.",401);
  const result=await asActor(actor,async c=>{if(actor&&(await c.query("SELECT public.crm_is_marketing() AS marketing")).rows[0]?.marketing)throw Object.assign(new Error("No autorizado"),{code:"42501"});return callRpc(c,input.name,input.args||{});});
  if((input.name==="staff_award_card"||input.name==="staff_sync_award")&&typeof input.args?.p_token==="string"){
   try{await notifyReward(input.args.p_token)}catch(e){console.warn("Notificación de premio pendiente",e instanceof Error?e.message:"Error SMTP")}
  }
  return Response.json(result,{"headers":{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}