import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validCategories=new Set(["Cafetería","Restaurante","Barbería","Belleza","Tienda","Salud y bienestar","Otros"]);
export async function POST(request:Request){
 const size=Number(request.headers.get("content-length")||0);
 if(size>6000)return Response.json({error:"Solicitud demasiado larga."},{status:413});
 let data:Record<string,unknown>;
 try{data=await request.json()}catch{return Response.json({error:"Solicitud no válida."},{status:400})}
 if(data.website)return Response.json({ok:true});
 const text=(value:unknown)=>typeof value==="string"?value.trim():"";
 const name=text(data.business_name),contact=text(data.contact_name),email=text(data.contact_email).toLowerCase(),
  category=text(data.category),city=text(data.city),message=text(data.message);
 if(name.length<2||name.length>120||contact.length<2||contact.length>120||city.length<2||city.length>120||
    !validEmail.test(email)||email.length>254||message.length>1000||data.consent_contact!==true){
  return Response.json({error:"Revisa los campos y acepta que contactemos contigo para responder a tu solicitud."},{status:400});
 }
 if(category&&!validCategories.has(category)){
  return Response.json({error:"Categoría no válida."},{status:400});
 }
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return Response.json({error:"El formulario de solicitudes aún no está disponible."},{status:503});
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await admin.from("business_leads").insert({
  business_name:name,contact_name:contact,contact_email:email,category:category||null,
  city,message:message||null,consent_contact:true
 });
 if(error){
  if(error.message.includes("últimas 24 horas"))return Response.json({ok:true});
  console.error("No se pudo registrar una solicitud",error.code);
  return Response.json({error:"No hemos podido registrar la solicitud. Inténtalo de nuevo."},{status:500});
 }
 return Response.json({ok:true},{status:201});
}
