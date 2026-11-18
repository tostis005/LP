import {authPool,checkOrigin,responseError,ApiError} from "@/lib/server/db";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const f=await request.formData(),token=String(f.get("token")||"");
  if(!/^[a-f0-9-]{36}$/i.test(token))throw new ApiError("Enlace de baja no válido.");
  await authPool.query("SELECT public.unsubscribe_campaign_recipient($1::uuid)",[token]);
  const site=process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin;
  return Response.redirect(site.replace(/\/$/,"")+"/baja/confirmada",303);
 }catch(e){return responseError(e)}
}
