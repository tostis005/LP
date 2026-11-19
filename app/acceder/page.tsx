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
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[surname,setSurname]=useState(""),[marketingOptIn,setMarketingOptIn]=useState(false),[pushOptIn,setPushOptIn]=useState(false);
 const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   if(!configured())throw new Error("El servidor todavía no está disponible.");
   if(mode==="forgot"){
    const {error}=await db().auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/auth/callback?next=password"});
    if(error)throw error;setMessage("Te hemos enviado un email para recuperar tu contraseña.");
   }else if(mode==="signup"){
    const {data,error}=await db().auth.signUp({email,password,options:{data:{full_name:(name+" "+surname).trim(),platform_marketing_opt_in:marketingOptIn,platform_push_opt_in:pushOptIn},emailRedirectTo:window.location.origin+"/auth/callback"}});
    if(error)throw error;
    if(data.session)router.push("/entrar");else setMessage("Revisa tu correo y confirma tu cuenta antes de entrar.");
   }else{
    const {error}=await db().auth.signInWithPassword({email,password});
    if(error)throw error;router.push("/entrar");
   }
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 useEffect(()=>{if(new URLSearchParams(window.location.search).has("auth_error"))setError("No hemos podido acceder con tu cuenta. Vuelve a intentarlo.");},[]);
 function switchMode(next:typeof mode){setMode(next);setError("");setMessage("")}
 return <main className="auth-layout auth-compact auth-all-access">
  <aside className="auth-story auth-story-compact">
   <Brand light/>
   <div className="auth-story-inner">
    <div className="auth-story-label"><Sparkles size={16}/> UNA VISITA MÁS, UNA HISTORIA MÁS</div>
    <h1>Un detalle.<br/><em>Mil motivos<br/>para volver.</em></h1>
    <p>La fidelización que pone a las personas y a los pequeños negocios en el centro.</p>
    <div className="auth-stamp-illustration"><StampCard name="Tu cafetería" color="#571c32" reward="Tu próximo café gratis" total={8} earned={5} icon="coffee" message="SIEMPRE ES UN BUEN DÍA"/></div>
   </div>
   <div className="auth-story-foot">Loyally ♡ · Tan sencillo como volver.</div>
  </aside>
  <section className="auth-right auth-right-compact">
   <div className="auth-mobile-logo"><Brand/></div>
   <div className="auth-form-wrap auth-choice-wrap auth-full-login">
    <div className="eyebrow">BIENVENIDO A LOYALLY</div>
    <h2>{mode==="login"?"Accede a tu espacio.":mode==="signup"?"Crea tu cuenta.":"Recupera tu acceso."}</h2>
    <p className="auth-intro">{mode==="login"?"Accede a Loyally y descubre tu espacio según el tipo de cuenta.":mode==="signup"?"Crea tu cuenta y guarda todas tus tarjetas en un solo lugar.":"Te enviaremos las instrucciones para recuperar tu contraseña."}</p>
    <SocialAuthButtons next="/entrar"/>
    <form onSubmit={submit} className="form-stack auth-login-form auth-login-visible">
     {mode==="signup"&&<><div className="form-two"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} placeholder="Nombre"/></label><label>Apellidos<input value={surname} onChange={e=>setSurname(e.target.value)} required minLength={2} placeholder="Apellidos"/></label></div></>}
     <label>Correo electrónico<input value={email} type="email" onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="tu@email.com"/></label>
     {mode!=="forgot"&&<label>Contraseña<div className="password-input"><input value={password} type={visible?"text":"password"} onChange={e=>setPassword(e.target.value)} required minLength={mode==="signup"?10:1} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder="Tu contraseña"/><button type="button" aria-label={visible?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
     {mode==="signup"&&<label className="lp-signup-consent"><input type="checkbox" checked={marketingOptIn} onChange={e=>setMarketingOptIn(e.target.checked)}/><span><strong>Quiero recibir ofertas y novedades por correo</strong><small>De Loyally. Opcional y modificable desde mi perfil.</small></span></label>}
     {mode==="signup"&&<label className="lp-signup-consent"><input type="checkbox" checked={pushOptIn} onChange={e=>setPushOptIn(e.target.checked)}/><span><strong>Quiero recibir avisos en mi móvil</strong><small>Puedes activarlos al entrar en la aplicación.</small></span></label>}
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
