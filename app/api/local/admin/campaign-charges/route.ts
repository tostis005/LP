import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
type Line={offer_id:string;business_name:string;business_id:string;offer_title:string;
 channel:string;recipients:number;unit_price_cents:number;amount_cents:string;
 currency:string;confirmed_at:string;invoiced_at:string|null;invoice_reference:string|null};
const uuid=/^[a-f0-9-]{36}$/i;
async function authorized(actor:NonNullable<Awaited<ReturnType<typeof actorFromRequest>>>){
 return asActor(actor,async client=>{
  const check=await client.query<{allowed:boolean}>("SELECT public.is_platform_admin() AS allowed");
  if(!check.rows[0]?.allowed)throw new ApiError("Solo la administración puede gestionar los cargos.",403);
  return true;
 });
}
export async function GET(request:Request){
 try{
  const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);
  await authorized(actor);
  const url=new URL(request.url),all=url.searchParams.get("all")==="true";
  const lines=await asActor(actor,async client=>(await client.query<Line>(
   "SELECT c.offer_id,c.business_id,b.name AS business_name,o.title AS offer_title,c.channel,c.recipients,"+
   "c.unit_price_cents,c.amount_cents,c.currency,c.confirmed_at,c.invoiced_at,c.invoice_reference "+
   "FROM public.offer_campaign_charges c JOIN public.businesses b ON b.id=c.business_id "+
   "JOIN public.business_offers o ON o.id=c.offer_id "+
   (all?"":"WHERE c.invoiced_at IS NULL ")+
   "ORDER BY c.confirmed_at DESC LIMIT 1000")).rows);
  if(url.searchParams.get("format")==="csv"){
   // Protegemos las hojas de cálculo contra fórmulas inyectadas por nombres comerciales.
   function csvCell(value:unknown){
    let s=String(value??"");
    if(/^[=+@\-\t\r]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
   }
   const keys=["business_name","offer_title","channel","recipients","unit_price_cents","amount_cents",
    "currency","confirmed_at","invoiced_at","invoice_reference","offer_id"];
   const content="\ufeff"+keys.map(csvCell).join(",")+"\r\n"+lines.map(row=>keys.map(k=>csvCell(row[k as keyof Line])).join(",")).join("\r\n");
   return new Response(content,{headers:{...headers,"Content-Type":"text/csv; charset=utf-8",
    "Content-Disposition":'attachment; filename="kreyv-cargos-campanas.csv"'}});
  }
  return Response.json({charges:lines},{headers});
 }catch(e){return responseError(e)}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);
  await authorized(actor);
  const raw=await request.text();if(raw.length>500)throw new ApiError("Solicitud demasiado larga.",413);
  const input=JSON.parse(raw) as {offer_id?:string;invoice_reference?:string};
  const id=input.offer_id||"",reference=input.invoice_reference?.trim()||"";
  if(!uuid.test(id)||reference.length<3||reference.length>100||/[\x00-\x1f]/.test(reference))
   throw new ApiError("Indica una referencia de factura válida (3 a 100 caracteres).");
  const count=await asActor(actor,async client=>{
   const check=await client.query<{allowed:boolean}>("SELECT public.is_platform_admin() AS allowed");
   if(!check.rows[0]?.allowed)throw new ApiError("No autorizado.",403);
   const r=await client.query(
    "UPDATE public.offer_campaign_charges SET invoiced_at=now(),invoice_reference=$2 "+
    "WHERE offer_id=$1::uuid AND invoiced_at IS NULL RETURNING offer_id",[id,reference]);
   if(!r.rowCount)throw new ApiError("No hay cargos pendientes para esta campaña.",404);
   return r.rowCount;
  });
  return Response.json({ok:true,lines:count},{headers});
 }catch(e){return responseError(e)}
}
