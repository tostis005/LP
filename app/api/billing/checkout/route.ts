import {billingJsonError,billingSiteUrl,getBillingOwner,stripeServer,BillingError} from "@/lib/billing-server";

export const runtime="nodejs";
export async function POST(request:Request){
 try{
  const {business_id}=await request.json() as {business_id?:string};
  if(!business_id)throw new BillingError("Indica el negocio.");
  const price=process.env.STRIPE_PRICE_BUSINESS;
  if(!price)throw new BillingError("El plan de Stripe todavía no está configurado.",503);
  const {business,billing,user}=await getBillingOwner(request,business_id);
  if(["active","trialing"].includes(billing.status)&&billing.stripe_subscription_id){
   throw new BillingError("Ya existe una suscripción. Gestiona los cambios desde el portal de facturación.",409);
  }
  const stripe=stripeServer();
  const site=billingSiteUrl();
  const session=await stripe.checkout.sessions.create({
   mode:"subscription",
   line_items:[{price,quantity:1}],
   success_url:site+"/negocio/facturacion?checkout=success",
   cancel_url:site+"/negocio/facturacion?checkout=cancel",
   client_reference_id:business.id,
   metadata:{lp_business_id:business.id},
   subscription_data:{metadata:{lp_business_id:business.id,lp_plan:"business"}},
   ...(billing.stripe_customer_id?{customer:billing.stripe_customer_id}:{customer_email:user.email||undefined}),
   allow_promotion_codes:true
  });
  if(!session.url)throw new BillingError("Stripe no ha devuelto una dirección de pago.",502);
  return Response.json({url:session.url});
 }catch(e){return billingJsonError(e)}
}
