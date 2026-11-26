import {safeJoinTarget,PUBLIC_SITE_URL} from "@/lib/public-url";
import { NextRequest,NextResponse } from "next/server";
import { authPool, hashToken } from "@/lib/server/db";
import {createSession,setSessionCookie} from "@/lib/server/auth";
export const runtime="nodejs";

export async function GET(request:NextRequest) {
  const purpose=request.nextUrl.searchParams.get("purpose");
  const token=request.nextUrl.searchParams.get("token")||"";
  const root=process.env.NEXT_PUBLIC_SITE_URL||PUBLIC_SITE_URL;
  const invalid=()=>NextResponse.redirect(new URL("/acceder?enlace=caducado",root));
  if(!["verify","reset"].includes(purpose||"")||!/^[a-f0-9]{64}$/.test(token))return invalid();
  try {
    const result=await authPool.query(
      "DELETE FROM auth.email_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING user_id",
      [hashToken(token),purpose]
    );
    if(!result.rowCount)return invalid();
    const userId=result.rows[0].user_id as string;
    if(purpose==="verify")await authPool.query("UPDATE auth.users SET email_confirmed_at=now(),updated_at=now() WHERE id=$1",[userId]);
    const session=await createSession(userId);
    const invited=(await authPool.query("SELECT raw_user_meta_data->>\x27crm_marketing_invited\x27 AS invited FROM auth.users WHERE id=$1",[userId])).rows[0]?.invited==="true";
    const response=NextResponse.redirect(new URL(purpose==="reset"||invited?"/restablecer-clave":safeJoinTarget(request.nextUrl.searchParams.get("next"))||"/entrar",root));
    response.headers.set("Referrer-Policy","no-referrer");
    return setSessionCookie(response,session.token,session.expires);
  }catch{return invalid()}
}