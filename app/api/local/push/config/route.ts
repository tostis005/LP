import {pushConfigured,pushPublicKey} from "@/lib/server/web-push";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(){
 return Response.json({enabled:pushConfigured(),publicKey:pushPublicKey()},
  {headers:{"Cache-Control":"no-store"}});
}
