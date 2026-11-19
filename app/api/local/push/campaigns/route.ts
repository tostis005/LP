import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {pushConfigured} from "@/lib/server/web-push";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
 try{
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Necesitas iniciar sesión.",401);
  const business=new URL(request.url).searchParams.get("business")||"";
  if(!/^[a-f0-9-]{36}$/i.test(business))throw new ApiError("Negocio inválido.");
  const result=await asActor(actor,async client=>{
   const [quote,campaigns]=await Promise.all([
    client.query("SELECT public.business_push_quote($1::uuid) AS devices",[business]),
    client.query("SELECT * FROM public.business_push_campaigns($1::uuid)",[business])
   ]);
   return {devices:Number(quote.rows[0]?.devices||0),campaigns:campaigns.rows};
  });
  return Response.json({...result,enabled:pushConfigured()},
   {headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e);}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Necesitas iniciar sesión.",401);
  if(!pushConfigured())throw new ApiError("Push aún no está habilitado en el servidor.",503);
  const text=await request.text();
  if(text.length>1200)throw new ApiError("Solicitud demasiado grande.",413);
  const input=JSON.parse(text) as {business_id?:string;title?:string;body?:string};
  if(!/^[a-f0-9-]{36}$/i.test(input.business_id||"")
    ||typeof input.title!=="string"||typeof input.body!=="string"
    ||input.title.trim().length<3||input.title.length>120
    ||input.body.trim().length<3||input.body.length>500)
   throw new ApiError("Completa el título y el mensaje (máximo 500 caracteres).");
  const id=await asActor(actor,async client=>{
   const r=await client.query<{id:string}>("SELECT public.business_create_push_campaign($1::uuid,$2::text,$3::text) AS id",
    [input.business_id,input.title,input.body]);
   return r.rows[0].id;
  });
  return Response.json({id},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e);}
}
