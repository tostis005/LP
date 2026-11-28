import {createHmac,timingSafeEqual} from "node:crypto";
import {dispatchTransactionPush} from "@/lib/server/transaction-push";
import {ApiError,responseError} from "@/lib/server/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{
  const time=request.headers.get("x-transaction-worker-time")||"",signature=request.headers.get("x-transaction-worker-signature")||"",secret=process.env.AUTH_PGPASSWORD;
  if(!secret||!/^\d{13}$/.test(time)||Math.abs(Date.now()-Number(time))>60000||! /^[a-f0-9]{64}$/.test(signature))throw new ApiError("No autorizado.",401);
  const expected=createHmac("sha256",secret).update("transaction-push-v1:"+time).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))throw new ApiError("No autorizado.",401);
  return Response.json({processed:await dispatchTransactionPush(null,25)},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e);}
}
