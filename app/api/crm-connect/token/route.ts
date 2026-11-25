import {exchangeCrmCode} from "@/lib/server/crm-oauth";
import {rateLimit} from "@/lib/server/auth";
import {ApiError} from "@/lib/server/db";
export const runtime="nodejs";
export async function POST(request:Request){
 const headers={"Cache-Control":"no-store","Pragma":"no-cache"};
 try{
  if(!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")||Number(request.headers.get("content-length")||0)>12000)return Response.json({error:"invalid_request"},{status:400,headers});
  await rateLimit("crm-oauth-token",120,1);
  const raw=await request.text();
  if(raw.length>12000)return Response.json({error:"invalid_request"},{status:400,headers});
  return Response.json(await exchangeCrmCode(new URLSearchParams(raw)),{headers});
 }catch(e){
  const error=e instanceof ApiError&&["invalid_request","invalid_grant"].includes(e.message)?e.message:"temporarily_unavailable";
  return Response.json({error},{status:error==="temporarily_unavailable"?503:400,headers});
 }
}
