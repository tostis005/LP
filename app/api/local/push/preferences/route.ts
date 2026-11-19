import {actorFromRequest,asActor,authPool,checkOrigin,responseError,ApiError} from "@/lib/server/db";
import {trustedPushEndpoint} from "@/lib/server/web-push";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
 try{
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Necesitas iniciar sesión.",401);
  const data=await asActor(actor,async client=>{
   const r=await client.query("SELECT * FROM public.customer_push_preferences()");
   return r.rows;
  });
  return Response.json({businesses:data},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e);}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Necesitas iniciar sesión.",401);
  const text=await request.text();
  if(text.length>7000)throw new ApiError("Solicitud demasiado grande.",413);
  const input=JSON.parse(text) as {
   action?:string;endpoint?:string;keys?:{p256dh?:string;auth?:string};
   business_id?:string;opted_in?:boolean;
  };
  if(input.action==="subscribe"){
   const endpoint=input.endpoint||"",p256dh=input.keys?.p256dh||"",auth=input.keys?.auth||"";
   if(!trustedPushEndpoint(endpoint)
    || !/^[A-Za-z0-9_-]{40,256}$/.test(p256dh)
    || !/^[A-Za-z0-9_-]{16,256}$/.test(auth))throw new ApiError("Suscripción push inválida.");
   await authPool.query("SELECT public.register_web_push_subscription($1::uuid,$2::text,$3::text,$4::text)",
    [actor.id,endpoint,p256dh,auth]);
  }else if(input.action==="unsubscribe"){
   if(!input.endpoint||!trustedPushEndpoint(input.endpoint))throw new ApiError("Suscripción inválida.");
   await authPool.query("SELECT public.unregister_web_push_subscription($1::uuid,$2::text)",
    [actor.id,input.endpoint]);
  }else if(input.action==="consent"){
   if(!/^[a-f0-9-]{36}$/i.test(input.business_id||"")||typeof input.opted_in!=="boolean")
    throw new ApiError("Preferencia inválida.");
   await asActor(actor,async client=>{
    await client.query("SELECT public.customer_set_push_consent($1::uuid,$2::boolean)",
     [input.business_id,input.opted_in]);
   });
  }else throw new ApiError("Operación inválida.");
  return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e);}
}
