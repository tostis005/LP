import {safeJoinTarget} from "../public-url";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import { authPool, hashToken, ApiError, type Actor } from "./db";

const scrypt=promisify(scryptCallback);
const DAY=24*3600*1000;
const PERSISTENT_SESSION_DAYS=365;
export async function hashPassword(password:string):Promise<string> {
  const salt=randomBytes(16).toString("hex");
  const key=await scrypt(password,salt,64) as Buffer;
  return "scrypt$"+salt+"$"+key.toString("hex");
}
export async function passwordMatches(password:string,stored:string):Promise<boolean> {
  const parts=stored.split("$");
  if(parts.length!==3||parts[0]!=="scrypt")return false;
  const expected=Buffer.from(parts[2],"hex");
  if(expected.length!==64)return false;
  const actual=await scrypt(password,parts[1],64) as Buffer;
  return timingSafeEqual(actual,expected);
}
export function validateEmail(email:string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254;
}
export function smtpReady() {
  return !!(process.env.SMTP_HOST&&process.env.SMTP_FROM);
}
export async function sendMail(to:string,subject:string,body:string,html?:string,cc?:string) {
  if(!smtpReady())throw new ApiError("Falta configurar el correo SMTP del servidor para verificar cuentas.",503);
  const transport=nodemailer.createTransport({
    host:process.env.SMTP_HOST,
    port:Number(process.env.SMTP_PORT||587),
    secure:process.env.SMTP_SECURE==="true",
    ...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD||""}}:{})
  });
  await transport.sendMail({from:process.env.SMTP_FROM,to,subject,text:body,...(html?{html}:{}),...(cc?{cc}:{})});
}
export async function emailToken(userId:string,purpose:"verify"|"reset",email:string,returnTo?:string|null) {
  const token=randomBytes(32).toString("hex");
  const site=process.env.NEXT_PUBLIC_SITE_URL;
  if(!site)throw new ApiError("Falta configurar NEXT_PUBLIC_SITE_URL",503);
  await authPool.query("DELETE FROM auth.email_tokens WHERE user_id=$1 AND purpose=$2",[userId,purpose]);
  await authPool.query(
    "INSERT INTO auth.email_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+$4::interval)",
    [hashToken(token),userId,purpose,purpose==="reset"?"1 hour":"24 hours"]
  );
  const link=site.replace(/\/$/,"")+"/api/local/auth/verify?purpose="+purpose+"&token="+token+(purpose==="verify"&&safeJoinTarget(returnTo)?"&next="+encodeURIComponent(returnTo!):"");
  const subject=purpose==="verify"?"Confirma tu cuenta de KREYVI":"Recupera tu acceso a KREYVI";
  await sendMail(email,subject,"Utiliza el siguiente enlace, válido durante un tiempo limitado:\n\n"+link+"\n\nSi no lo solicitaste, ignora este correo.");
}
export async function rateLimit(key:string,max:number,minutes=15) {
  const result=await authPool.query(
    "INSERT INTO auth.rate_limits(key,hits,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN auth.rate_limits.window_start<now()-($2::int*interval '1 minute') THEN 1 ELSE auth.rate_limits.hits+1 END,window_start=CASE WHEN auth.rate_limits.window_start<now()-($2::int*interval '1 minute') THEN now() ELSE auth.rate_limits.window_start END RETURNING hits",
    [key,minutes]
  );
  if(result.rows[0].hits>max)throw new ApiError("Demasiados intentos. Inténtalo más tarde.",429);
}
export async function createSession(userId:string,ttlMs=PERSISTENT_SESSION_DAYS*DAY) {
  const token=randomBytes(32).toString("hex");
  const expires=new Date(Date.now()+ttlMs);
  await authPool.query(
    "INSERT INTO auth.sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)",
    [userId,hashToken(token),expires]
  );
  return {token,expires};
}
// Activa una sesión persistente mientras la persona utilice KREYVI.
 // Las sesiones existentes de 45 minutos/30 días también se pueden renovar
 // sin cambiar su token, siempre que aún sean válidas.
export async function extendSession(userId:string,token:string):Promise<Date>{
 const renewed=await authPool.query<{expires_at:Date}>(
  "UPDATE auth.sessions SET expires_at=now()+($3::int * interval '1 day') "+
  "WHERE user_id=$1::uuid AND token_hash=$2 AND expires_at>now() "+
  "AND expires_at<now()+(($3::int-30)* interval '1 day') RETURNING expires_at",
  [userId,hashToken(token),PERSISTENT_SESSION_DAYS]
 );
 if(renewed.rows[0]?.expires_at)return new Date(renewed.rows[0].expires_at);
 const existing=await authPool.query<{expires_at:Date}>(
  "SELECT expires_at FROM auth.sessions WHERE user_id=$1::uuid AND token_hash=$2 AND expires_at>now()",
  [userId,hashToken(token)]
 );
 if(existing.rows[0]?.expires_at)return new Date(existing.rows[0].expires_at);
 throw new ApiError("La sesión ha expirado.",401);
}
export function setSessionCookie(response:Response,token:string,expires:Date,maxAgeSeconds?:number) {
  const secure=process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")?" Secure;":"";
  const age=maxAgeSeconds??Math.max(1,Math.floor((expires.getTime()-Date.now())/1000));
  response.headers.append("Set-Cookie","lp_session="+token+"; Path=/; HttpOnly; SameSite=Lax;"+secure+" Max-Age="+age+"; Expires="+expires.toUTCString());
  response.headers.set("Cache-Control","no-store");
  return response;
}
export function clearSessionCookie(response:Response) {
  const secure=process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")?" Secure;":"";
  response.headers.append("Set-Cookie","lp_session=; Path=/; HttpOnly; SameSite=Lax;"+secure+" Max-Age=0");
  response.headers.set("Cache-Control","no-store");
  return response;
}
export function publicUser(user:Actor) {
  return {id:user.id,email:user.email,user_metadata:user.user_metadata};
}