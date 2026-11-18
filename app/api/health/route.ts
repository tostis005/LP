import {apiPool} from "@/lib/server/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() {
 try {
  await apiPool.query("SELECT 1");
  return Response.json({status:"ok",database:"connected"},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return Response.json({status:"unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}