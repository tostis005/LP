"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowRight,CheckCircle2,Eye,EyeOff,LockKeyhole,ScanLine,ShieldCheck,Sparkles,Store,UserRound} from "lucide-react";
import {Brand} from "@/components/Brand";
import {StampCard} from "@/components/StampCard";
import {configured,db} from "@/lib/supabase";

const profiles=[
 {id:"administrador",name:"Administrador",detail:"Todos los negocios, usuarios e informes",icon:ShieldCheck,shade:"mint"},
 {id:"gestor",name:"Dueño del negocio",detail:"Clientes, tarjetas y configuración",icon:Store,shade:"sand"},
 {id:"empleado",name:"Personal de atención",detail:"Escanear QR, dar sellos y canjear",icon:ScanLine,shade:"lavender"},
 {id:"cliente",name:"Cliente final",detail:"Mis tarjetas, sellos y premios",icon:UserRound,shade:"rose"}
] as const;
export default function Login(){
 const router=useRouter();
 const [view,setView]=useState<"profiles"|"account">("profiles"),[mode,setMode]=useState<"login"|"signup"|"forgot">("login");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState("");
 const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   if(!configured())throw new Error("El servidor todavía no está disponible.");
   if(mode==="forgot"){
    const {error}=await db().auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/auth/callback?next=password"});
    if(error)throw error;setMessage("Te hemos enviado un email para recuperar tu contraseña.");
   }else if(mode==="signup"){
    const {data,error}=await db().auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:window.location.origin+"/auth/callback"}});
    if(error)throw error;
    if(data.session)router.push("/entrar");else setMessage("Revisa tu correo y confirma tu cuenta antes de entrar.");
   }else{
    const {error}=await db().auth.signInWithPassword({email,password});
    if(error)throw error;router.push("/entrar");
   }
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 function changeView(next:"profiles"|"account"){setView(next);setError("");setMessage("")}
 return <main className="auth-layout auth-compact">
  <aside className="auth-story auth-story-compact">
   <Link href="/" aria-label="Volver al inicio"><Brand light/></Link>
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
   <div className="auth-form-wrap auth-choice-wrap">
    <div className="eyebrow">BIENVENIDO A LOYALLY</div>
    <h2>{view==="profiles"?"Entra y explora.":mode==="login"?"Qué alegría verte.":mode==="signup"?"Encantados de conocerte.":"Recupera tu acceso."}</h2>
    <p className="auth-intro">{view==="profiles"?"Descubre la experiencia desde cada uno de los cuatro perfiles. Un toque y estarás dentro.":mode==="login"?"Accede a tu espacio con tu cuenta real.":mode==="signup"?"Crea tu cuenta para guardar tarjetas y recompensas.":"Te enviaremos las instrucciones a tu correo."}</p>
    <div className="auth-view-tabs" role="group" aria-label="Tipo de acceso">
     <button className={view==="profiles"?"active":""} onClick={()=>changeView("profiles")} type="button">Probar perfiles</button>
     <button className={view==="account"?"active":""} onClick={()=>changeView("account")} type="button"><LockKeyhole size={14}/> Mi cuenta</button>
    </div>
    {view==="profiles"?<>
     <div className="auth-profile-grid">{profiles.map(p=><Link key={p.id} href={"/demo?perfil="+p.id} className="auth-profile-card"><span className={"auth-profile-icon "+p.shade}><p.icon size={24} strokeWidth={1.9}/></span><span className="auth-profile-copy"><strong>{p.name}</strong><small>{p.detail}</small></span><ArrowRight className="auth-profile-arrow" size={17}/></Link>)}</div>
     <p className="auth-demo-note"><ShieldCheck size={16}/> Accesos de prueba con datos ficticios. No conceden permisos reales ni registran compras.</p>
    </>:<>
     <form onSubmit={submit} className="form-stack auth-login-form">
      {mode==="signup"&&<label>Nombre completo<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} placeholder="Tu nombre"/></label>}
      <label>Email<input value={email} type="email" onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="tu@email.com"/></label>
      {mode!=="forgot"&&<label>Contraseña<div className="password-input"><input value={password} type={visible?"text":"password"} onChange={e=>setPassword(e.target.value)} required minLength={mode==="login"?1:10} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder="Tu contraseña"/><button type="button" aria-label={visible?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
      {mode==="login"&&<button className="inline-action forgot-action" type="button" onClick={()=>{setMode("forgot");setError("");setMessage("")}}>¿Olvidaste tu contraseña?</button>}
      {error&&<div className="alert error" role="alert">{error}</div>}{message&&<div className="alert success"><CheckCircle2 size={18}/>{message}</div>}
      <button type="submit" disabled={busy} className="button button-dark button-full">{busy?"Procesando...":mode==="login"?"Entrar en mi cuenta":mode==="signup"?"Crear mi cuenta":"Enviar instrucciones"} <ArrowRight size={18}/></button>
     </form>
     <div className="auth-bottom">{mode==="login"?<>¿No tienes cuenta? <button onClick={()=>setMode("signup")}>Regístrate</button></>:<>¿Ya tienes una cuenta? <button onClick={()=>setMode("login")}>Inicia sesión</button></>}</div>
     <p className="auth-legal">El alta de negocios requiere invitación. El uso de datos para promociones es opcional y requiere consentimiento.</p>
    </>}
   </div>
  </section>
 </main>;
}
