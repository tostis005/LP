import {actorFromRequest,asActor,checkOrigin,ApiError,responseError} from "@/lib/server/db";
import {researchQueue,recordResearch,parseEvidence} from "@/lib/server/crm-research";
import type {PoolClient} from "pg";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
async function withAdmin<T>(request:Request,action:(c:PoolClient)=>Promise<T>){
 const actor=await actorFromRequest(request);
 if(!actor)throw new ApiError("Inicia sesión.",401);
 return asActor(actor,async c=>{
  if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);
  return action(c);
 });
}
export async function GET(request:Request){
 try{return Response.json(await withAdmin(request,c=>researchQueue(c,new URL(request.url).searchParams.get("after")||"")),{headers});}
 catch(e){return responseError(e);}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  await withAdmin(request,async()=>true);
  const raw=await request.text();if(raw.length>80000)throw new ApiError("Solicitud demasiado grande.",413);
  const payload=JSON.parse(raw) as {reviews?:unknown};
  const reviews=parseEvidence(payload?.reviews);
  return Response.json({results:await withAdmin(request,c=>recordResearch(c,reviews))},{headers});
 }catch(e){return responseError(e);}
}
