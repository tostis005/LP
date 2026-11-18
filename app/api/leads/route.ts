import {authPool,ApiError,checkOrigin,responseError} from "@/lib/server/db";
export const runtime="nodejs";
const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validCategories=new Set(["Cafetería","Restaurante","Barbería","Belleza","Tienda","Salud y bienestar","Otros"]);
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const raw=await request.text();
  if(raw.length>6000)throw new ApiError("Solicitud demasiado larga.",413);
  const data=JSON.parse(raw) as Record<string,unknown>;
  if(data.website)return Response.json({ok:true});
  const text=(value:unknown)=>typeof value==="string"?value.trim():"";
  const name=text(data.business_name),contact=text(data.contact_name),
   email=text(data.contact_email).toLowerCase(),category=text(data.category),
   city=text(data.city),message=text(data.message);
  if(name.length<2||name.length>120||contact.length<2||contact.length>120||
     city.length<2||city.length>120||!validEmail.test(email)||email.length>254||
     message.length>1000||data.consent_contact!==true)throw new ApiError("Revisa los campos del formulario.");
  if(category&&!validCategories.has(category))throw new ApiError("Categoría no válida.");
  try{
   await authPool.query("SELECT public.submit_business_lead($1,$2,$3,$4,$5,$6,$7)",[name,contact,email,category||null,city,message||null,true]);
  }catch(e){
   if((e as {message?:string}).message?.includes("últimas 24 horas"))return Response.json({ok:true});
   throw e;
  }
  return Response.json({ok:true},{status:201});
 }catch(e){return responseError(e)}
}