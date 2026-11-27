"use client";
import {InternationalPhoneInput} from "@/components/InternationalPhoneInput";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowRight,CheckCircle2,Eye,EyeOff,ArrowLeft} from "lucide-react";
import {KreyviLoading} from "@/components/KreyviLoading";
import {Brand} from "@/components/Brand";
import {SocialAuthButtons} from "@/components/SocialAuthButtons";


import {safeJoinTarget,PUBLIC_SITE_URL} from "@/lib/public-url";
import {configured,db} from "@/lib/supabase";

export default function Login(){
 const router=useRouter();
 const [mode,setMode]=useState<"login"|"signup"|"forgot">("login");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[surname,setSurname]=useState(""),[marketingOptIn,setMarketingOptIn]=useState(false),[whatsapp,setWhatsapp]=useState("");
 const [birthDate,setBirthDate]=useState(""),[gender,setGender]=useState("");
 const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [loginTarget,setLoginTarget]=useState("/entrar");
 const [sessionReady,setSessionReady]=useState(false);
 useEffect(()=>{
  const candidate=new URLSearchParams(window.location.search).get("next")||"";
  let target="/entrar";
  if(safeJoinTarget(candidate)||/^\/app\/novedades\/[a-f0-9-]{36}$/i.test(candidate)){target=candidate;setLoginTarget(candidate);}
  let active=true;
  db().auth.getUser().then(({data})=>{if(!active)return;if(data?.user){router.replace(target);return;}setSessionReady(true);}).catch(()=>{if(active)setSessionReady(true);});
  return()=>{active=false;};
 },[router]);
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   if(!configured())throw new Error("El servidor todavía no está disponible.");
   if(mode==="forgot"){
    const {error}=await db().auth.resetPasswordForEmail(email,{redirectTo:PUBLIC_SITE_URL+"/auth/callback?next=password"});
    if(error)throw error;setMessage("Te hemos enviado un email para recuperar tu contraseña.");
   }else if(mode==="signup"){
    const {data,error}=await db().auth.signUp({email,password,options:{data:{full_name:(name+" "+surname).trim(),whatsapp:whatsapp.trim(),birth_date:birthDate,gender,platform_marketing_opt_in:marketingOptIn,platform_push_opt_in:marketingOptIn,card_notifications_opt_in:marketingOptIn,return_to:safeJoinTarget(loginTarget)||undefined},emailRedirectTo:PUBLIC_SITE_URL+"/auth/callback"}});
    if(error)throw error;
    if(data.session)router.replace(loginTarget);else setMessage("Revisa tu correo y confirma tu cuenta antes de entrar.");
   }else{
    const {error}=await db().auth.signInWithPassword({email,password});
    if(error)throw error;router.replace(loginTarget);
   }
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 useEffect(()=>{if(new URLSearchParams(window.location.search).has("auth_error"))setError("No hemos podido acceder con tu cuenta. Vuelve a intentarlo.");},[]);
 function switchMode(next:typeof mode){setMode(next);setError("");setMessage("")}
 if(!sessionReady)return <KreyviLoading label="Preparando tu espacio"/>;
 return <main className="public-login kreyvi-simple-login">
  <div className="simple-login-top"><Brand href="/"/></div>
  <section className="auth-form-wrap auth-choice-wrap auth-full-login simple-login-panel" aria-labelledby="login-title">
    {mode!=="forgot"&&<div className="simple-login-tabs" role="group" aria-label="Acceso a Kreyvi"><button type="button" aria-pressed={mode==="login"} onClick={()=>switchMode("login")}>Iniciar sesión</button><button type="button" aria-pressed={mode==="signup"} onClick={()=>switchMode("signup")}>Registrarme</button></div>}
    <h1 id="login-title">{mode==="login"?"¡Qué bien verte!":mode==="signup"?"Crea tu cuenta":"Recupera tu acceso"}</h1>
    <p className="auth-intro">{mode==="login"?"Entra para disfrutar de tus tarjetas y recompensas.":mode==="signup"?"Todas tus tarjetas, en un mismo lugar.":"Te enviaremos las instrucciones para recuperar tu contraseña."}</p>
    {safeJoinTarget(loginTarget)&&<p className="auth-intro">Al terminar, volverás a la tarjeta del negocio que has escaneado.</p>}
    <form onSubmit={submit} className="form-stack auth-login-form auth-login-visible">
     {mode==="signup"&&<><div className="form-two"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} placeholder="Nombre"/></label><label>Apellidos<input value={surname} onChange={e=>setSurname(e.target.value)} required minLength={2} placeholder="Apellidos"/></label></div></>}
     <label>Correo electrónico<input value={email} type="email" onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="tu@email.com"/></label>
     {mode!=="forgot"&&<label>Contraseña<div className="password-input"><input value={password} type={visible?"text":"password"} onChange={e=>setPassword(e.target.value)} required minLength={mode==="signup"?10:1} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder="Tu contraseña"/><button type="button" aria-label={visible?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
     {mode==="signup"&&<><div className="form-two"><label>Fecha de nacimiento<input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0,10)} value={birthDate} onChange={e=>setBirthDate(e.target.value)} autoComplete="bday"/></label><label>Sexo<select required value={gender} onChange={e=>setGender(e.target.value)}><option value="">Seleccionar</option><option value="woman">Mujer</option><option value="man">Hombre</option><option value="other">Otro</option><option value="prefer_not">Prefiero no indicarlo</option></select></label></div><InternationalPhoneInput label="Teléfono" value={whatsapp} onChange={setWhatsapp} required/></>}
     {mode==="signup"&&<label className="lp-signup-consent"><input type="checkbox" checked={marketingOptIn} onChange={e=>setMarketingOptIn(e.target.checked)}/><span><strong>Quiero recibir promociones y regalos</strong></span></label>}
     {mode==="signup"&&<p className="lp-signup-consent-hint" aria-live="polite">{!marketingOptIn&&"Entérate de regalos, descuentos y recompensas de tus negocios favoritos. "}Tú decides qué quieres recibir. Puedes cambiarlo en Ajustes.</p>}
     
     {mode==="login"&&<button className="inline-action forgot-action" type="button" onClick={()=>switchMode("forgot")}>¿Olvidaste la contraseña?</button>}
     {error&&<div className="alert error" role="alert">{error}</div>}
     {message&&<div className="alert success"><CheckCircle2 size={18}/>{message}</div>}
     <button type="submit" disabled={busy} className="button button-dark button-full">{busy?"Procesando...":mode==="login"?"Iniciar sesión":mode==="signup"?"Crear mi cuenta":"Enviar instrucciones"} <ArrowRight size={18}/></button>
    </form>
    {mode!=="forgot"&&<SocialAuthButtons next={loginTarget}/>}
    <div className="auth-account-switch">{mode==="login"?<>¿Todavía no tienes cuenta? <button onClick={()=>switchMode("signup")}>Regístrate</button></>:<>¿Ya tienes cuenta? <button onClick={()=>switchMode("login")}>Iniciar sesión</button></>}</div>

  </section>
  <footer className="simple-login-footer"><a href="/"><ArrowLeft size={15}/> Volver al inicio</a><a href="/help">Ayuda y soporte</a></footer>
 </main>;
}
