import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {callRpc} from "@/lib/server/data-api";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const body=await request.text();
  if(body.length>10000)throw new ApiError("Solicitud demasiado larga.",413);
  const input=JSON.parse(body) as {name:string;args:Record<string,unknown>};
  const actor=await actorFromRequest(request);
  const result=await asActor(actor,c=>callRpc(c,input.name,input.args||{}));
  return Response.json(result,{"headers":{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}