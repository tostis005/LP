import {browserCrmAdmin,revokeCrmGrants} from "@/lib/server/crm-oauth";
import {authPool,checkOrigin,responseError} from "@/lib/server/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){
 try{
  const actor=await browserCrmAdmin(request);
  const r=await authPool.query("SELECT count(*)::int AS active,max(token_expires_at) AS expires_at FROM auth.crm_research_grants WHERE user_id=$1 AND revoked_at IS NULL AND token_expires_at>now()",[actor.id]);
  return Response.json(r.rows[0],{headers});
 }catch(e){return responseError(e);}
}
export async function DELETE(request:Request){
 try{
  checkOrigin(request);
  const actor=await browserCrmAdmin(request);
  return Response.json({revoked:await revokeCrmGrants(actor)},{headers});
 }catch(e){return responseError(e);}
}
