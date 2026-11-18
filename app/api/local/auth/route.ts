import { actorFromRequest,authPool,cookieToken,hashToken,ApiError,checkOrigin,responseError } from "@/lib/server/db";
import { hashPassword,passwordMatches,validateEmail,emailToken,rateLimit,createSession,setSessionCookie,clearSessionCookie,publicUser,smtpReady } from "@/lib/server/auth";
export const runtime="nodejs";

export async function POST(request:Request) {
  try {
    checkOrigin(request);
    const raw=await request.text();
    if(raw.length>12000)throw new ApiError("Solicitud demasiado larga.",413);
    const input=JSON.parse(raw) as Record<string,unknown>;
    const action=String(input.action||"");
    const actor=await actorFromRequest(request);
    if(action==="getUser")return Response.json({data:{user:actor?publicUser(actor):null},error:null});
    if(action==="getSession")return Response.json({data:{session:actor?{access_token:"cookie",user:publicUser(actor),expires_at:actor.expires_at}:null},error:null});
    if(action==="signOut") {
      const token=cookieToken(request);
      if(token)await authPool.query("DELETE FROM auth.sessions WHERE token_hash=$1",[hashToken(token)]);
      return clearSessionCookie(Response.json({data:{},error:null}));
    }
    if(action==="signUp") {
      if(!smtpReady())throw new ApiError("El registro requiere configurar SMTP para confirmar la dirección de correo.",503);
      const email=String(input.email||"").trim().toLowerCase(),password=String(input.password||"");
      const name=String(input.full_name||"").trim();
       const whatsapp=String(input.whatsapp||"").trim();
      if(!validateEmail(email)||password.length<10||password.length>128||name.length<2||name.length>120||(whatsapp!==""&&!/^\\+[1-9][0-9]{7,14}$/.test(whatsapp)))throw new ApiError("Introduce un email válido, un nombre y una contraseña de al menos 10 caracteres.");
      await rateLimit("signup:"+email,4,60);
      const exists=await authPool.query("SELECT id,email_confirmed_at FROM auth.users WHERE lower(email)=$1",[email]);
      if(exists.rowCount){
        if(exists.rows[0].email_confirmed_at)throw new ApiError("Este email ya tiene una cuenta. Accede o utiliza la recuperación.",409);
        await emailToken(exists.rows[0].id,"verify",email);
        return Response.json({data:{user:{id:exists.rows[0].id,email},session:null},error:null});
      }
      const pass=await hashPassword(password);
      const r=await authPool.query("INSERT INTO auth.users(email,password_hash,raw_user_meta_data) VALUES($1,$2,$3::jsonb) RETURNING id",[email,pass,JSON.stringify({full_name:name,whatsapp:whatsapp||null})]);
      await emailToken(r.rows[0].id,"verify",email);
      return Response.json({data:{user:{id:r.rows[0].id,email},session:null},error:null},{status:201});
    }
    if(action==="signInWithPassword") {
      const email=String(input.email||"").trim().toLowerCase(),password=String(input.password||"");
      if(!validateEmail(email)||!password)throw new ApiError("Email o contraseña incorrectos.",401);
       if(email.endsWith("@demo.loyally.test")&&process.env.LP_SANDBOX_MODE!=="true")throw new ApiError("Las cuentas de prueba reales solo están habilitadas en el entorno sandbox.",403);
      await rateLimit("login:"+email,10,15);
      const r=await authPool.query("SELECT id,email,password_hash,email_confirmed_at,raw_user_meta_data FROM auth.users WHERE lower(email)=$1",[email]);
      const u=r.rows[0];
      const verified=u?await passwordMatches(password,u.password_hash):false;
      if(!verified)throw new ApiError("Email o contraseña incorrectos.",401);
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
      const r=await authPool.query("SELECT id,email FROM auth.users WHERE lower(email)=$1 AND email_confirmed_at IS NOT NULL",[email]);
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