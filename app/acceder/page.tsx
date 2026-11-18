"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Sparkles} from "lucide-react";
import {Brand} from "@/components/Brand";
import {configured,db} from "@/lib/supabase";
export default function Login(){
 const router=useRouter(),[mode,setMode]=useState<"login"|"signup"|"forgot">("login"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   if(!configured()) throw new Error("Falta configurar Supabase. Mientras tanto puedes explorar la demo.");
   if(mode==="forgot"){const {error}=await db().auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/auth/callback?next=password"});if(error)throw error;setMessage("Te hemos enviado un email para recuperar tu contraseña.");}
   if(mode==="signup"){const {data,error}=await db().auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:window.location.origin+"/auth/callback"}});if(error)throw error;if(data.session)router.push("/entrar");else setMessage("Revisa tu correo y confirma tu cuenta antes de entrar.");}
   if(mode==="login"){const {error}=await db().auth.signInWithPassword({email,password});if(error)throw error;router.push("/entrar");}
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function social(provider:"google"|"apple"){if(!configured()){setError("Debes configurar Supabase antes de utilizar el acceso social.");return}setBusy(true);setError("");
  const {error}=await db().auth.signInWithOAuth({provider,options:{redirectTo:window.location.origin+"/auth/callback"}});if(error){setError(error.message);setBusy(false)}
 }
 return <div className="auth-layout"><div className="auth-story"><Link href="/"><Brand light/></Link><div className="auth-story-inner"><div className="auth-story-label"><Sparkles size={16}/> LAS MEJORES RELACIONES SE CULTIVAN</div><h1>Más que puntos.<br/><em>Personas que<br/>vuelven.</em></h1><p>Conecta con tus clientes de una forma que se siente cercana, auténtica y sencilla.</p><div className="auth-story-art"><div className="auth-art-card"><div className="auth-art-title">coffee & friends ☕</div><strong>Tu próxima recompensa<br/>está más cerca.</strong><div className="auth-art-dots">● ● ● ● ● ○ ○ ○</div><small>5 de 8 sellos</small></div></div></div><div className="auth-story-foot">Pequeños detalles. Grandes relaciones. ♡</div></div>
 <div className="auth-right"><div className="auth-mobile-logo"><Brand/></div><div className="auth-form-wrap"><div className="eyebrow">BIENVENIDO A LOYALLY</div><h2>{mode==="login"?"Qué alegría verte.":mode==="signup"?"Encantados de conocerte.":"Recupera tu acceso."}</h2><p className="auth-intro">{mode==="login"?"Tu comunidad de clientes y recompensas te espera.":mode==="signup"?"Una sola cuenta para descubrir, guardar tarjetas y gestionar tus negocios asignados.":"Te enviaremos instrucciones para volver a entrar."}</p>
 <form onSubmit={submit} className="form-stack">{mode==="signup"&&<label>Nombre completo<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} placeholder="Tu nombre"/></label>}
 <label>Email<input value={email} type="email" onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="tu@email.com"/></label>
 {mode!=="forgot"&&<label>Contraseña<div className="password-input"><input value={password} type={visible?"text":"password"} onChange={e=>setPassword(e.target.value)} required minLength={6} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder="Mínimo 6 caracteres"/><button type="button" aria-label="Mostrar contraseña" onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
 {mode==="login"&&<button className="inline-action forgot-action" type="button" onClick={()=>{setMode("forgot");setError("");setMessage("")}}>¿Olvidaste la contraseña?</button>}
 {error&&<div className="alert error" role="alert">{error}</div>}{message&&<div className="alert success"><CheckCircle2 size={18}/>{message}</div>}
 <button type="submit" disabled={busy} className="button button-dark button-full">{busy?"Procesando...":mode==="login"?"Entrar en mi cuenta":mode==="signup"?"Crear mi cuenta":"Enviar instrucciones"} <ArrowRight size={18}/></button></form>
 {mode!=="forgot"&&<><div className="form-divider">o continúa con</div><div className="social-row"><button onClick={()=>social("google")} type="button" className="social-button">G&nbsp; Google</button><button onClick={()=>social("apple")} type="button" className="social-button">●&nbsp; Apple</button></div></>}
 <div className="auth-bottom">{mode==="login"?<>¿No tienes cuenta? <button onClick={()=>{setMode("signup");setError("");setMessage("")}}>Regístrate</button></>:<>¿Ya tienes una cuenta? <button onClick={()=>{setMode("login");setError("");setMessage("")}}>Inicia sesión</button></>}</div><p className="auth-legal">El alta de negocios requiere una invitación de la plataforma. Al usar LP aceptas el tratamiento de datos necesario para prestar el servicio; el marketing es siempre opcional.</p></div></div></div>;
}
