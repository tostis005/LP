import {NextRequest,NextResponse} from "next/server";
import {baseUrl,consumeAttempt,exchangeCode,findOrCreateUser,isProvider,oauthCookie,readOauthCookie,verifyIdentity} from "@/lib/server/oauth";
import {createSession,setSessionCookie} from "@/lib/server/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Params={params:Promise<{provider:string}>};
function failure(request:NextRequest){
 const root=baseUrl()||request.nextUrl.origin;
 const response=NextResponse.redirect(new URL("/mi-loyally?auth_error=login",root),303);
 response.headers.append("Set-Cookie",oauthCookie("",0));
 response.headers.set("Cache-Control","no-store");
 response.headers.set("Referrer-Policy","no-referrer");
 return response;
}
async function finish(request:NextRequest,providerValue:string,params:URLSearchParams){
 if(!isProvider(providerValue)||params.get("error")||!params.get("state")||!params.get("code"))
  return failure(request);
 try{
  const site=baseUrl();
  if(!site||new URL(request.url).host!==site.host)return failure(request);
  const state=params.get("state")!,code=params.get("code")!;
  const attempt=await consumeAttempt(providerValue,state,readOauthCookie(request));
  const token=await exchangeCode(providerValue,code,attempt);
  const identity=await verifyIdentity(providerValue,token,attempt.nonce);
  const userId=await findOrCreateUser(providerValue,identity);
  const session=await createSession(userId);
  const response=NextResponse.redirect(new URL(attempt.return_to,site),303);
  response.headers.append("Set-Cookie",oauthCookie("",0));
  response.headers.set("Referrer-Policy","no-referrer");
  response.headers.set("Cache-Control","no-store");
  return setSessionCookie(response,session.token,session.expires);
 }catch{
  return failure(request);
 }
}
export async function GET(request:NextRequest,{params}:Params){
 const {provider}=await params;
 if(provider!=="google")return failure(request);
 return finish(request,provider,request.nextUrl.searchParams);
}
export async function POST(request:NextRequest,{params}:Params){
 const {provider}=await params;
 if(provider!=="apple")return failure(request);
 if(Number(request.headers.get("content-length")||0)>8192)return failure(request);
 if(!(request.headers.get("content-type")||"").startsWith("application/x-www-form-urlencoded"))return failure(request);
 try{
  const data=await request.text();
  if(data.length>8192)return failure(request);
  return finish(request,provider,new URLSearchParams(data));
 }catch{return failure(request);}
}
