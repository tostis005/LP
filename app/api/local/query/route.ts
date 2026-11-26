import {actorFromRequest,asActor,checkOrigin,responseError} from "@/lib/server/db";
import {queryData,type QueryInput} from "@/lib/server/data-api";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const body=await request.text();
  if(body.length>20000)return Response.json({error:"Solicitud demasiado larga."},{status:413});
  const input=JSON.parse(body) as QueryInput;
  const actor=await actorFromRequest(request);
  const result=await asActor(actor,async c=>{if(actor&&(await c.query("SELECT public.crm_is_marketing() AS marketing")).rows[0]?.marketing)throw Object.assign(new Error("No autorizado"),{code:"42501"});return queryData(c,input);});
  return Response.json(result,{"headers":{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}