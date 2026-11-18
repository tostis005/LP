import Stripe from "stripe";
import {createClient} from "@supabase/supabase-js";

export class BillingError extends Error {
 constructor(message:string,public status:number=400){super(message)}
}
export function stripeServer():Stripe{
 const secret=process.env.STRIPE_SECRET_KEY;
 if(!secret)throw new BillingError("Stripe aún no está configurado en el servidor.",503);
 return new Stripe(secret);
}
export function billingService(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new BillingError("La facturación del servidor todavía no está configurada.",503);
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function getBillingOwner(request:Request,businessId:string){
 if(!/^[a-f0-9-]{36}$/i.test(businessId))throw new BillingError("Identificador del negocio inválido.");
 const token=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)throw new BillingError("Debes iniciar sesión para gestionar la suscripción.",401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!anon)throw new BillingError("No está configurado Supabase.",503);
 const verifier=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const result=await verifier.auth.getUser(token);
 if(result.error||!result.data.user)throw new BillingError("Sesión no válida.",401);
 const service=billingService();
 const {data:role,error}=await service.from("business_members")
 .select("user_id").eq("business_id",businessId).eq("user_id",result.data.user.id)
 .eq("active",true).eq("role","owner").maybeSingle();
 if(error)throw new BillingError("No se pudieron validar los permisos.",500);
 if(!role)throw new BillingError("Solo el propietario puede gestionar la facturación.",403);
 const [{data:business,error:be},{data:billing,error:bi}]=await Promise.all([
  service.from("businesses").select("id,name,active").eq("id",businessId).maybeSingle(),
  service.from("business_billing").select("stripe_customer_id,stripe_subscription_id,status").eq("business_id",businessId).maybeSingle()
 ]);
 if(be||bi||!business||!billing)throw new BillingError("Cuenta del negocio no encontrada.",404);
 if(!business.active)throw new BillingError("El negocio está suspendido. Contacta con administración.",403);
 return {service,user:result.data.user,business,billing};
}
export function billingSiteUrl(){
 const raw=process.env.NEXT_PUBLIC_SITE_URL;
 if(!raw)throw new BillingError("Configura NEXT_PUBLIC_SITE_URL en el servidor.",503);
 let url:URL;
 try{url=new URL(raw)}catch{throw new BillingError("NEXT_PUBLIC_SITE_URL no es una URL válida.",503)}
 if(!["https:","http:"].includes(url.protocol))throw new BillingError("URL de la plataforma inválida.",503);
 return url.origin;
}
export function billingJsonError(error:unknown){
 const status=error instanceof BillingError?error.status:500;
 const message=error instanceof BillingError?error.message:"No se ha podido iniciar la operación de facturación.";
 return Response.json({error:message},{status});
}
