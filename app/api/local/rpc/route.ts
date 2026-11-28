import {actorFromRequest,asActor,authPool,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {callRpc} from "@/lib/server/data-api";
import {notifyReward} from "@/lib/server/reward-mail";
import {dispatchTransactionPush} from "@/lib/server/transaction-push";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const body=await request.text();
  if(body.length>10000)throw new ApiError("Solicitud demasiado larga.",413);
  const input=JSON.parse(body) as {name:string;args:Record<string,unknown>};
  const actor=await actorFromRequest(request);
  if(input.name==="staff_sync_award"&&!actor)throw new ApiError("Vuelve a iniciar sesión para sincronizar las compras pendientes.",401);
  const args={...(input.args||{})};
  const rawToken=typeof args.p_token==="string"?args.p_token:"";
  const award=input.name==="staff_award_card"||input.name==="staff_sync_award";
  const cardOperation=award||["staff_lookup_card","staff_redeem_card","staff_redeem_card_choice"].includes(input.name);
  if(actor&&cardOperation&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(rawToken)){
   const resolved=await authPool.query<{token:string}>("SELECT public.resolve_device_card_token($1::uuid) AS token",[rawToken]);
   args.p_token=resolved.rows[0]?.token||rawToken;
  }
  const {result,eventId}=await asActor(actor,async c=>{
   if(actor&&(await c.query("SELECT public.crm_is_marketing() AS marketing")).rows[0]?.marketing)throw Object.assign(new Error("No autorizado"),{code:"42501"});
   if(award&&args.p_token!==rawToken)await c.query("SELECT set_config('kreyvi.card_device_qr',$1,true)",[rawToken]);
   const result=await callRpc(c,input.name,args);
   const eventId=award?(await c.query<{id:string|null}>("SELECT nullif(current_setting('kreyvi.transaction_push_id',true),'') AS id")).rows[0]?.id:null;
   return {result,eventId};
  });
  if(eventId){try{await dispatchTransactionPush(eventId)}catch{console.warn("Aviso de compra pendiente de reintento");}}
  if((input.name==="staff_award_card"||input.name==="staff_sync_award")&&typeof input.args?.p_token==="string"){
   try{await notifyReward(String(args.p_token))}catch(e){console.warn("Notificación de premio pendiente",e instanceof Error?e.message:"Error SMTP")}
  }
  return Response.json(result,{"headers":{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}