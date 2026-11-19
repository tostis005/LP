import {walletAvailable} from "@/lib/server/wallet";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(){
 return Response.json({apple:walletAvailable("apple"),google:walletAvailable("google")},{
  headers:{"Cache-Control":"no-store"}
 });
}
