import Stripe from "stripe";
import {authPool,actorFromRequest,asActor,checkOrigin} from "@/lib/server/db";

export class BillingError extends Error {
 constructor(message:string,public status:number=400){super(message)}
}
export function stripeServer():Stripe {
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key)throw new BillingError("Stripe aún no está configurado en el servidor.",503);
 return new Stripe(key);
}
export async function getBillingOwner(request:Request,businessId:string) {
 checkOrigin(request);
 if(!/^[a-f0-9-]{36}$/i.test(businessId))throw new BillingError("Identificador de negocio inválido.");
 const user=await actorFromRequest(request);
 if(!user)throw new BillingError("Debes iniciar sesión.",401);
 const result=await asActor(user,async client=>{
  const owner=await client.query(
   "SELECT 1 FROM public.business_members WHERE business_id=$1 AND user_id=$2 AND active AND role='owner'",
   [businessId,user.id]
  );
  if(!owner.rowCount)throw new BillingError("Solo el propietario puede gestionar la facturación.",403);
  const b=await client.query("SELECT id,name,active FROM public.businesses WHERE id=$1",[businessId]);
  const bill=await client.query(
   "SELECT stripe_customer_id,stripe_subscription_id,status FROM public.business_billing WHERE business_id=$1",
   [businessId]
  );
  return {business:b.rows[0],billing:bill.rows[0]};
 });
 if(!result.business||!result.billing)throw new BillingError("Negocio no encontrado.",404);
 if(!result.business.active)throw new BillingError("El negocio está suspendido.",403);
 return {...result,user};
}
export function billingService() {
 return {async rpc(name:string,args:Record<string,unknown>){
  if(name!=="record_billing_event")return {error:{message:"Operación no autorizada",code:"403"}};
  try {
   const client=await authPool.connect();
   try{
    await client.query("BEGIN");
    await client.query("SELECT set_config(\u0027request.jwt.claim.role\u0027,\u0027service_role\u0027,true)");
    await client.query("SELECT public.record_billing_event($1::text,$2::uuid,$3::text,$4::text,$5::text,$6::bigint)",
      [args.p_event_id,args.p_business,args.p_customer,args.p_subscription,args.p_status,args.p_event_created]);
    await client.query("COMMIT");
   }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}
   finally{client.release()}
   return {error:null};
  }catch(e){return {error:{message:"No se pudo guardar el evento",code:(e as {code?:string}).code||"unknown"}}}
 }};
}
export function billingSiteUrl() {
 const raw=process.env.NEXT_PUBLIC_SITE_URL;
 if(!raw)throw new BillingError("Configura NEXT_PUBLIC_SITE_URL.",503);
 try{
  const url=new URL(raw);
  if(!["https:","http:"].includes(url.protocol))throw new Error("URL inválida");
  return url.origin;
 }catch{throw new BillingError("NEXT_PUBLIC_SITE_URL inválida.",503)}
}
export function billingJsonError(e:unknown) {
 const status=e instanceof BillingError?e.status:500;
 const message=e instanceof BillingError?e.message:"No se ha podido iniciar la operación de facturación.";
 if(status===500)console.error("LP billing error");
 return Response.json({error:message},{status});
}