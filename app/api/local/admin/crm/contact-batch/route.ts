import {actorFromRequest,asActor,checkOrigin,ApiError,responseError} from "@/lib/server/db";
import {parseContactCsv,contactBatch} from "@/lib/server/crm-contact-batch";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Inicia sesión.",401);
  return await asActor(actor,async c=>{
   if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);
   const raw=await request.text();
   if(raw.length>1024*1024)throw new ApiError("El archivo supera 1 MB.",413);
   const v=JSON.parse(raw);
   if(!v||typeof v.csv!=="string"||!["preview","apply"].includes(v.mode)||v.mode==="apply"&&!Array.isArray(v.selected))throw new ApiError("Solicitud inválida.");
   const data=await contactBatch(c,parseContactCsv(v.csv),v.mode==="apply"?v.selected:undefined);
   return Response.json(data,{headers:{"Cache-Control":"no-store"}});
  });
 }catch(e){return responseError(e);}
}
