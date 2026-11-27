import {safeJoinTarget} from "@/lib/public-url";
import { actorFromRequest,asActor,authPool,cookieToken,hashToken,ApiError,checkOrigin,responseError } from "@/lib/server/db";
import { hashPassword,passwordMatches,validateEmail,emailToken,rateLimit,createSession,extendSession,setSessionCookie,clearSessionCookie,publicUser,smtpReady } from "@/lib/server/auth";
export const runtime="nodejs";

export async function POST(request:Request) {
  try {
    checkOrigin(request);
    const raw=await request.text();
    if(raw.length>12000)throw new ApiError("Solicitud demasiado larga.",413);
    const input=JSON.parse(raw) as Record<string,unknown>;
    const action=String(input.action||"");
    const actor=await actorFromRequest(request);
    if(action==="getUser"||action==="getSession"){
      const expires=actor?await extendSession(actor.id,cookieToken(request)):null;
      const data=action==="getUser"?{user:actor?publicUser(actor):null}:
       {session:actor?{access_token:"cookie",user:publicUser(actor),expires_at:expires?.toISOString()}:null};
      const response=Response.json({data,error:null});
      return actor&&expires?setSessionCookie(response,cookieToken(request),expires):response;
    }
    if(action==="signOut") {
      const token=cookieToken(request);
      if(token)await authPool.query("DELETE FROM auth.sessions WHERE token_hash=$1",[hashToken(token)]);
      const response=clearSessionCookie(Response.json({data:{},error:null}));
      const secure=process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")?" Secure;":"";
      response.headers.append("Set-Cookie","lp_qa_operator=; Path=/api/local/qa-access; HttpOnly; SameSite=Strict;"+secure+" Max-Age=0");
      return response;
    }
    if(action==="signUp") {
      if(!smtpReady())throw new ApiError("El registro requiere configurar SMTP para confirmar la dirección de correo.",503);
      const email=String(input.email||"").trim().toLowerCase(),password=String(input.password||"");
      const name=String(input.full_name||"").trim();
      const platformMarketingOptIn=input.platform_marketing_opt_in===true;
      const returnTo=safeJoinTarget(input.return_to);
      const platformPushOptIn=input.platform_push_opt_in===true;
      const cardNotificationsOptIn=input.card_notifications_opt_in===true;
       const whatsapp=String(input.whatsapp||"").trim();
      const birthDate=typeof input.birth_date==="string"?input.birth_date.trim():"";
      const gender=typeof input.gender==="string"?input.gender:"";
      if(birthDate||gender){
        const today=new Date().toISOString().slice(0,10);
        const parsed=/^\d{4}-\d{2}-\d{2}$/.test(birthDate)?new Date(birthDate+"T00:00:00Z"):null;
        if(!parsed||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==birthDate||birthDate<"1900-01-01"||birthDate>today||!["woman","man","other","prefer_not"].includes(gender)||!whatsapp)throw new ApiError("Completa la fecha de nacimiento, el sexo y el teléfono con datos válidos.");
      }
      if(!validateEmail(email)||password.length<10||password.length>128||name.length<2||name.length>120||(whatsapp!==""&&!/^[+][1-9][0-9]{7,14}$/.test(whatsapp)))throw new ApiError("Introduce un email válido, un nombre, apellidos, WhatsApp y una contraseña de al menos 10 caracteres.");
      if(cardNotificationsOptIn&&!whatsapp)throw new ApiError("Añade tu número de WhatsApp con prefijo internacional para activar los tres canales.");
      await rateLimit("signup:"+email,4,60);
      const exists=await authPool.query("SELECT id,email_confirmed_at FROM auth.users WHERE lower(email)=$1",[email]);
      if(exists.rowCount){
        if(exists.rows[0].email_confirmed_at)throw new ApiError("Este email ya tiene una cuenta. Accede o utiliza la recuperación.",409);
        await emailToken(exists.rows[0].id,"verify",email,returnTo);
        return Response.json({data:{user:{id:exists.rows[0].id,email},session:null},error:null});
      }
      const pass=await hashPassword(password);
      const r=await authPool.query("INSERT INTO auth.users(email,password_hash,raw_user_meta_data) VALUES($1,$2,$3::jsonb) RETURNING id",[email,pass,JSON.stringify({full_name:name,whatsapp:whatsapp||null,...(birthDate?{birth_date:birthDate,gender:gender==="prefer_not"?null:gender}:{}),platform_marketing_opt_in:platformMarketingOptIn,platform_push_opt_in:platformPushOptIn,card_notifications_opt_in:cardNotificationsOptIn})]);
      await emailToken(r.rows[0].id,"verify",email,returnTo);
      return Response.json({data:{user:{id:r.rows[0].id,email},session:null},error:null},{status:201});
    }
    if(action==="signInWithPassword") {
      const email=String(input.email||"").trim().toLowerCase(),password=String(input.password||"");
      if(!validateEmail(email)||!password)throw new ApiError("Email o contraseña incorrectos.",401);
       if(email.endsWith("@demo.loyally.test")&&process.env.LP_SANDBOX_MODE!=="true")throw new ApiError("Las cuentas de prueba reales solo están habilitadas en el entorno sandbox.",403);
      // El acceso correcto no consume cuota de fallos de este correo:
      // evita que un tercero pueda bloquear a su propietario al probar contraseñas.
      const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
      await rateLimit("login-request-ip-v2:"+hashToken(forwarded).slice(0,24),90,15);
      const r=await authPool.query("SELECT id,email,password_hash,email_confirmed_at,raw_user_meta_data FROM auth.users WHERE lower(email)=$1",[email]);
      const u=r.rows[0];
      const verified=u?await passwordMatches(password,u.password_hash):false;
      if(!verified){
        await rateLimit("login-fail-v2:"+email,10,15);
        throw new ApiError("Email o contraseña incorrectos.",401);
      }
      if(!u.email_confirmed_at)throw new ApiError("Confirma tu email antes de iniciar sesión.",403);
      const session=await createSession(u.id);
      const user=publicUser({id:u.id,email:u.email,user_metadata:u.raw_user_meta_data});
      return setSessionCookie(Response.json({data:{user,session:{access_token:"cookie",user}},error:null}),session.token,session.expires);
    }
    if(action==="resetPasswordForEmail") {
      const email=String(input.email||"").trim().toLowerCase();
      if(!validateEmail(email))throw new ApiError("Email no válido.");
      if(!smtpReady())throw new ApiError("El servidor SMTP no está configurado.",503);
      await rateLimit("reset:"+email,4,60);
      // Internal QA accounts are maintained by Administration, not email recovery.
      const r=await authPool.query("SELECT u.id,u.email FROM auth.users u WHERE lower(u.email)=$1 AND u.email_confirmed_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.qa_profile_accounts q WHERE q.user_id=u.id)",[email]);
      if(r.rowCount)await emailToken(r.rows[0].id,"reset",r.rows[0].email);
      return Response.json({data:{},error:null});
    }
    if(action==="updateUser") {
      if(!actor)throw new ApiError("Inicia sesión para continuar.",401);
      const email=typeof input.email==="string"?input.email.trim().toLowerCase():null;
      const password=typeof input.password==="string"?input.password:null;
      if(email!==null) {
        if(!validateEmail(email))throw new ApiError("Email inválido.");
        if(email!==actor.email) {
          if(!smtpReady())throw new ApiError("Configura SMTP antes de cambiar el email.",503);
          await rateLimit("email:"+actor.id,3,60);
          await authPool.query("UPDATE auth.users SET email=$1,email_confirmed_at=NULL,updated_at=now() WHERE id=$2",[email,actor.id]);
          await authPool.query("DELETE FROM auth.sessions WHERE user_id=$1",[actor.id]);
          await emailToken(actor.id,"verify",email);
        }
      }
      const whatsapp=typeof input.whatsapp==="string"?input.whatsapp.trim():null;
      if(whatsapp!==null){
        if(whatsapp!==""&&!/^\+[1-9][0-9]{7,14}$/.test(whatsapp))
          throw new ApiError("El teléfono debe incluir código de país, por ejemplo +526641234567.");
        const existing=await authPool.query("SELECT raw_user_meta_data->>'whatsapp' AS phone FROM auth.users WHERE id=$1",[actor.id]);
        if((existing.rows[0]?.phone||"")!==whatsapp){
          await authPool.query("UPDATE auth.users SET raw_user_meta_data=jsonb_set(raw_user_meta_data,'{whatsapp}',to_jsonb($1::text),true),updated_at=now() WHERE id=$2",[whatsapp,actor.id]);
          await asActor(actor,async client=>{
            await client.query("UPDATE public.marketing_consents SET whatsapp_opted_in=false,updated_at=now() WHERE customer_id=$1",[actor.id]);
          });
        }
      }
      if(password!==null){
        if(password.length<10||password.length>128)throw new ApiError("La contraseña debe tener entre 10 y 128 caracteres.");
        await authPool.query("UPDATE auth.users SET password_hash=$1,updated_at=now() WHERE id=$2",[await hashPassword(password),actor.id]);
      }
      return Response.json({data:{user:publicUser(actor)},error:null});
    }
    throw new ApiError("Acción de autenticación no admitida.",400);
  }catch(e){
    if(e instanceof SyntaxError)return Response.json({error:"Solicitud JSON inválida."},{status:400});
    return responseError(e);
  }
}