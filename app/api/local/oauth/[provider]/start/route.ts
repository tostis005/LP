import {NextRequest,NextResponse} from "next/server";
import {beginOauth,baseUrl,isProvider,oauthCookie,providerEnabled} from "@/lib/server/oauth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Params={params:Promise<{provider:string}>};
export async function GET(request:NextRequest,{params}:Params){
 const {provider}=await params;
 const site=baseUrl();
 const fallback=site||request.nextUrl.origin;
 if(!isProvider(provider)||!providerEnabled(provider)||!site||request.nextUrl.host!==site.host)
  return NextResponse.redirect(new URL("/mi-loyally?auth_error=not_ready",fallback));
 try{
  const next=request.nextUrl.searchParams.get("next")||"/entrar";
  const {url,state}=await beginOauth(provider,next);
  const response=NextResponse.redirect(url);
  response.headers.set("Set-Cookie",oauthCookie(state));
  response.headers.set("Cache-Control","no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  return response;
 }catch{
  return NextResponse.redirect(new URL("/mi-loyally?auth_error=not_ready",site));
 }
}
