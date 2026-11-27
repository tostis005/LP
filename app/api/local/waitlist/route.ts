import {ApiError,authPool,actorFromRequest,asActor,checkOrigin,hashToken,responseError} from "@/lib/server/db";
import {rateLimit,validateEmail} from "@/lib/server/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const raw=await request.text();
  if(raw.length>10000)throw new ApiError("Solicitud demasiado larga.",413);
  const data=JSON.parse(raw);
  if(!data||typeof data!=="object"||Array.isArray(data))throw new ApiError("Datos no válidos.");
  const get=(key:string,max=120)=>typeof data[key]==="string"?data[key].trim().slice(0,max):"";
  const name=get("name"),city=get("city").replace(/\s+/g," "),country=get("country"),kind=get("kind");
  const email=get("email",254).toLowerCase(),privacy=data.privacy===true;
  let phone=get("whatsapp",40).replace(/[\s().-]/g,"");
  const prefix=country==="MX"?"+52":country==="ES"?"+34":"";
  if(!prefix)throw new ApiError("Selecciona México o España.");
  if(phone.startsWith("00"))phone="+"+phone.slice(2);
  if(!phone.startsWith("+"))phone=prefix+phone;
  if(!phone.startsWith(prefix)||!(country==="MX"?/^\+52[0-9]{10}$/:/^\+34[0-9]{9}$/).test(phone))throw new ApiError("Introduce un WhatsApp válido para el país seleccionado.");
  if(name.length<2||city.length<2||!["user","business"].includes(kind)||!privacy||email&&!validateEmail(email))throw new ApiError("Revisa los campos obligatorios y acepta el aviso de privacidad.");
  const businessName=kind==="business"?get("business_name"):null,businessType=kind==="business"?get("business_type"):null,branches=kind==="business"?Number(data.branches):null;
  if(kind==="business"&&(!businessName||!["cafe","restaurant","other"].includes(businessType||"")||!Number.isInteger(branches)||Number(branches)<1||Number(branches)>10000))throw new ApiError("Completa los datos de tu negocio.");
  if(get("website"))throw new ApiError("Solicitud no válida.");
  const ip=request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()||request.headers.get("x-real-ip")||"unknown";
  await rateLimit("waitlist:ip:"+hashToken(ip),60,15);
  await rateLimit("waitlist:phone:"+hashToken(phone),6,60);
  const cityKey=city.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const utms=["utm_source","utm_medium","utm_campaign","utm_content","utm_term","utm_id"].map(k=>get(k,200)||null);
  const result=await authPool.query("INSERT INTO public.waitlist_entries(name,country,whatsapp,email,city,city_key,kind,business_name,business_type,branches,privacy_version,pixel_consent,utm_source,utm_medium,utm_campaign,utm_content,utm_term,utm_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT(whatsapp) DO NOTHING RETURNING id",[name,country,phone,email||null,city,cityKey,kind,businessName,businessType,branches,"2026-11-27",data.pixel_consent===true,...utms]);
  return Response.json({ok:true,created:result.rowCount===1},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}
export async function GET(request:Request){
 try{
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Acceso restringido.",401);
  const admin=await asActor(actor,async client=>(await client.query("SELECT 1 FROM public.platform_admins WHERE user_id=$1",[actor.id])).rowCount===1);
  if(!admin)throw new ApiError("Acceso restringido.",403);
  const result=await authPool.query("SELECT id,created_at,name,country,whatsapp,email,city,city_key,kind,business_name,business_type,branches,privacy_version,pixel_consent,utm_source,utm_medium,utm_campaign,utm_content,utm_term,utm_id FROM public.waitlist_entries ORDER BY created_at DESC");
  return Response.json({entries:result.rows},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return responseError(e)}
}
