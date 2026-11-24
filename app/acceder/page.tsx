"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowRight,CheckCircle2,Eye,EyeOff,Sparkles} from "lucide-react";
import {Brand} from "@/components/Brand";
import {SocialAuthButtons} from "@/components/SocialAuthButtons";
import {StampCard} from "@/components/StampCard";

import {configured,db} from "@/lib/supabase";

export default function Login(){
 const router=useRouter();
 const [mode,setMode]=useState<"login"|"signup"|"forgot">("login");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[surname,setSurname]=useState(""),[marketingOptIn,setMarketingOptIn]=useState(false),[whatsapp,setWhatsapp]=useState("");
 const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [loginTarget,setLoginTarget]=useState("/entrar");
 useEffect(()=>{
  const candidate=new URLSearchParams(window.location.search).get("next")||"";
  if(/^\/app\/novedades\/[a-f0-9-]{36}$/i.test(candidate))setLoginTarget(candidate);
 },[]);
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   if(!configured())throw new Error("El servidor todavía no está disponible.");
   if(mode==="forgot"){
    const {error}=await db().auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/auth/callback?next=password"});
    if(error)throw error;setMessage("Te hemos enviado un email para recuperar tu contraseña.");
   }else if(mode==="signup"){
    const {data,error}=await db().auth.signUp({email,password,options:{data:{full_name:(name+" "+surname).trim(),whatsapp:whatsapp.trim(),platform_marketing_opt_in:marketingOptIn,platform_push_opt_in:marketingOptIn,card_notifications_opt_in:marketingOptIn},emailRedirectTo:window.location.origin+"/auth/callback"}});
    if(error)throw error;
    if(data.session)router.push("/entrar");else setMessage("Revisa tu correo y confirma tu cuenta antes de entrar.");
   }else{
    const {error}=await db().auth.signInWithPassword({email,password});
    if(error)throw error;router.push(loginTarget);
   }
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 useEffect(()=>{if(new URLSearchParams(window.location.search).has("auth_error"))setError("No hemos podido acceder con tu cuenta. Vuelve a intentarlo.");},[]);
 function switchMode(next:typeof mode){setMode(next);setError("");setMessage("")}
 return <main className="auth-layout auth-compact auth-all-access public-login">
  <aside className="auth-story auth-story-compact">
   <Brand light/>
   <div className="auth-story-inner">
    <div className="auth-story-label"><Sparkles size={16}/> UNA VISITA MÁS, UNA HISTORIA MÁS</div>
    <h1>Un detalle.<br/><em>Mil motivos<br/>para volver.</em></h1>
    <p>La fidelización que pone a las personas y a los pequeños negocios en el centro.</p>
    <div className="auth-stamp-illustration"><StampCard name="Tu cafetería" color="#5E1A2B" reward="Tu próximo café gratis" total={8} earned={5} icon="coffee" stampColor="#5E1A2B" message="SIEMPRE ES UN BUEN DÍA"/></div>
   </div>
   <div className="auth-story-foot">Kreyvi ♡ · Tan sencillo como volver.</div>
  </aside>
  <section className="auth-right auth-right-compact">
   <div className="auth-mobile-logo"><Brand/></div>
   <div className="auth-form-wrap auth-choice-wrap auth-full-login">
    <div className="eyebrow">BIENVENIDO</div>
    <h2>{mode==="login"?"Accede a tu espacio.":mode==="signup"?"Crea tu cuenta.":"Recupera tu acceso."}</h2>
    <p className="auth-intro">{mode==="login"?"Introduce tus datos para acceder a tu cuenta.":mode==="signup"?"Crea tu cuenta y guarda todas tus tarjetas en un solo lugar.":"Te enviaremos las instrucciones para recuperar tu contraseña."}</p>
    <SocialAuthButtons next={loginTarget}/>
    <form onSubmit={submit} className="form-stack auth-login-form auth-login-visible">
     {mode==="signup"&&<><div className="form-two"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} placeholder="Nombre"/></label><label>Apellidos<input value={surname} onChange={e=>setSurname(e.target.value)} required minLength={2} placeholder="Apellidos"/></label></div></>}
     <label>Correo electrónico<input value={email} type="email" onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="tu@email.com"/></label>
     {mode!=="forgot"&&<label>Contraseña<div className="password-input"><input value={password} type={visible?"text":"password"} onChange={e=>setPassword(e.target.value)} required minLength={mode==="signup"?10:1} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder="Tu contraseña"/><button type="button" aria-label={visible?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
     {mode==="signup"&&<label className="lp-signup-consent"><input type="checkbox" checked={marketingOptIn} onChange={e=>setMarketingOptIn(e.target.checked)}/><span><strong>Quiero recibir ofertas y novedades</strong><small>De Kreyvi y los negocios de mis tarjetas, por email, WhatsApp y notificaciones. Opcional; puedes cambiarlo en Ajustes.</small></span></label>}
     {mode==="signup"&&marketingOptIn&&<label>Tu número de WhatsApp<input type="tel" inputMode="tel" required value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="+526641234567" pattern="[+][1-9][0-9]{7,14}"/><small>Para recibir las ofertas que has elegido. Incluye el prefijo internacional.</small></label>}
     
     {mode==="login"&&<button className="inline-action forgot-action" type="button" onClick={()=>switchMode("forgot")}>¿Olvidaste la contraseña?</button>}
     {error&&<div className="alert error" role="alert">{error}</div>}
     {message&&<div className="alert success"><CheckCircle2 size={18}/>{message}</div>}
     <button type="submit" disabled={busy} className="button button-dark button-full">{busy?"Procesando...":mode==="login"?"Iniciar sesión":mode==="signup"?"Crear mi cuenta":"Enviar instrucciones"} <ArrowRight size={18}/></button>
    </form>
    <div className="auth-account-switch">{mode==="login"?<>¿Todavía no tienes cuenta? <button onClick={()=>switchMode("signup")}>Regístrate</button></>:<>¿Ya tienes cuenta? <button onClick={()=>switchMode("login")}>Iniciar sesión</button></>}</div>

   </div>
  </section>
 </main>;
}
