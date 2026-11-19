"use client";

import {useEffect,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowRight,Check,ChevronLeft,Gift,Heart,LockKeyhole,Share2,Smartphone,Sparkles,Ticket,X} from "lucide-react";
import {db} from "@/lib/supabase";
import {SocialAuthButtons} from "@/components/SocialAuthButtons";
import "./mi-loyally.css";

type Mode="login"|"signup"|"forgot";
type InstallPrompt=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
type Platform="ios"|"android"|"other";

function isStandalone(){
 return window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator&{standalone?:boolean}).standalone===true;
}
export default function MiLoyally(){
 const router=useRouter();
 const [mode,setMode]=useState<Mode>("login");
 const [platform,setPlatform]=useState<Platform>("other");
 const [standalone,setStandalone]=useState(false);
 const [ready,setReady]=useState(false);
 const [showInstall,setShowInstall]=useState(false);
 const [installPrompt,setInstallPrompt]=useState<InstallPrompt|null>(null);
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[marketingOptIn,setMarketingOptIn]=useState(false),[pushOptIn,setPushOptIn]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");

 useEffect(()=>{
  const appMode=isStandalone();
  setStandalone(appMode);
  const ua=navigator.userAgent;
  const device=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)
   ?"ios":/Android/i.test(ua)?"android":"other";
  setPlatform(device);
  setShowInstall(!appMode&&new URLSearchParams(window.location.search).has("instalar"));
  if(new URLSearchParams(window.location.search).has("auth_error"))setError("No hemos podido conectar con tu cuenta. Prueba de nuevo.");
  function capture(e:Event){e.preventDefault();setInstallPrompt(e as InstallPrompt);}
  function installed(){setStandalone(true);setShowInstall(false);setInstallPrompt(null);}
  window.addEventListener("beforeinstallprompt",capture);
  window.addEventListener("appinstalled",installed);
  let active=true;
  db().auth.getUser().then(({data})=>{
   if(!active)return;
   if(data.user){router.replace("/app");return;}
   setReady(true);
  }).catch(()=>{if(active)setReady(true);});
  return()=>{active=false;window.removeEventListener("beforeinstallprompt",capture);window.removeEventListener("appinstalled",installed);};
 },[router]);

 async function addToHome(){
  if(installPrompt){
   try{
    await installPrompt.prompt();
    const {outcome}=await installPrompt.userChoice;
    setInstallPrompt(null);
    if(outcome==="accepted"){setMessage("¡Perfecto! Abre Loyally desde el icono de tu móvil.");setShowInstall(false);return;}
   }catch{ /* Manual instructions remain available. */ }
  }
  setShowInstall(true);
 }

 async function signIn(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   if(mode==="forgot"){
    const {error}=await db().auth.resetPasswordForEmail(email,{
     redirectTo:window.location.origin+"/auth/callback?next=password"
    });
    if(error)throw error;
    setMessage("Te hemos enviado un correo para recuperar tu acceso.");
   }else if(mode==="signup"){
    const {data,error}=await db().auth.signUp({
     email,password,
     options:{data:{full_name:name.trim(),platform_marketing_opt_in:marketingOptIn,platform_push_opt_in:pushOptIn},emailRedirectTo:window.location.origin+"/auth/callback"}
    });
    if(error)throw error;
    if(data.session)router.replace("/app");
    else setMessage("¡Ya casi está! Revisa tu correo y confirma tu cuenta.");
   }else{
    const {error}=await db().auth.signInWithPassword({email,password});
    if(error)throw error;
    router.replace("/app");
   }
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const intro=mode==="signup"?"Crea tu espacio":mode==="forgot"?"Recupera tu acceso":"Bienvenido a Loyally";
 return <main className="loyal-app-entry">
  <div className="loyal-app-entry-inner">
   <header className="loyal-app-top">
    <div className="loyal-app-logo" aria-label="Loyally"><span>L</span> Loyally</div>
    {!standalone&&<button type="button" className="loyal-app-add" onClick={addToHome}><Smartphone size={16}/> Añadir a mi móvil</button>}
   </header>
   <div className="loyal-app-hero">
    <span className="loyal-app-eyebrow"><Sparkles size={14}/> CADA VISITA CUENTA</span>
    <h1>Tus lugares favoritos.<br/><em>Tus próximos premios.</em></h1>
    <p>Todos tus sellos, tarjetas y sorpresas, siempre contigo.</p>
    <div className="loyal-app-visual" aria-hidden="true">
     <div className="loyal-app-card-backing"></div>
     <div className="loyal-app-card"><div className="loyal-app-card-head"><span><Heart size={17}/> Mi rincón favorito</span><Gift size={23}/></div>
      <div className="loyal-app-stamps">{Array.from({length:8},(_,i)=><span key={i} className={i<5?"filled":""}><Heart size={14}/></span>)}</div>
      <strong>¡Cada vez más cerca!</strong><small>5 de 8 visitas</small>
     </div>
     <span className="loyal-app-floating"><Ticket size={16}/> Tu próxima recompensa ♡</span>
    </div>
   </div>
   <section className="loyal-app-auth" aria-labelledby="loyal-app-auth-title">
    <h2 id="loyal-app-auth-title">{intro}</h2>
    <p>{mode==="signup"?"Tus tarjetas estarán juntas desde el primer día.":mode==="forgot"?"Te ayudamos a volver a entrar.":"Entra para ver tus tarjetas y tus recompensas."}</p>
    <SocialAuthButtons next="/app"/>
    <form onSubmit={signIn} className="loyal-app-form">
     {mode==="signup"&&<label>Tu nombre<input type="text" required minLength={2} value={name} onChange={e=>setName(e.target.value)} autoComplete="given-name" placeholder="¿Cómo te llamas?"/></label>}
     <label>Correo electrónico<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tunombre@correo.com"/></label>
     {mode!=="forgot"&&<label>Contraseña<input type="password" required minLength={mode==="signup"?10:1} autoComplete={mode==="signup"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña"/></label>}
     {mode==="signup"&&<label className="lp-signup-consent"><input type="checkbox" checked={marketingOptIn} onChange={e=>setMarketingOptIn(e.target.checked)}/><span><strong>Quiero recibir sorpresas y novedades de Loyally</strong><small>Ofertas, nuevos negocios y oportunidades para ganar premios por correo. Es opcional, puedes desactivarlo en tu perfil y no afecta a tus tarjetas.</small></span></label>}
     {mode==="signup"&&<label className="lp-signup-consent"><input type="checkbox" checked={pushOptIn} onChange={e=>setPushOptIn(e.target.checked)}/><span><strong>También quiero avisos de Loyally en mi móvil</strong><small>Recompensas, novedades y sorpresas de la aplicación. Después tendrás que autorizar las notificaciones en tu dispositivo. Es opcional y podrás cambiarlo en tus preferencias.</small></span></label>}
     {error&&<p role="alert" className="loyal-app-error">{error}</p>}
     {message&&<p role="status" className="loyal-app-success">{message}</p>}
     <button type="submit" className="loyal-app-submit" disabled={busy||!ready}>{busy?"Un momento...":mode==="login"?"Entrar en Loyally":mode==="signup"?"Crear mi cuenta":"Enviar instrucciones"}<ArrowRight size={18}/></button>
    </form>
    {mode==="login"?<div className="loyal-app-links"><button type="button" onClick={()=>{setMode("signup");setError("");setMessage("");}}>Quiero crear una cuenta</button><button type="button" onClick={()=>{setMode("forgot");setError("");setMessage("");}}>Olvidé mi contraseña</button></div>:<button type="button" className="loyal-app-back" onClick={()=>{setMode("login");setError("");setMessage("");}}><ChevronLeft size={16}/> Ya tengo cuenta</button>}
   </section>
   {!standalone&&<footer className="loyal-app-footer"><span>Hecho para volver ♡</span><Link href="/">Conocer Loyally</Link></footer>}
  </div>
  {showInstall&&!standalone&&<div className="loyal-app-sheet-overlay" role="presentation">
   <div className="loyal-app-sheet" role="dialog" aria-modal="true" aria-labelledby="loyal-app-install-title">
    <button type="button" className="loyal-app-sheet-close" onClick={()=>setShowInstall(false)} aria-label="Cerrar"><X size={19}/></button>
    <div className="loyal-app-sheet-icon"><Smartphone size={28}/></div>
    <h2 id="loyal-app-install-title">Loyally en tu pantalla de inicio</h2>
    <p>Así podrás abrir tus tarjetas desde el icono de Loyally, sin la barra del navegador.</p>
    {platform==="ios"?<>
     <ol className="loyal-app-sheet-steps">
      <li><span>1</span><p>Abre esta pantalla en <strong>Safari</strong>.</p></li>
      <li><span>2</span><p>Toca <Share2 size={15} aria-hidden="true"/> <strong>Compartir</strong> y después <strong>Agregar a Inicio</strong>.</p></li>
      <li><span>3</span><p>Activa <strong>«Abrir como app web»</strong> y toca <strong>Agregar</strong>.</p></li>
     </ol>
     <p className="loyal-app-sheet-hint">Después, abre Loyally desde el nuevo icono.</p>
    </>:platform==="android"?<>
     <ol className="loyal-app-sheet-steps">
      <li><span>1</span><p>Abre esta pantalla en <strong>Chrome</strong>.</p></li>
      <li><span>2</span><p>Toca el menú <strong>⋮</strong> y <strong>Instalar aplicación</strong>.</p></li>
      <li><span>3</span><p>Abre Loyally desde el icono que aparecerá en tu móvil.</p></li>
     </ol>
     <button type="button" className="loyal-app-sheet-action" onClick={addToHome}>Añadir Loyally <ArrowRight size={17}/></button>
    </>:<p className="loyal-app-sheet-hint">Abre esta página desde tu iPhone o Android para tener Loyally en tu pantalla de inicio.</p>}
    <button type="button" className="loyal-app-sheet-secondary" onClick={()=>setShowInstall(false)}><Check size={15}/> Entendido</button>
   </div>
  </div>}
 </main>;
}
