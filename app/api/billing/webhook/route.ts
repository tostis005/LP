import type Stripe from "stripe";
import {billingService,stripeServer} from "@/lib/billing-server";
export const runtime="nodejs";

export async function POST(request:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET;
 const signature=request.headers.get("stripe-signature");
 if(!secret||!signature||!process.env.STRIPE_SECRET_KEY){
  return Response.json({error:"Webhook no configurado"},{status:503});
 }
 let event:Stripe.Event;
 try{
  const body=await request.text();
  event=stripeServer().webhooks.constructEvent(body,signature,secret);
 }catch{
  return Response.json({error:"Firma de webhook inválida"},{status:400});
 }
 let businessId:string|undefined,customer:string|null=null,subscription:string|null=null,status:string|null=null;
 if(event.type==="checkout.session.completed"){
  const s=event.data.object as Stripe.Checkout.Session;
  businessId=s.client_reference_id||s.metadata?.lp_business_id||undefined;
  customer=typeof s.customer==="string"?s.customer:s.customer?.id||null;
  subscription=typeof s.subscription==="string"?s.subscription:s.subscription?.id||null;
 }else if(event.type==="customer.subscription.created"||
  event.type==="customer.subscription.updated"||event.type==="customer.subscription.deleted"){
  const s=event.data.object as Stripe.Subscription;
  businessId=s.metadata?.lp_business_id;
  customer=typeof s.customer==="string"?s.customer:s.customer?.id||null;
  subscription=s.id;
  status=s.status;
 }else{
  return Response.json({received:true,handled:false});
 }
 if(!businessId||!/^[a-f0-9-]{36}$/i.test(businessId)){
  return Response.json({received:true,handled:false,reason:"No pertenece a LP"});
 }
 try{
  const {error}=await billingService().rpc("record_billing_event",{
   p_event_id:event.id,p_business:businessId,p_customer:customer,
   p_subscription:subscription,p_status:status,p_event_created:event.created
  });
  if(error){console.error("Error guardando evento de facturación",event.id,error.code);return Response.json({error:"No se pudo procesar el evento"},{status:500})}
  return Response.json({received:true,handled:true});
 }catch(e){
  console.error("Error gestionando webhook",event.id,e instanceof Error?e.name:"desconocido");
  return Response.json({error:"Error del servidor"},{status:500});
 }
}
