import {createHash,createPrivateKey,createPublicKey,randomBytes,sign,timingSafeEqual,verify} from "node:crypto";
import {authPool,ApiError,hashToken} from "@/lib/server/db";
import {validateEmail} from "@/lib/server/auth";

export type OAuthProvider="google"|"apple";
export function isProvider(value:string):value is OAuthProvider{return value==="google"||value==="apple";}
type Credentials={clientId:string;clientSecret:string};
const origins={
 google:{issuer:["https://accounts.google.com","accounts.google.com"],auth:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token",keys:"https://www.googleapis.com/oauth2/v3/certs"},
 apple:{issuer:["https://appleid.apple.com"],auth:"https://appleid.apple.com/auth/authorize",token:"https://appleid.apple.com/auth/token",keys:"https://appleid.apple.com/auth/keys"}
} as const;

export function baseUrl():URL|null{
 const site=process.env.NEXT_PUBLIC_SITE_URL;
 if(!site)return null;
 try{
  const u=new URL(site);
  if(u.username||u.password||u.pathname!=="/"||u.search||u.hash)return null;
  if(u.protocol!=="https:"&&!(u.protocol==="http:"&&["localhost","127.0.0.1"].includes(u.hostname)))return null;
  return u;
 }catch{return null;}
}
function realDomain(url:URL){
 return url.protocol==="https:"&&url.hostname.includes(".")&&!/^[\d.]+$/.test(url.hostname)&&url.hostname!=="localhost";
}
export function providerEnabled(p:OAuthProvider):boolean{
 const site=baseUrl();
 if(!site)return false;
 if(p==="google")return !!(process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET&&
  (realDomain(site)||["localhost","127.0.0.1"].includes(site.hostname)));
 return realDomain(site)&&!!(process.env.APPLE_OAUTH_SERVICE_ID&&process.env.APPLE_OAUTH_TEAM_ID&&
  process.env.APPLE_OAUTH_KEY_ID&&process.env.APPLE_OAUTH_PRIVATE_KEY_B64);
}
export function callbackUrl(p:OAuthProvider){
 const site=baseUrl();
 if(!site)throw new ApiError("Configura el dominio HTTPS de Kreyv.",503);
 return new URL("/api/local/oauth/"+p+"/callback",site).toString();
}
function appleSecret():string{
 const team=process.env.APPLE_OAUTH_TEAM_ID!,service=process.env.APPLE_OAUTH_SERVICE_ID!,kid=process.env.APPLE_OAUTH_KEY_ID!;
 const pem=Buffer.from(process.env.APPLE_OAUTH_PRIVATE_KEY_B64!,"base64").toString("utf8");
 const now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:"ES256",kid,typ:"JWT"})).toString("base64url");
 const payload=Buffer.from(JSON.stringify({iss:team,iat:now,exp:now+300,aud:"https://appleid.apple.com",sub:service})).toString("base64url");
 const signing=header+"."+payload;
 const signature=sign("sha256",Buffer.from(signing),{key:createPrivateKey(pem),dsaEncoding:"ieee-p1363"});
 return signing+"."+signature.toString("base64url");
}
function credentials(p:OAuthProvider):Credentials{
 if(!providerEnabled(p))throw new ApiError("Este acceso no está disponible todavía.",503);
 if(p==="google")return {clientId:process.env.GOOGLE_OAUTH_CLIENT_ID!,clientSecret:process.env.GOOGLE_OAUTH_CLIENT_SECRET!};
 return {clientId:process.env.APPLE_OAUTH_SERVICE_ID!,clientSecret:appleSecret()};
}
function randomToken(){return randomBytes(32).toString("base64url");}
export function oauthCookie(state:string,maxAge=600){
 const site=baseUrl();
 const secure=site?.protocol==="https:";
 // Apple returns a cross-site form POST, so a Lax cookie is not sent.
 return "lp_oauth_state="+state+"; Path=/api/local/oauth; HttpOnly; SameSite="+(secure?"None; Secure":"Lax")+
  "; Max-Age="+maxAge;
}
export function readOauthCookie(request:Request){
 const pair=(request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("lp_oauth_state="));
 return pair?.slice("lp_oauth_state=".length)||"";
}
function safeEqual(a:string,b:string){
 const lhs=Buffer.from(a),rhs=Buffer.from(b);
 return lhs.length===rhs.length&&timingSafeEqual(lhs,rhs);
}
export async function beginOauth(p:OAuthProvider,returnTo:string){
 const {clientId}=credentials(p);
 const state=randomToken(),nonce=randomToken(),verifier=randomToken();
 const destination=["/mi-loyally","/app","/entrar"].includes(returnTo)?returnTo:"/entrar";
 await authPool.query("DELETE FROM auth.oauth_attempts WHERE expires_at<now()");
 await authPool.query(
  "INSERT INTO auth.oauth_attempts(state_hash,provider,nonce,code_verifier,return_to) VALUES($1,$2,$3,$4,$5)",
  [hashToken(state),p,nonce,verifier,destination]
 );
 const url=new URL(origins[p].auth);
 const q=url.searchParams;
 q.set("client_id",clientId);
 q.set("redirect_uri",callbackUrl(p));
 q.set("response_type","code");
 q.set("scope",p==="google"?"openid email profile":"name email");
 q.set("state",state);q.set("nonce",nonce);
 if(p==="google"){
  q.set("code_challenge",createHash("sha256").update(verifier).digest("base64url"));
  q.set("code_challenge_method","S256");
 }else{q.set("response_mode","form_post");}
 return {url:url.toString(),state};
}
export type OAuthAttempt={provider:OAuthProvider;nonce:string;code_verifier:string;return_to:string};
export async function consumeAttempt(p:OAuthProvider,state:string,cookie:string):Promise<OAuthAttempt>{
 if(state.length>128||state.length<24||!safeEqual(state,cookie))throw new ApiError("Sesión de acceso caducada.",401);
 const result=await authPool.query(
  "DELETE FROM auth.oauth_attempts WHERE state_hash=$1 AND provider=$2 AND expires_at>now() RETURNING provider,nonce,code_verifier,return_to",
  [hashToken(state),p]
 );
 if(!result.rows[0])throw new ApiError("El enlace de acceso ya no es válido.",401);
 return result.rows[0] as OAuthAttempt;
}
type TokenResponse={id_token?:string;error?:string};
export async function exchangeCode(p:OAuthProvider,code:string,attempt:OAuthAttempt):Promise<string>{
 const cfg=credentials(p);
 if(code.length>4096||code.length<4)throw new ApiError("Respuesta de acceso no válida.");
 const params=new URLSearchParams({
  client_id:cfg.clientId,client_secret:cfg.clientSecret,grant_type:"authorization_code",
  code,redirect_uri:callbackUrl(p)
 });
 if(p==="google")params.set("code_verifier",attempt.code_verifier);
 const response=await fetch(origins[p].token,{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},
  body:params.toString(),cache:"no-store",signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw new ApiError("No pudimos completar el acceso. Vuelve a intentarlo.",401);
 const json=await response.json() as TokenResponse;
 if(typeof json.id_token!=="string")throw new ApiError("La identidad no pudo verificarse.",401);
 return json.id_token;
}
type Claims={iss?:string;aud?:string|string[];sub?:string;email?:string;email_verified?:boolean|string;name?:string;
 nonce?:string;exp?:number;nbf?:number;iat?:number};
export async function verifyIdentity(p:OAuthProvider,jwt:string,expectedNonce:string){
 const parts=jwt.split(".");
 if(parts.length!==3||jwt.length>16000)throw new ApiError("Identidad no válida.",401);
 let header:{alg?:string;kid?:string},claims:Claims;
 try{
  header=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));
  claims=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
 }catch{throw new ApiError("Identidad no válida.",401);}
 if(header.alg!=="RS256"||!header.kid||header.kid.length>160)throw new ApiError("Firma de identidad no admitida.",401);
 const response=await fetch(origins[p].keys,{cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new ApiError("No pudimos comprobar la identidad.",503);
 const body=await response.json() as {keys?:Array<Record<string,unknown>>};
 const jwk=body.keys?.find(k=>k.kid===header.kid&&k.kty==="RSA"&&(!k.alg||k.alg==="RS256")&&(!k.use||k.use==="sig"));
 if(!jwk)throw new ApiError("Clave de identidad no reconocida.",401);
 let valid=false;
 try{valid=verify("RSA-SHA256",Buffer.from(parts[0]+"."+parts[1]),createPublicKey({key:jwk,format:"jwk"}),Buffer.from(parts[2],"base64url"));}
 catch{valid=false;}
 const now=Math.floor(Date.now()/1000);
 const clientId=p==="google"?process.env.GOOGLE_OAUTH_CLIENT_ID:process.env.APPLE_OAUTH_SERVICE_ID;
 const audience=Array.isArray(claims.aud)?claims.aud:[claims.aud];
 const verified=claims.email_verified===true||claims.email_verified==="true";
 const email=typeof claims.email==="string"?claims.email.trim().toLowerCase():"";
 if(!valid||!origins[p].issuer.includes(claims.iss as never)||!audience.includes(clientId)||
  !claims.sub||claims.sub.length>255||typeof claims.exp!=="number"||claims.exp<now-60||
  typeof claims.iat!=="number"||claims.iat>now+60||claims.nbf&&claims.nbf>now+60||
  claims.nonce!==expectedNonce||!verified||!validateEmail(email))
  throw new ApiError("No pudimos verificar la cuenta elegida.",401);
 return {subject:claims.sub,email,name:typeof claims.name==="string"?claims.name.slice(0,120):""};
}
export async function findOrCreateUser(p:OAuthProvider,identity:{subject:string;email:string;name:string}):Promise<string>{
 if(identity.email.endsWith("@demo.loyally.test")&&process.env.LP_SANDBOX_MODE!=="true")
  throw new ApiError("Esta cuenta no puede utilizarse en producción.",403);
 const c=await authPool.connect();
 try{
  await c.query("BEGIN");
  // Serializes logins for the same verified email (and hence the identity mapping).
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[identity.email]);
  const old=await c.query("SELECT user_id FROM auth.oauth_identities WHERE provider=$1 AND subject=$2 FOR UPDATE",[p,identity.subject]);
  let id:string;
  if(old.rowCount){
   id=old.rows[0].user_id;
   await c.query("UPDATE auth.oauth_identities SET last_sign_in_at=now() WHERE provider=$1 AND subject=$2",[p,identity.subject]);
  }else{
   const existing=await c.query("SELECT id FROM auth.users WHERE lower(email)=$1 FOR UPDATE",[identity.email]);
   if(existing.rowCount)id=existing.rows[0].id;
   else{
    const placeholder="!oauth$"+randomBytes(32).toString("hex");
    const name=identity.name.trim()||identity.email.split("@")[0];
    const inserted=await c.query(
     "INSERT INTO auth.users(email,password_hash,raw_user_meta_data,email_confirmed_at) VALUES($1,$2,$3::jsonb,now()) RETURNING id",
     [identity.email,placeholder,JSON.stringify({full_name:name})]
    );
    id=inserted.rows[0].id;
   }
   await c.query("UPDATE auth.users SET email_confirmed_at=coalesce(email_confirmed_at,now()) WHERE id=$1",[id]);
   await c.query("INSERT INTO auth.oauth_identities(provider,subject,user_id) VALUES($1,$2,$3)",[p,identity.subject,id]);
  }
  await c.query("COMMIT");
  return id;
 }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}
 finally{c.release();}
}
