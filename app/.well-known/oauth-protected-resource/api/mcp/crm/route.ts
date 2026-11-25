import {resourceMetadata} from "@/lib/server/crm-oauth";
export const runtime="nodejs";
export function GET(){return Response.json(resourceMetadata,{headers:{"Cache-Control":"public, max-age=300"}});}
