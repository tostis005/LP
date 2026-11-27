import {randomBytes} from "node:crypto";
import {actorFromRequest,asActor,checkOrigin,responseError,ApiError,authPool} from "@/lib/server/db";
import {hashPassword,validateEmail,emailToken} from "@/lib/server/auth";
import {scopeKeys,scopeKey,type MarketingScope} from "@/lib/marketing-scopes";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){try{const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);const params=new URL(request.url).searchParams,self=params.has("self"),view=params.get("view"),target=params.get("userId");const data=await asActor(actor,async c=>{if(self)return (await c.query("SELECT public.crm_is_marketing() AS marketing,public.crm_marketing_active() AS active")).rows[0];if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("No autorizado.",403);const users=view==="regions"?[]:await (async()=>{const roleUsers=(await c.query("SELECT public.crm_admin_marketing_users() AS users")).rows[0].users as {id:string;name:string|null;email:string;role:string;active:boolean|null;scopes:unknown}[];
const directory=(await c.query("SELECT * FROM public.admin_user_directory()")).rows as {user_id:string;full_name:string|null;email:string;businesses:number|string;joined_at:string|null}[];
const byId=new Map(directory.map(u=>[u.user_id,u]));
const accountDetails=(await c.query("SELECT public.admin_account_details() AS details")).rows[0].details as {id:string;name:string|null;whatsapp:string;birth_date:string|null;gender:string|null;confirmed:boolean;qa:boolean;business_links:{id:string;name:string;role:string;active:boolean}[]}[];
const accounts=new Map(accountDetails.map(u=>[u.id,u]));
return roleUsers.filter(u=>!target||u.id===target).map(u=>{const detail=byId.get(u.id),account=accounts.get(u.id);return {...u,...account,name:account?.name??detail?.full_name??u.name,businesses:detail?Number(detail.businesses):0,joined_at:detail?.joined_at??null};});})();
if(view==="users")return {users};
const regions=(await c.query("SELECT DISTINCT country_code,state_code,state,municipality_code,municipality,locality_code,city,neighborhood FROM public.crm_prospects ORDER BY state,municipality,city,neighborhood")).rows;
if(!regions.some(r=>r.country_code==="MX"&&r.state_code==="11"&&r.municipality_code==="020"))regions.push({country_code:"MX",state_code:"11",state:"Guanajuato",municipality_code:"020",municipality:"León",locality_code:"0001",city:"León de los Aldama",neighborhood:""});
return view==="regions"?{regions}:{users,regions};});return Response.json(data,{headers});}catch(e){return responseError(e);}}
export async function POST(request:Request){
 try{
  checkOrigin(request);const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);
  await asActor(actor,async c=>{if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("No autorizado.",403);});
  const raw=await request.text();if(raw.length>20000)throw new ApiError("Solicitud demasiado larga.");
  const v=JSON.parse(raw),email=String(v.email||"").trim().toLowerCase(),name=String(v.name||"").trim();
  const editingUser=v.userId??null,initialPassword=v.initialPassword??"",newPassword=v.newPassword??"";
  if(!validateEmail(email)||name.length<2||name.length>120||!Array.isArray(v.scopes)||v.scopes.length>100||typeof v.active!=="boolean"||(editingUser!==null&&(typeof editingUser!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editingUser))))throw new ApiError("Datos no válidos.");
  if(typeof initialPassword!=="string"||(initialPassword&&(initialPassword.length<10||initialPassword.length>128||editingUser!==null)))throw new ApiError("La contraseña inicial debe tener entre 10 y 128 caracteres y solo puede establecerse al crear la cuenta.");
  if(typeof newPassword!=="string"||(newPassword&&(editingUser===null||newPassword.length<10||newPassword.length>128)))throw new ApiError("La nueva contraseña debe tener entre 10 y 128 caracteres y requiere un usuario existente.");
  const scopes:MarketingScope[]=v.scopes.map((s:Record<string,unknown>)=>{const result={} as MarketingScope;let empty=false;for(const k of scopeKeys){const value=s?.[k];if(typeof value!=="string"||value.length>200||(empty&&value))throw new ApiError("Ámbito geográfico no válido.");result[k]=value;empty=empty||!value;}return result;});
  const unique=[...new Map(scopes.map(s=>[scopeKey(s),s])).values()];
  const hash=await hashPassword(initialPassword||newPassword||randomBytes(32).toString("hex"));
  const saved=await asActor(actor,async c=>{
   const result=(await c.query("SELECT public.crm_admin_provision_marketing($1,$2,$3,$4,$5::jsonb,$6,$7::uuid) AS saved",[email,name,hash,v.active,JSON.stringify(unique),!!initialPassword,editingUser])).rows[0].saved as {id:string;active:boolean;scopes:MarketingScope[]};
   // Both changes commit together; a failed password reset rolls back the permissions edit.
   if(newPassword)await c.query("SELECT public.admin_reset_staff_password($1::uuid,$2)",[result.id,hash]);
   return result;
  });
  let invitation=initialPassword?"Cuenta creada con contraseña inicial.": "";
  if(!initialPassword&&!newPassword&&v.invite===true){
   const row=(await authPool.query("SELECT email_confirmed_at FROM auth.users WHERE id=$1",[saved.id])).rows[0];
   if(!row?.email_confirmed_at){try{await emailToken(saved.id,"verify",email);invitation="Invitación enviada.";}catch{invitation="Cuenta guardada; no se pudo enviar la invitación. Reintenta desde la edición."}}
  }
  return Response.json({ok:true,saved,invitation,passwordChanged:!!newPassword},{headers});
 }catch(e){return responseError(e);}
}

export async function PATCH(request:Request){
 try{
  checkOrigin(request);const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);
  await asActor(actor,async c=>{if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("No autorizado.",403);});
  const raw=await request.text();if(raw.length>4000)throw new ApiError("Solicitud demasiado larga.");
  const v=JSON.parse(raw),id=v.userId,password=v.password;
  if(typeof id!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||typeof password!=="string"||password.length<10||password.length>128)throw new ApiError("La contraseña debe tener entre 10 y 128 caracteres.");
  const hash=await hashPassword(password);
  await asActor(actor,async c=>{await c.query("SELECT public.admin_reset_staff_password($1::uuid,$2)",[id,hash]);});
  return Response.json({ok:true},{headers});
 }catch(e){return responseError(e);}
}

export async function PUT(request:Request){
 try{
  checkOrigin(request);const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);
  await asActor(actor,async c=>{if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("No autorizado.",403);});
  const raw=await request.text();if(raw.length>20000)throw new ApiError("Solicitud demasiado larga.");
  const v=JSON.parse(raw),id=v.userId;
  if(typeof id!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||typeof v.name!=="string"||typeof v.email!=="string"||typeof v.whatsapp!=="string"||typeof v.birthDate!=="string"||typeof v.gender!=="string"||typeof v.newPassword!=="string")throw new ApiError("Datos no válidos.");
  const name=v.name.trim(),email=v.email.trim().toLowerCase(),phone=v.whatsapp.trim(),dob=v.birthDate,gender=v.gender||null,password=v.newPassword;
  if(name.length>120||!validateEmail(email)||(phone&&!/^\+[1-9][0-9]{7,14}$/.test(phone))||(gender&&!["woman","man","other"].includes(gender))||(password&&(password.length<10||password.length>128)))throw new ApiError("Revisa el nombre, correo, teléfono y contraseña (10 a 128 caracteres).");
  if(dob){const parsed=/^\d{4}-\d{2}-\d{2}$/.test(dob)?new Date(dob+"T00:00:00Z"):null;if(!parsed||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==dob||dob<"1900-01-01"||dob>new Date().toISOString().slice(0,10))throw new ApiError("Fecha de nacimiento no válida.");}
  let scopes:MarketingScope[]|null=null;
  if(v.scopes!==undefined){
   if(!Array.isArray(v.scopes)||v.scopes.length>100||typeof v.active!=="boolean")throw new ApiError("Ámbitos no válidos.");
   const checkedScopes:MarketingScope[]=v.scopes.map((s:Record<string,unknown>)=>{const result={} as MarketingScope;let empty=false;for(const k of scopeKeys){const value=s?.[k];if(typeof value!=="string"||value.length>200||(empty&&value))throw new ApiError("Ámbito geográfico no válido.");result[k]=value;empty=empty||!value;}return result;});
   scopes=[...new Map(checkedScopes.map(s=>[scopeKey(s),s])).values()];
  }
  const hash=password?await hashPassword(password):null;
  const saved=await asActor(actor,async c=>(await c.query("SELECT public.admin_edit_account($1::uuid,$2,$3,$4,$5::date,$6,$7,$8,$9::jsonb) AS saved",[id,name,email,phone,dob||null,gender,hash,scopes===null?null:v.active,scopes===null?null:JSON.stringify(scopes)])).rows[0].saved as {verify:boolean;relogin:boolean;passwordChanged:boolean});
  let invitation="";
  if(saved.verify){try{await emailToken(id,"verify",email);invitation="Se ha enviado un enlace de confirmación al nuevo correo.";}catch{invitation="Correo actualizado, pendiente de confirmar. No se pudo enviar el enlace; el usuario puede volver a solicitarlo desde el registro."}}
  return Response.json({ok:true,...saved,invitation},{headers});
 }catch(e){return responseError(e);}
}
