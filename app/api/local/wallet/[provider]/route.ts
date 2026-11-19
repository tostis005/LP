import {NextRequest,NextResponse} from "next/server";
import {actorFromRequest,asActor,ApiError,responseError} from "@/lib/server/db";
import {appleWalletPass,googleWalletUrl,walletAvailable,type WalletCard} from "@/lib/server/wallet";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Params={params:Promise<{provider:string}>};
export async function GET(request:NextRequest,{params}:Params){
 try{
  const {provider}=await params;
  if(provider!=="google"&&provider!=="apple")throw new ApiError("Wallet no disponible.",404);
  if(!walletAvailable(provider))throw new ApiError("La integración Wallet todavía no está habilitada.",503);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Inicia sesión con tu cuenta de cliente.",401);
  const membership=request.nextUrl.searchParams.get("card")||"";
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(membership))
   throw new ApiError("Tarjeta no válida.");
  const card=await asActor(actor,async client=>{
   const r=await client.query<WalletCard>(
    "SELECT m.id,m.card_token,m.balance,b.name,b.slug,b.accent_color,p.reward_label,p.reward_cost,p.type FROM public.loyalty_memberships m JOIN public.businesses b ON b.id=m.business_id JOIN public.loyalty_programs p ON p.business_id=m.business_id WHERE m.id=$1 AND m.customer_id=$2 LIMIT 1",
    [membership,actor.id]
   );
   return r.rows[0]||null;
  });
  if(!card)throw new ApiError("Esta tarjeta no pertenece a tu cuenta.",403);
  if(provider==="google"){
   const response=NextResponse.redirect(googleWalletUrl(card),303);
   response.headers.set("Cache-Control","no-store");
   response.headers.set("Referrer-Policy","no-referrer");
   return response;
  }
  const pass=await appleWalletPass(card);
  return new Response(new Uint8Array(pass),{
   headers:{"Content-Type":"application/vnd.apple.pkpass",
    "Content-Disposition":'attachment; filename="Loyally-'+card.slug+'.pkpass"',
    "Cache-Control":"private, no-store",
    "Content-Length":String(pass.length)}
  });
 }catch(e){return responseError(e);}
}
