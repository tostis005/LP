"use client";
import {InternationalPhoneInput} from "@/components/InternationalPhoneInput";
import {KreyviLoading} from "@/components/KreyviLoading";
import {PublicHeader} from "@/components/PublicHeader";
import {PublicFooter} from "@/components/PublicFooter";
import {LandingLanguageSync} from "@/components/LandingLanguageSync";
import {StampCard} from "@/components/StampCard";
import {CARD_DESIGNS} from "@/lib/card-designs";
import type {LandingLanguage} from "@/lib/landing-copy";

import {useEffect,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowRight,Check,ChevronLeft,Share2,Smartphone,Ticket,X} from "lucide-react";
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
 const [lang,setLang]=useState<LandingLanguage>("es");
 const [mode,setMode]=useState<Mode>("login");
 const [platform,setPlatform]=useState<Platform>("other");
 const [standalone,setStandalone]=useState(false);
 const [ready,setReady]=useState(false);
 const [signedIn,setSignedIn]=useState(false);
 const [showInstall,setShowInstall]=useState(false);
 const [installPrompt,setInstallPrompt]=useState<InstallPrompt|null>(null);
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[marketingOptIn,setMarketingOptIn]=useState(false),[whatsapp,setWhatsapp]=useState("");
 const [surname,setSurname]=useState(""),[birthDate,setBirthDate]=useState(""),[gender,setGender]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");

 useEffect(()=>{
  setLang(new URLSearchParams(window.location.search).get("lang")==="en"?"en":"es");
  const appMode=isStandalone();
  setStandalone(appMode);
  const ua=navigator.userAgent;
  const device=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)
   ?"ios":/Android/i.test(ua)?"android":"other";
  setPlatform(device);
  const installing=!appMode&&new URLSearchParams(window.location.search).has("instalar");
  setShowInstall(installing);
  if(new URLSearchParams(window.location.search).has("auth_error"))setError("No hemos podido conectar con tu cuenta. Prueba de nuevo.");
  function capture(e:Event){e.preventDefault();setInstallPrompt(e as InstallPrompt);}
  function installed(){setStandalone(isStandalone());setShowInstall(false);setInstallPrompt(null);}
  window.addEventListener("beforeinstallprompt",capture);
  window.addEventListener("appinstalled",installed);
  let active=true;
  db().auth.getUser().then(({data})=>{
   if(!active)return;
   if(data.user){
    setSignedIn(true);
    // Installation is public, even with an existing business/admin session.
    if(!installing){router.replace("/entrar");return;}
   }
   if(appMode){router.replace("/acceder");return;}
   setReady(true);
  }).catch(()=>{if(active){if(appMode)router.replace("/acceder");else setReady(true);}});
  return()=>{active=false;window.removeEventListener("beforeinstallprompt",capture);window.removeEventListener("appinstalled",installed);};
 },[router]);

 async function addToHome(){
  if(installPrompt){
   try{
    await installPrompt.prompt();
    const {outcome}=await installPrompt.userChoice;
    setInstallPrompt(null);
    if(outcome==="accepted"){setMessage("¡Perfecto! Abre Kreyvi desde el icono de tu móvil.");setShowInstall(false);return;}
   }catch{ /* Manual instructions remain available. */ }
  }
  setShowInstall(true);
 }

 async function signIn(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   if(mode==="forgot"){
    const {error}=await db().auth.resetPasswordForEmail(email,{
     redirectTo:"https://kreyvi.com/auth/callback?next=password"
    });
    if(error)throw error;
    setMessage("Te hemos enviado un correo para recuperar tu acceso.");
   }else if(mode==="signup"){
    const {data,error}=await db().auth.signUp({
     email,password,
     options:{data:{full_name:(name+" "+surname).trim(),whatsapp:whatsapp.trim(),birth_date:birthDate,gender,platform_marketing_opt_in:marketingOptIn,platform_push_opt_in:marketingOptIn,card_notifications_opt_in:marketingOptIn},emailRedirectTo:"https://kreyvi.com/auth/callback"}
    });
    if(error)throw error;
    if(data.session)router.replace("/entrar");
    else setMessage("¡Ya casi está! Revisa tu correo y confirma tu cuenta.");
   }else{
    const {error}=await db().auth.signInWithPassword({email,password});
    if(error)throw error;
    router.replace("/entrar");
   }
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const en=lang==="en";
 const intro=mode==="signup"?(en?"Create your account":"Crea tu espacio"):mode==="forgot"?(en?"Recover your access":"Recupera tu acceso"):(en?"Welcome to Kreyvi":"Bienvenido a Kreyvi");
 if(!ready||standalone)return <KreyviLoading label="Preparando tu espacio"/>;
 return <div className="loyal-app-public"><LandingLanguageSync lang={lang}/><PublicHeader lang={lang} page="app"/><main className="loyal-app-entry">
  <div className="loyal-app-entry-inner">

   <div className="loyal-app-hero">
    <span className="loyal-app-eyebrow">{lang==="en"?"EVERY VISIT COUNTS":"CADA VISITA CUENTA"}</span>
    <h1>{lang==="en"?"Your favorite places.":"Tus lugares favoritos."}<br/><em>{lang==="en"?"Your next rewards.":"Tus próximos premios."}</em></h1>
    <p>{lang==="en"?"All your stamps, cards and rewards, always with you.":"Todos tus sellos, tarjetas y sorpresas, siempre contigo."}</p><button type="button" className="loyal-app-add" onClick={addToHome}><Smartphone size={19}/> {lang==="en"?"Add to my phone":"Añadir a mi móvil"}</button>
    <div className="loyal-app-visual" aria-hidden="true">
     <div className="loyal-app-card-backing"></div>
     <div className="loyal-app-card"><StampCard {...CARD_DESIGNS[0].preview} locale={lang} name={lang==="en"?"Your favorite café":"Mi cafetería favorita"} reward={lang==="en"?"A coffee on us":"Tu próximo café gratis"} total={8} earned={5}/></div>
     <span className="loyal-app-floating"><Ticket size={16}/> {lang==="en"?"Your next reward":"Tu próxima recompensa"}</span>
    </div>
   </div>
   <section className="loyal-app-auth" aria-labelledby="loyal-app-auth-title">
    <h2 id="loyal-app-auth-title">{intro}</h2>
    <p>{mode==="signup"?(en?"All your cards together from day one.":"Tus tarjetas estarán juntas desde el primer día."):mode==="forgot"?(en?"We will help you get back in.":"Te ayudamos a volver a entrar."):(en?"Sign in to see your cards and rewards.":"Entra para ver tus tarjetas y tus recompensas.")}</p>
    {signedIn?<><p>{en?"You are signed in. Install Kreyvi and open your account whenever you like.":"Ya tienes una sesión iniciada. Puedes instalar Kreyvi y abrir tu espacio cuando quieras."}</p><Link className="loyal-app-submit" href="/entrar">Entrar en mi espacio <ArrowRight size={18}/></Link></>:<>
    <SocialAuthButtons next="/entrar" lang={lang}/>
    <form onSubmit={signIn} className="loyal-app-form">
     {mode==="signup"&&<label>{en?"Your name":"Tu nombre"}<input type="text" required minLength={2} value={name} onChange={e=>setName(e.target.value)} autoComplete="given-name" placeholder={en?"Your name":"¿Cómo te llamas?"}/></label>}
     <label>{en?"Email address":"Correo electrónico"}<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tunombre@correo.com"/></label>
     {mode!=="forgot"&&<label>{en?"Password":"Contraseña"}<input type="password" required minLength={mode==="signup"?10:1} autoComplete={mode==="signup"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={en?"Your password":"Tu contraseña"}/></label>}
     {mode==="signup"&&<><label>{en?"Surname":"Apellidos"}<input required minLength={2} value={surname} onChange={x=>setSurname(x.target.value)} autoComplete="family-name"/></label><label>{en?"Date of birth":"Fecha de nacimiento"}<input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0,10)} value={birthDate} onChange={x=>setBirthDate(x.target.value)} autoComplete="bday"/></label><label>{en?"Sex":"Sexo"}<select required value={gender} onChange={x=>setGender(x.target.value)}><option value="">{en?"Select":"Seleccionar"}</option><option value="woman">{en?"Woman":"Mujer"}</option><option value="man">{en?"Man":"Hombre"}</option><option value="other">{en?"Other":"Otro"}</option><option value="prefer_not">{en?"Prefer not to say":"Prefiero no indicarlo"}</option></select></label><InternationalPhoneInput label={en?"Phone":"Teléfono"} language={en?"en":"es"} value={whatsapp} onChange={setWhatsapp} required/></>}
     {mode==="signup"&&<label className="lp-signup-consent"><input type="checkbox" checked={marketingOptIn} onChange={e=>setMarketingOptIn(e.target.checked)}/><span><strong>{en?"I want to receive promotions and gifts":"Quiero recibir promociones y regalos"}</strong></span></label>}
     {mode==="signup"&&<p className="lp-signup-consent-hint" aria-live="polite">{!marketingOptIn&&(en?"Discover gifts, discounts and rewards from your favorite businesses. ":"Entérate de regalos, descuentos y recompensas de tus negocios favoritos. ")}{en?"You decide what to receive. You can change this in Settings.":"Tú decides qué quieres recibir. Puedes cambiarlo en Ajustes."}</p>}
     
     {error&&<p role="alert" className="loyal-app-error">{error}</p>}
     {message&&<p role="status" className="loyal-app-success">{message}</p>}
     <button type="submit" className="loyal-app-submit" disabled={busy||!ready}>{busy?(en?"One moment…":"Un momento..."):mode==="login"?(en?"Sign in":"Entrar en Kreyvi"):mode==="signup"?(en?"Create my account":"Crear mi cuenta"):(en?"Send instructions":"Enviar instrucciones")}<ArrowRight size={18}/></button>
    </form>
    {mode==="login"?<div className="loyal-app-links"><button type="button" onClick={()=>{setMode("signup");setError("");setMessage("");}}>{en?"Create an account":"Quiero crear una cuenta"}</button><button type="button" onClick={()=>{setMode("forgot");setError("");setMessage("");}}>{en?"Forgot my password":"Olvidé mi contraseña"}</button></div>:<button type="button" className="loyal-app-back" onClick={()=>{setMode("login");setError("");setMessage("");}}><ChevronLeft size={16}/> Ya tengo cuenta</button>}
    </>}
   </section>
  </div>
  {showInstall&&!standalone&&<div className="loyal-app-sheet-overlay" role="presentation">
   <div className="loyal-app-sheet" role="dialog" aria-modal="true" aria-labelledby="loyal-app-install-title">
    <button type="button" className="loyal-app-sheet-close" onClick={()=>setShowInstall(false)} aria-label={en?"Close":"Cerrar"}><X size={19}/></button>
    <div className="loyal-app-sheet-icon"><Smartphone size={28}/></div>
    <h2 id="loyal-app-install-title">{en?"Kreyvi on your home screen":"Kreyvi en tu pantalla de inicio"}</h2>
    <p>{en?"Open your cards from the Kreyvi icon, without the browser bar.":"Así podrás abrir tus tarjetas desde el icono de Kreyvi, sin la barra del navegador."}</p>
    {platform==="ios"?<>
     <ol className="loyal-app-sheet-steps">
      <li><span>1</span><p>{en?"Open this page in ":"Abre esta pantalla en "}<strong>Safari</strong>{en?". If you arrived from WhatsApp, Instagram or another app, open the link in Safari.":". Si llegaste desde WhatsApp, Instagram u otra app, abre el enlace en Safari."}</p></li>
      <li><span>2</span><p>{en?"Tap ":"Toca "}<Share2 size={15} aria-hidden="true"/> <strong>{en?"Share":"Compartir"}</strong>{en?" (or the Safari page menu), then ":" (o el menú de página de Safari) y después "}<strong>{en?"Add to Home Screen":"Añadir a pantalla de inicio"}</strong>.</p></li>
      <li><span>3</span><p>{en?"If shown, enable ":"Si aparece, activa "}<strong>{en?"Open as Web App":"«Abrir como app web»"}</strong>{en?" and tap ":" y toca "}<strong>{en?"Add":"Añadir"}</strong>.</p></li>
     </ol>
     <p className="loyal-app-sheet-hint">{en?"If the option is missing, look for Edit Actions in the Share menu. Then open Kreyvi from its new icon.":"Si no aparece la opción, busca «Editar acciones» al final del menú Compartir. Después, abre Kreyvi desde el nuevo icono."}</p>
    </>:platform==="android"?<>
     <ol className="loyal-app-sheet-steps">
      <li><span>1</span><p>{en?"Open this page in ":"Abre esta pantalla en "}<strong>Chrome</strong>.</p></li>
      <li><span>2</span><p>Toca el menú <strong>⋮</strong> y <strong>{en?"Install app":"Instalar aplicación"}</strong>.</p></li>
      <li><span>3</span><p>{en?"Open Kreyvi from the new icon on your phone.":"Abre Kreyvi desde el icono que aparecerá en tu móvil."}</p></li>
     </ol>
     <button type="button" className="loyal-app-sheet-action" onClick={addToHome}>Añadir Kreyvi <ArrowRight size={17}/></button>
    </>:<p className="loyal-app-sheet-hint">{en?"Open this page on your iPhone or Android to add Kreyvi to your home screen.":"Abre esta página desde tu iPhone o Android para tener Kreyvi en tu pantalla de inicio."}</p>}
    <button type="button" className="loyal-app-sheet-secondary" onClick={()=>setShowInstall(false)}><Check size={15}/> Entendido</button>
   </div>
  </div>}
 </main><PublicFooter lang={lang} page="app"/></div>;
}
