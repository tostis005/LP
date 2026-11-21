import {randomBytes} from "node:crypto";
import {authPool,asActor,hashToken,ApiError,checkOrigin,responseError} from "@/lib/server/db";
import {createSession,setSessionCookie,rateLimit,sendMail,smtpReady,validateEmail} from "@/lib/server/auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Role="ADMIN"|"BUSINESS"|"STAFF"|"CUSTOMER";
const roles:Record<Role,{email:string;label:string;route:string}>={
 ADMIN:{email:"admin@loyally.local",label:"Administrador",route:"/admin"},
 BUSINESS:{email:"gestor@loyally.local",label:"Dueño de negocio",route:"/negocio"},
 STAFF:{email:"empleado@loyally.local",label:"Empleado",route:"/empleado"},
 CUSTOMER:{email:"cliente@loyally.local",label:"Cliente",route:"/app"}
};
const OPERATOR_MINUTES=45;
const OPERATOR_MS=OPERATOR_MINUTES*60*1000;
function roleOf(value:unknown):Role{
 if(typeof value!=="string"||!Object.prototype.hasOwnProperty.call(roles,value))throw new ApiError("Perfil no disponible.",400);
 return value as Role;
}
function qaRecipient(){
 const email=(process.env.LP_QA_OWNER_EMAIL||process.env.SMTP_USER||"").trim();
 return validateEmail(email)?email:"";
}
function qaCopyRecipient(){
 const email=(process.env.LP_QA_COPY_EMAIL||"").trim();
 if(!email)return undefined;
 if(!validateEmail(email))throw new ApiError("El correo de copia del acceso rápido no es válido.",503);
 return email.toLowerCase()===qaRecipient().toLowerCase()?undefined:email;
}
function enabled(){
 return process.env.LP_ENABLE_QA_ACCESS==="true"&&smtpReady()&&!!qaRecipient();
}
function operatorCookie(request:Request){
 const cookies=request.headers.get("cookie")||"";
 const entry=cookies.split(";").map(x=>x.trim()).find(x=>x.startsWith("lp_qa_operator="));
 return entry?.slice("lp_qa_operator=".length)||"";
}
async function verifiedAdmin(){
 const r=await authPool.query(
  "SELECT id,email,raw_user_meta_data FROM auth.users WHERE lower(email)='admin@loyally.local' AND email_confirmed_at IS NOT NULL LIMIT 1"
 );
 const admin=r.rows[0];
 if(!admin)throw new ApiError("El administrador aún no tiene una cuenta confirmada.",503);
 const allowed=await asActor({id:admin.id,email:admin.email,user_metadata:admin.raw_user_meta_data||{}},async client=>{
  const check=await client.query("SELECT public.is_platform_admin() AS permitted");
  return check.rows[0]?.permitted===true;
 });
 if(!allowed)throw new ApiError("Este administrador no está autorizado.",403);
 return admin as {id:string;email:string;raw_user_meta_data:Record<string,unknown>};
}
async function operatorAllowed(request:Request,adminId:string){
 const token=operatorCookie(request);
 if(!/^[a-f0-9]{64}$/.test(token))return false;
 const result=await authPool.query(
  "SELECT 1 FROM auth.sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now()",
  [adminId,hashToken(token)]
 );
 return !!result.rowCount;
}
async function targetUser(role:Role){
 const r=await authPool.query(
  "SELECT id,email FROM auth.users WHERE lower(email)=$1 AND email_confirmed_at IS NOT NULL LIMIT 1",
  [roles[role].email]
 );
 if(!r.rowCount)throw new ApiError("La cuenta de este perfil aún no está preparada.",503);
 return r.rows[0] as {id:string;email:string};
}
function operatorSessionCookie(token:string){
 const secure=process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")?" Secure;":"";
 return "lp_qa_operator="+token+"; Path=/api/local/qa-access; HttpOnly; SameSite=Strict;"+secure+" Max-Age="+(OPERATOR_MINUTES*60);
}
function reply(data:Record<string,unknown>,status=200){
 return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(request:Request){
 if(!enabled())return reply({enabled:false,authorized:false});
 try{
  const admin=await verifiedAdmin();
  return reply({enabled:true,authorized:await operatorAllowed(request,admin.id)});
 }catch{
  return reply({enabled:false,authorized:false});
 }
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  if(!enabled())throw new ApiError("El acceso rápido no está activado.",404);
  const raw=await request.text();
  if(raw.length>2000)throw new ApiError("Solicitud demasiado larga.",413);
  const input=JSON.parse(raw) as {action?:string;role?:string;token?:string};
  const action=input.action;
  const admin=await verifiedAdmin();

  if(action==="request"){
   const role=roleOf(input.role);
   const origin=(process.env.NEXT_PUBLIC_SITE_URL||"").replace(/\/$/,"");
   if(!origin.startsWith("https://"))throw new ApiError("El acceso rápido requiere HTTPS.",503);
   const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"desconocida";
   // Limita las solicitudes reales de correo, sin bloquear un día entero las pruebas
   // legítimas del administrador. No elimina la aprobación de email ni los enlaces de un solo uso.
   try{
    await rateLimit("qa-email-global-v2",40,1440);
    await rateLimit("qa-email-ip-v2:"+hashToken(forwarded).slice(0,24),8,60);
   }catch(error){
    if(error instanceof ApiError&&error.status===429)
     throw new ApiError("Has solicitado varios enlaces de acceso. Revisa el último correo recibido o inténtalo más adelante.",429);
    throw error;
   }
   const token=randomBytes(32).toString("hex");
   await authPool.query(
    "INSERT INTO auth.qa_access_links(token_hash,role,expires_at) VALUES($1,$2,now()+interval '15 minutes')",
    [hashToken(token),role]
   );
   const link=origin+"/acceso-perfiles?token="+token;
   try{
    await sendMail(qaRecipient(),"Acceso de validación a Kreyv",
     "Se ha solicitado acceso al perfil "+roles[role].label+" de Kreyv.\n\n"+
     "Para confirmar que eres quien administra la plataforma, abre este enlace (válido durante 15 minutos):\n\n"+
     link+"\n\nSi no lo has solicitado, ignora el mensaje.",undefined,qaCopyRecipient());
   }catch(e){
    await authPool.query("DELETE FROM auth.qa_access_links WHERE token_hash=$1",[hashToken(token)]);
    throw e;
   }
   return reply({sent:true});
  }

  if(action==="verify"){
   const token=String(input.token||"");
   if(!/^[a-f0-9]{64}$/.test(token))throw new ApiError("El enlace no es válido.",400);
   const consumed=await authPool.query(
    "DELETE FROM auth.qa_access_links WHERE token_hash=$1 AND expires_at>now() RETURNING role",
    [hashToken(token)]
   );
   if(!consumed.rowCount)throw new ApiError("El enlace ha caducado o ya se ha utilizado.",403);
   const role=roleOf(consumed.rows[0].role);
   const user=await targetUser(role);
   const operator=await createSession(admin.id,OPERATOR_MS);
   // El permiso para CAMBIAR de perfil dura 45 minutos; la sesión elegida
   // permanece abierta en el dispositivo hasta salir o ser revocada.
   const chosen=await createSession(user.id);
   const res=reply({success:true,route:roles[role].route});
   res.headers.append("Set-Cookie",operatorSessionCookie(operator.token));
   return setSessionCookie(res,chosen.token,chosen.expires);
  }

  if(action==="switch"){
   const role=roleOf(input.role);
   if(!await operatorAllowed(request,admin.id))throw new ApiError("Vuelve a autorizar el acceso con el correo de administración.",403);
   const user=await targetUser(role);
   const session=await createSession(user.id);
   return setSessionCookie(reply({success:true,route:roles[role].route}),session.token,session.expires);
  }
  throw new ApiError("Acción no admitida.",400);
 }catch(e){return responseError(e)}
}
