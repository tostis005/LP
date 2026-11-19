import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import { authPool, hashToken, ApiError, type Actor } from "./db";

const scrypt=promisify(scryptCallback);
const DAY=24*3600*1000;
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
export async function sendMail(to:string,subject:string,body:string,html?:string) {
  if(!smtpReady())throw new ApiError("Falta configurar el correo SMTP del servidor para verificar cuentas.",503);
  const transport=nodemailer.createTransport({
    host:process.env.SMTP_HOST,
    port:Number(process.env.SMTP_PORT||587),
    secure:process.env.SMTP_SECURE==="true",
    ...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD||""}}:{})
  });
  await transport.sendMail({from:process.env.SMTP_FROM,to,subject,text:body,...(html?{html}:{})});
}
export async function emailToken(userId:string,purpose:"verify"|"reset",email:string) {
  const token=randomBytes(32).toString("hex");
  const site=process.env.NEXT_PUBLIC_SITE_URL;
  if(!site)throw new ApiError("Falta configurar NEXT_PUBLIC_SITE_URL",503);
  await authPool.query("DELETE FROM auth.email_tokens WHERE user_id=$1 AND purpose=$2",[userId,purpose]);
  await authPool.query(
    "INSERT INTO auth.email_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+$4::interval)",
    [hashToken(token),userId,purpose,purpose==="reset"?"1 hour":"24 hours"]
  );
  const link=site.replace(/\/$/,"")+"/api/local/auth/verify?purpose="+purpose+"&token="+token;
  const subject=purpose==="verify"?"Confirma tu cuenta de Loyally":"Recupera tu acceso a Loyally";
  await sendMail(email,subject,"Utiliza el siguiente enlace, válido durante un tiempo limitado:\n\n"+link+"\n\nSi no lo solicitaste, ignora este correo.");
}
export async function rateLimit(key:string,max:number,minutes=15) {
  const result=await authPool.query(
    "INSERT INTO auth.rate_limits(key,hits,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN auth.rate_limits.window_start<now()-($2::int*interval '1 minute') THEN 1 ELSE auth.rate_limits.hits+1 END,window_start=CASE WHEN auth.rate_limits.window_start<now()-($2::int*interval '1 minute') THEN now() ELSE auth.rate_limits.window_start END RETURNING hits",
    [key,minutes]
  );
  if(result.rows[0].hits>max)throw new ApiError("Demasiados intentos. Inténtalo más tarde.",429);
}
export async function createSession(userId:string,ttlMs=30*DAY) {
  const token=randomBytes(32).toString("hex");
  const expires=new Date(Date.now()+ttlMs);
  await authPool.query(
    "INSERT INTO auth.sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)",
    [userId,hashToken(token),expires]
  );
  return {token,expires};
}
export function setSessionCookie(response:Response,token:string,expires:Date) {
  const secure=process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")?" Secure;":"";
  response.headers.append("Set-Cookie","lp_session="+token+"; Path=/; HttpOnly; SameSite=Lax;"+secure+" Max-Age=2592000; Expires="+expires.toUTCString());
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