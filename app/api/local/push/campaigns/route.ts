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
   const quote=await client.query<{
    devices:string;price_cents:number;total_cents:string;currency:string
   }>("SELECT * FROM public.business_push_pricing($1::uuid)",[business]);
   const campaigns=await client.query("SELECT * FROM public.business_push_campaigns_priced($1::uuid)",[business]);
   const usage=await client.query("SELECT * FROM public.business_push_usage($1::uuid)",[business]);
   const price=quote.rows[0];
   return {
    devices:Number(price?.devices||0),price_cents:Number(price?.price_cents||0),
    total_cents:Number(price?.total_cents||0),currency:price?.currency||"MXN",
    campaigns:campaigns.rows,usage:usage.rows
   };
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
  const input=JSON.parse(text) as {business_id?:string;title?:string;body?:string;expected_total_cents?:number};
  if(!/^[a-f0-9-]{36}$/i.test(input.business_id||"")
    ||typeof input.title!=="string"||typeof input.body!=="string"
    ||input.title.trim().length<3||input.title.length>120
    ||input.body.trim().length<3||input.body.length>500
    ||!Number.isSafeInteger(input.expected_total_cents)||Number(input.expected_total_cents)<0)
   throw new ApiError("Completa el título y el mensaje (máximo 500 caracteres).");
  const id=await asActor(actor,async client=>{
   const r=await client.query<{id:string}>("SELECT public.business_create_push_campaign($1::uuid,$2::text,$3::text,$4::bigint) AS id",
    [input.business_id,input.title,input.body,input.expected_total_cents]);
   return r.rows[0].id;
  });
  return Response.json({id},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e);}
}
