import {baseUrl,providerEnabled} from "@/lib/server/oauth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(request:Request){
 const site=baseUrl();
 const sameHost=!!site&&new URL(request.url).host===site.host;
 return Response.json({google:sameHost&&providerEnabled("google"),apple:sameHost&&providerEnabled("apple")},{
  headers:{"Cache-Control":"no-store"}
 });
}
