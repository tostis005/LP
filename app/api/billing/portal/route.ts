import {billingJsonError,billingSiteUrl,getBillingOwner,stripeServer,BillingError} from "@/lib/billing-server";

export const runtime="nodejs";
export async function POST(request:Request){
 try{
  const {business_id}=await request.json() as {business_id?:string};
  if(!business_id)throw new BillingError("Indica el negocio.");
  const {billing}=await getBillingOwner(request,business_id);
  if(!billing.stripe_customer_id)throw new BillingError("Aún no hay una cuenta de cobro vinculada al negocio.",409);
  const session=await stripeServer().billingPortal.sessions.create({
   customer:billing.stripe_customer_id,
   return_url:billingSiteUrl()+"/negocio/facturacion"
  });
  return Response.json({url:session.url});
 }catch(e){return billingJsonError(e)}
}
