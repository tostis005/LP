export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(){
 const base=!!process.env.STRIPE_SECRET_KEY&&!!process.env.NEXT_PUBLIC_SITE_URL;
 return Response.json({checkout:base&&!!process.env.STRIPE_PRICE_BUSINESS,portal:base},{
  headers:{"Cache-Control":"no-store"}
 });
}
