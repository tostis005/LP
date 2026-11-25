import {oauthMetadata} from "@/lib/server/crm-oauth";
export const runtime="nodejs";
export function GET(){return Response.json(oauthMetadata,{headers:{"Cache-Control":"public, max-age=300"}});}
