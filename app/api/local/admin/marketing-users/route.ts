import {randomBytes} from "node:crypto";
import {actorFromRequest,asActor,checkOrigin,responseError,ApiError,authPool} from "@/lib/server/db";
import {hashPassword,validateEmail,emailToken} from "@/lib/server/auth";
import {scopeKeys,scopeKey,type MarketingScope} from "@/lib/marketing-scopes";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){try{const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);const self=new URL(request.url).searchParams.has("self");const data=await asActor(actor,async c=>{if(self)return (await c.query("SELECT public.crm_is_marketing() AS marketing,public.crm_marketing_active() AS active")).rows[0];if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("No autorizado.",403);const roleUsers=(await c.query("SELECT public.crm_admin_marketing_users() AS users")).rows[0].users as {id:string;name:string|null;email:string;role:string;active:boolean|null;scopes:unknown}[];
const directory=(await c.query("SELECT * FROM public.admin_user_directory()")).rows as {user_id:string;full_name:string|null;email:string;businesses:number|string;joined_at:string|null}[];
const byId=new Map(directory.map(u=>[u.user_id,u]));
const users=roleUsers.map(u=>{const detail=byId.get(u.id);return {...u,name:detail?.full_name||u.name,businesses:detail?Number(detail.businesses):0,joined_at:detail?.joined_at??null};});
const regions=(await c.query("SELECT DISTINCT country_code,state_code,state,municipality_code,municipality,locality_code,city,neighborhood FROM public.crm_prospects ORDER BY state,municipality,city,neighborhood")).rows;
if(!regions.some(r=>r.country_code==="MX"&&r.state_code==="11"&&r.municipality_code==="020"))regions.push({country_code:"MX",state_code:"11",state:"Guanajuato",municipality_code:"020",municipality:"León",locality_code:"0001",city:"León de los Aldama",neighborhood:""});
return {users,regions};});return Response.json(data,{headers});}catch(e){return responseError(e);}}
export async function POST(request:Request){
 try{
  checkOrigin(request);const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);
  await asActor(actor,async c=>{if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("No autorizado.",403);});
  const raw=await request.text();if(raw.length>20000)throw new ApiError("Solicitud demasiado larga.");
  const v=JSON.parse(raw),email=String(v.email||"").trim().toLowerCase(),name=String(v.name||"").trim();
  const editingUser=v.userId??null,initialPassword=v.initialPassword??"";
  if(!validateEmail(email)||name.length<2||name.length>120||!Array.isArray(v.scopes)||v.scopes.length>100||typeof v.active!=="boolean"||(editingUser!==null&&(typeof editingUser!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editingUser))))throw new ApiError("Datos no válidos.");
  if(typeof initialPassword!=="string"||(initialPassword&&(initialPassword.length<10||initialPassword.length>128||editingUser!==null)))throw new ApiError("La contraseña inicial debe tener entre 10 y 128 caracteres y solo puede establecerse al crear la cuenta.");
  const scopes:MarketingScope[]=v.scopes.map((s:Record<string,unknown>)=>{const result={} as MarketingScope;let empty=false;for(const k of scopeKeys){const value=s?.[k];if(typeof value!=="string"||value.length>200||(empty&&value))throw new ApiError("Ámbito geográfico no válido.");result[k]=value;empty=empty||!value;}return result;});
  const unique=[...new Map(scopes.map(s=>[scopeKey(s),s])).values()];
  const hash=await hashPassword(initialPassword||randomBytes(32).toString("hex"));
  const saved=await asActor(actor,async c=>(await c.query("SELECT public.crm_admin_provision_marketing($1,$2,$3,$4,$5::jsonb,$6,$7::uuid) AS saved",[email,name,hash,v.active,JSON.stringify(unique),!!initialPassword,editingUser])).rows[0].saved as {id:string;active:boolean;scopes:MarketingScope[]});
  let invitation=initialPassword?"Cuenta creada con contraseña inicial.": "";
  if(!initialPassword&&v.invite===true){
   const row=(await authPool.query("SELECT email_confirmed_at FROM auth.users WHERE id=$1",[saved.id])).rows[0];
   if(!row?.email_confirmed_at){try{await emailToken(saved.id,"verify",email);invitation="Invitación enviada.";}catch{invitation="Cuenta guardada; no se pudo enviar la invitación. Reintenta desde la edición."}}
  }
  return Response.json({ok:true,saved,invitation},{headers});
 }catch(e){return responseError(e);}
}
