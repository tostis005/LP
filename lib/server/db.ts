import { createHash } from "node:crypto";
import pg, { type PoolClient } from "pg";

export type Actor = { id: string; email: string; user_metadata: {full_name?:string}; expires_at?: string };
const options = {
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "lp",
  max: 12,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
};
export const apiPool = new pg.Pool({ ...options, user: process.env.PGUSER || "lp_api", password: process.env.PGPASSWORD });
export const authPool = new pg.Pool({ ...options, user: process.env.AUTH_PGUSER || "lp_auth", password: process.env.AUTH_PGPASSWORD });

export function hashToken(value:string) { return createHash("sha256").update(value).digest("hex"); }
export function cookieToken(request:Request) {
  const cookie = request.headers.get("cookie") || "";
  const value = cookie.split(";").map(p=>p.trim()).find(p=>p.startsWith("lp_session="));
  return value?.slice("lp_session=".length) || "";
}
export async function actorFromRequest(request:Request):Promise<Actor|null> {
  const token = cookieToken(request);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const r = await authPool.query(
    "SELECT u.id,u.email,u.raw_user_meta_data,s.expires_at FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.email_confirmed_at IS NOT NULL LIMIT 1",
    [hashToken(token)]
  );
  const u=r.rows[0];
  return u?{id:u.id,email:u.email,user_metadata:u.raw_user_meta_data||{},expires_at:u.expires_at}:null;
}
export async function asActor<T>(actor:Actor|null, fn:(client:PoolClient)=>Promise<T>):Promise<T> {
  const client=await apiPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(actor?"SET LOCAL ROLE authenticated":"SET LOCAL ROLE anon");
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.email',$2,true)",[actor?.id||"",actor?.email||""]);
    const result=await fn(client);
    await client.query("COMMIT");
    return result;
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}
  finally{client.release()}
}
export class ApiError extends Error {
  constructor(message:string,public status:number=400){super(message)}
}
export function checkOrigin(request:Request) {
  const origin=request.headers.get("origin");
  if(!origin)return;
  const site=process.env.NEXT_PUBLIC_SITE_URL;
  if(!site || origin!==new URL(site).origin)throw new ApiError("Origen de solicitud no permitido.",403);
}
export function responseError(e:unknown) {
  if(e instanceof ApiError)return Response.json({error:e.message},{status:e.status});
  if(e instanceof SyntaxError)return Response.json({error:"Solicitud JSON no válida."},{status:400});
  const err=e as {code?:string;message?:string};
  if(err.code==="42501")return Response.json({error:"No tienes permisos para realizar esa operación."},{status:403});
  if(err.code==="23505")return Response.json({error:"Ya existe un registro con esos datos."},{status:409});
  if(err.code==="23514"||err.code==="23503"||err.code==="22P02")return Response.json({error:"Los datos indicados no son válidos."},{status:400});
  if(err.code==="P0001")return Response.json({error:String(err.message||"Operación rechazada.").slice(0,240)},{status:400});
  console.error("LP API",err?.code||"error");
  return Response.json({error:"No se pudo completar la operación."},{status:500});
}