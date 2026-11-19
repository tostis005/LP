"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowRight,CheckCircle2,Eye,EyeOff,LockKeyhole,ScanLine,ShieldCheck,Sparkles,Store,UserRound} from "lucide-react";
import {Brand} from "@/components/Brand";
import {SocialAuthButtons} from "@/components/SocialAuthButtons";
import {StampCard} from "@/components/StampCard";
import {enterDemo,leaveDemo,type DemoRole} from "@/lib/demo-local";
import {configured,db} from "@/lib/supabase";

const profiles=[
 {id:"administrador" as const,name:"Administrador",detail:"Negocios, usuarios y reportes",icon:ShieldCheck,shade:"mint",route:"/admin"},
 {id:"gestor" as const,name:"Dueño del negocio",detail:"Panel, tarjetas y clientes",icon:Store,shade:"sand",route:"/negocio"},
 {id:"empleado" as const,name:"Personal del local",detail:"Escanear QR y entregar sellos",icon:ScanLine,shade:"lavender",route:"/empleado"},
 {id:"cliente" as const,name:"Cliente",detail:"Mis tarjetas y recompensas",icon:UserRound,shade:"rose",route:"/app"}
];
export default function Login(){
 const router=useRouter();
 const [mode,setMode]=useState<"login"|"signup"|"forgot">("login");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[surname,setSurname]=useState("");
 const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function selectProfile(role:DemoRole,route:string){
  const sandbox=process.env.NEXT_PUBLIC_LP_SANDBOX_MODE==="true";
  const sandboxPassword=process.env.NEXT_PUBLIC_LP_SANDBOX_PASSWORD||"";
  if(sandbox&&sandboxPassword){
   // Solo en una base de datos aislada: los cuatro perfiles son usuarios de auth.users.
   const email=role==="administrador"?"admin@demo.loyally.test":role==="gestor"?"gestor@demo.loyally.test":role==="empleado"?"empleado@demo.loyally.test":"cliente@demo.loyally.test";
   leaveDemo();setMode("login");setEmail(email);setPassword(sandboxPassword);setError("");setBusy(true);
   const {error}=await db().auth.signInWithPassword({email,password:sandboxPassword});
   setBusy(false);if(error){setError("No se pudo iniciar la sesión de prueba: "+error.message);return}
   router.push(route);return;
  }
  // En la aplicación de producción no se comparte ninguna clave de administrador.
  // El acceso de un toque conserva un sandbox ficticio SOLO del navegador.
  enterDemo(role);router.push(route);
 }
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  leaveDemo(); // El login por email siempre debe utilizar el servidor real.
  try{
   if(!configured())throw new Error("El servidor todavía no está disponible.");
   if(mode==="forgot"){
    const {error}=await db().auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/auth/callback?next=password"});
    if(error)throw error;setMessage("Te hemos enviado un email para recuperar tu contraseña.");
   }else if(mode==="signup"){
    const {data,error}=await db().auth.signUp({email,password,options:{data:{full_name:(name+" "+surname).trim()},emailRedirectTo:window.location.origin+"/auth/callback"}});
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
    <div className="auth-stamp-illustration"><StampCard name="Café Noma" color="#31654c" reward="Tu próximo café gratis" total={8} earned={5} icon="coffee" message="SIEMPRE ES UN BUEN DÍA"/></div>
   </div>
   <div className="auth-story-foot">Loyally ♡ · Tan sencillo como volver.</div>
  </aside>
  <section className="auth-right auth-right-compact">
   <div className="auth-mobile-logo"><Brand/></div>
   <div className="auth-form-wrap auth-choice-wrap auth-full-login">
    <div className="eyebrow">BIENVENIDO A LOYALLY</div>
    <h2>{mode==="login"?"Accede a tu espacio.":mode==="signup"?"Crea tu cuenta.":"Recupera tu acceso."}</h2>
    <p className="auth-intro">{mode==="login"?"Inicia sesión con tu cuenta o explora cualquiera de los cuatro perfiles de demostración.":mode==="signup"?"Solo necesitas una cuenta para guardar todas tus tarjetas. Los avisos sobre tus premios forman parte del servicio; las ofertas comerciales son opcionales.":"Te enviaremos las instrucciones para recuperar tu contraseña."}</p>
    <SocialAuthButtons next="/entrar"/>
    <form onSubmit={submit} className="form-stack auth-login-form auth-login-visible">
     {mode==="signup"&&<><div className="form-two"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} placeholder="Nombre"/></label><label>Apellidos<input value={surname} onChange={e=>setSurname(e.target.value)} required minLength={2} placeholder="Apellidos"/></label></div></>}
     <label>Correo electrónico<input value={email} type="email" onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="tu@email.com"/></label>
     {mode!=="forgot"&&<label>Contraseña<div className="password-input"><input value={password} type={visible?"text":"password"} onChange={e=>setPassword(e.target.value)} required minLength={mode==="signup"?10:1} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder="Tu contraseña"/><button type="button" aria-label={visible?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
     {mode==="login"&&<button className="inline-action forgot-action" type="button" onClick={()=>switchMode("forgot")}>¿Olvidaste la contraseña?</button>}
     {error&&<div className="alert error" role="alert">{error}</div>}
     {message&&<div className="alert success"><CheckCircle2 size={18}/>{message}</div>}
     <button type="submit" disabled={busy} className="button button-dark button-full">{busy?"Procesando...":mode==="login"?"Iniciar sesión":mode==="signup"?"Crear mi cuenta":"Enviar instrucciones"} <ArrowRight size={18}/></button>
    </form>
    <div className="auth-account-switch">{mode==="login"?<>¿Todavía no tienes cuenta? <button onClick={()=>switchMode("signup")}>Regístrate</button></>:<>¿Ya tienes cuenta? <button onClick={()=>switchMode("login")}>Iniciar sesión</button></>}</div>
    <div className="auth-quick-divider"><span>O ENTRA CON UN PERFIL DE PRUEBA</span></div>
    <div className="auth-profile-grid auth-real-routes" role="group" aria-label="Acceso rápido al interior de Loyally">
     {profiles.map(p=><button type="button" key={p.id} onClick={()=>selectProfile(p.id,p.route)} disabled={busy} className="auth-profile-card">
      <span className={"auth-profile-icon "+p.shade}><p.icon size={23} strokeWidth={1.9}/></span>
      <span className="auth-profile-copy"><strong>{p.name}</strong><small>{p.detail}</small></span>
      <ArrowRight className="auth-profile-arrow" size={17}/>
     </button>)}
    </div>
    <p className="auth-demo-note"><ShieldCheck size={16}/> En producción exploras datos locales ficticios. En una instalación sandbox aislada, los perfiles inician sesión contra usuarios auténticos de PostgreSQL.</p>
   </div>
  </section>
 </main>;
}
